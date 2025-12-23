import type { HttpContext } from '@adonisjs/core/http'
import { audioProcessValidator, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_SIZE } from '#validators/audio'
import QueueService from '#services/queue_service'
import storageService from '#services/storage_service'
import AudioConverterService from '#services/audio_converter_service'
import Audio, { AudioStatus } from '#models/audio'
import { errors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import { unlink } from 'node:fs/promises'

export default class AudioController {
  /**
   * Submit audio file for async processing.
   * Returns a job ID for status tracking.
   *
   * POST /audio/process
   */
  async process({ request, response, auth, i18n }: HttpContext) {
    try {
      // Validate prompt
      const { prompt } = await request.validateUsing(audioProcessValidator)

      // Get uploaded file
      const audioFile = request.file('audio', {
        size: `${MAX_AUDIO_SIZE / (1024 * 1024)}mb`,
        extnames: ALLOWED_AUDIO_EXTENSIONS,
      })

      if (!audioFile) {
        return response.badRequest({
          message: i18n.t('messages.audio.no_file_uploaded'),
        })
      }

      if (!audioFile.isValid) {
        return response.badRequest({
          message: audioFile.errors[0]?.message || i18n.t('messages.audio.invalid_file'),
        })
      }

      const user = auth.user!
      const organizationId = user.currentOrganizationId

      if (!organizationId) {
        return response.badRequest({
          message: i18n.t('messages.errors.no_current_organization'),
        })
      }

      // Move uploaded file to temp directory for processing
      const tempFileName = `${randomUUID()}.${audioFile.extname}`
      await audioFile.move(app.tmpPath(), { name: tempFileName })
      const tempFilePath = app.tmpPath(tempFileName)

      // Convert to Opus format for optimal storage
      const converter = new AudioConverterService()
      const conversionResult = await converter.convertToOpus(tempFilePath, 'voice')

      // Store converted file in persistent storage
      const storedFile = await storageService.storeAudioFromPath(
        conversionResult.path,
        organizationId,
        {
          originalName: audioFile.clientName.replace(/\.[^/.]+$/, '.opus'),
          mimeType: 'audio/opus',
        }
      )

      // Cleanup temp files
      await Promise.all([
        unlink(tempFilePath).catch(() => {}),
        converter.cleanup(conversionResult.path),
      ])

      // Generate job ID first so we can store it with the audio
      const jobId = randomUUID()

      // Create Audio record in database with job ID for progress tracking
      const audio = await Audio.create({
        organizationId,
        userId: user.id,
        title: audioFile.clientName.replace(/\.[^/.]+$/, ''), // Remove extension for title
        fileName: storedFile.originalName,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        mimeType: storedFile.mimeType,
        duration: Math.round(conversionResult.duration),
        status: AudioStatus.Pending,
        currentJobId: jobId, // Store job ID for progress tracking
      })

      // Queue the job
      const queueService = QueueService.getInstance()

      await queueService.addTranscriptionJob({
        jobId,
        userId: user.id,
        organizationId,
        audioId: audio.id,
        audioFilePath: storedFile.path,
        audioFileName: storedFile.originalName,
        prompt,
        locale: i18n.locale,
      })

      return response.accepted({
        jobId,
        audioId: audio.id,
        message: i18n.t('messages.audio.processing_started'),
        statusUrl: `/audio/status/${jobId}`,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const firstError = error.messages[0]
        if (firstError) {
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })
          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }
      }

      console.error('Audio processing error:', error)

      return response.internalServerError({
        message: i18n.t('messages.audio.processing_error'),
      })
    }
  }

  /**
   * Get job status and results.
   *
   * GET /audio/status/:jobId
   */
  async status({ params, response, i18n }: HttpContext) {
    const { jobId } = params

    const queueService = QueueService.getInstance()
    const jobStatus = await queueService.getJobStatus(jobId)

    if (!jobStatus) {
      return response.notFound({
        message: i18n.t('messages.audio.job_not_found'),
      })
    }

    // TODO: Add authorization check in Phase 1.2
    // Verify job belongs to user's organization by storing job metadata in database

    return response.ok(jobStatus)
  }
}

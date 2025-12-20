import type { HttpContext } from '@adonisjs/core/http'
import { audioProcessValidator, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_SIZE } from '#validators/audio'
import QueueService from '#services/queue_service'
import storageService from '#services/storage_service'
import Audio, { AudioStatus } from '#models/audio'
import { errors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'

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

      // Store file in persistent storage
      const storedFile = await storageService.storeAudioFile(audioFile, organizationId)

      // Create Audio record in database
      const audio = await Audio.create({
        organizationId,
        userId: user.id,
        title: storedFile.originalName.replace(/\.[^/.]+$/, ''), // Remove extension for title
        fileName: storedFile.originalName,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        mimeType: storedFile.mimeType,
        status: AudioStatus.Pending,
      })

      // Generate job ID and queue the job
      const jobId = randomUUID()
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

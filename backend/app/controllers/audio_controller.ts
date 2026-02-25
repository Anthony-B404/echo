import type { HttpContext } from '@adonisjs/core/http'
import { audioProcessValidator, ALLOWED_MEDIA_EXTENSIONS, MAX_AUDIO_SIZE } from '#validators/audio'
import QueueService from '#services/queue_service'
import storageService from '#services/storage_service'
import Audio, { AudioStatus } from '#models/audio'
import AudioPolicy from '#policies/audio_policy'
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
        extnames: ALLOWED_MEDIA_EXTENSIONS,
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

      // Store original file directly in persistent storage
      // Conversion will happen in the background job for better progress tracking
      const storedFile = await storageService.storeAudioFile(audioFile, organizationId)

      // Generate job ID first so we can store it with the audio
      const jobId = randomUUID()

      // Create Audio record in database with job ID for progress tracking
      // Duration will be set after conversion in the background job
      const audio = await Audio.create({
        organizationId,
        userId: user.id,
        title: audioFile.clientName.replace(/\.[^/.]+$/, ''), // Remove extension for title
        fileName: storedFile.originalName,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        mimeType: storedFile.mimeType,
        duration: null, // Will be set after conversion in job
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
  async status({ params, response, auth, bouncer, i18n }: HttpContext) {
    const { jobId } = params
    const user = auth.user!

    // 1. Verify user has an active organization
    if (!user.currentOrganizationId) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // 2. Find the Audio record associated with this jobId
    const audio = await Audio.findBy('currentJobId', jobId)

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.job_not_found'),
      })
    }

    // 3. Verify access via existing policy (checks organization ownership)
    if (await bouncer.with(AudioPolicy).denies('viewAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.audio.access_denied'),
      })
    }

    // 4. Get and return job status
    const queueService = QueueService.getInstance()
    const jobStatus = await queueService.getJobStatus(jobId)

    if (!jobStatus) {
      return response.notFound({
        message: i18n.t('messages.audio.job_not_found'),
      })
    }

    return response.ok(jobStatus)
  }
}

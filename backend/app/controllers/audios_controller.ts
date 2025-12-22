import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'
import AudioPolicy from '#policies/audio_policy'
import storageService from '#services/storage_service'
import { audioIndexValidator } from '#validators/audio'

export default class AudiosController {
  /**
   * List all audios for the current organization.
   * Supports pagination and status filtering.
   *
   * GET /api/audios
   */
  async index({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(AudioPolicy).denies('listAudios')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate query parameters
    const { page = 1, limit = 20, status } = await request.validateUsing(audioIndexValidator)

    // Build query with tenant isolation
    const query = Audio.query()
      .where('organizationId', user.currentOrganizationId!)
      .orderBy('createdAt', 'desc')

    // Apply status filter if provided
    if (status) {
      query.where('status', status)
    }

    // Execute with pagination
    const audios = await query.paginate(page, limit)

    return response.ok(audios)
  }

  /**
   * Get audio details with transcription.
   *
   * GET /api/audios/:id
   */
  async show({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const audio = await Audio.find(id)

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioPolicy).denies('viewAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.audio.access_denied'),
      })
    }

    // Load transcription relationship
    await audio.load('transcription')

    return response.ok(audio)
  }

  /**
   * Stream the audio file.
   *
   * GET /api/audios/:id/file
   */
  async file({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const audio = await Audio.find(id)

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioPolicy).denies('viewAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.audio.access_denied'),
      })
    }

    // Check if file exists
    const exists = await storageService.fileExists(audio.filePath)
    if (!exists) {
      return response.notFound({
        message: i18n.t('messages.audio.file_not_found'),
      })
    }

    // Stream the file
    const stream = await storageService.getFileStream(audio.filePath)

    // Set appropriate headers (sanitize values to prevent header injection)
    const mimeType = audio.mimeType || 'audio/mpeg'
    const safeFileName = (audio.fileName || 'audio.mp3').replace(/[^\w.-]/g, '_')

    response.header('Content-Type', mimeType)
    response.header('Content-Disposition', `inline; filename="${safeFileName}"`)
    response.header('Accept-Ranges', 'bytes')

    return response.stream(stream)
  }

  /**
   * Delete an audio and its associated file.
   *
   * DELETE /api/audios/:id
   */
  async destroy({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const audio = await Audio.find(id)

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioPolicy).denies('deleteAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.audio.access_denied'),
      })
    }

    // Delete file from storage
    try {
      await storageService.deleteFile(audio.filePath)
    } catch (error) {
      console.error(`Failed to delete audio file: ${audio.filePath}`, error)
      // Continue with deletion even if file removal fails
    }

    // Delete audio record (cascades to transcription via DB constraint)
    await audio.delete()

    return response.ok({
      message: i18n.t('messages.audio.deleted'),
    })
  }
}

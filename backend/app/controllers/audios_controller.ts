import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'
import AudioPolicy from '#policies/audio_policy'
import storageService from '#services/storage_service'
import exportService from '#services/export_service'
import {
  audioIndexValidator,
  audioBatchDeleteValidator,
  audioUpdateValidator,
  audioExportValidator,
} from '#validators/audio'

export default class AudiosController {
  /**
   * List all audios for the current organization.
   * Supports pagination, status filtering, search, and sorting.
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
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sort = 'createdAt',
      order = 'desc',
    } = await request.validateUsing(audioIndexValidator)

    // Build query with tenant isolation
    const query = Audio.query().where('organizationId', user.currentOrganizationId!)

    // Apply status filter if provided
    if (status) {
      query.where('status', status)
    }

    // Apply search filter if provided (search in title and fileName)
    if (search) {
      query.where((subQuery) => {
        subQuery
          .whereILike('title', `%${search}%`)
          .orWhereILike('fileName', `%${search}%`)
      })
    }

    // Apply sorting
    query.orderBy(sort, order)

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
   * Update an audio's metadata.
   *
   * PUT /api/audios/:id
   */
  async update({ params, request, response, bouncer, i18n }: HttpContext) {
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
    if (await bouncer.with(AudioPolicy).denies('updateAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.audio.access_denied'),
      })
    }

    // Validate request body
    const { title } = await request.validateUsing(audioUpdateValidator)

    // Update audio
    audio.title = title
    await audio.save()

    return response.ok({
      message: i18n.t('messages.audio.updated'),
      audio,
    })
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

  /**
   * Delete multiple audios and their associated files.
   *
   * DELETE /api/audios/batch
   */
  async destroyMultiple({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Validate request body
    const { ids } = await request.validateUsing(audioBatchDeleteValidator)

    // Check authorization for listing (user must have current organization)
    if (await bouncer.with(AudioPolicy).denies('listAudios')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Fetch all audios to delete (only from user's current organization)
    const audios = await Audio.query()
      .whereIn('id', ids)
      .where('organizationId', user.currentOrganizationId!)

    if (audios.length === 0) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Delete files from storage and records
    let deletedCount = 0
    for (const audio of audios) {
      try {
        await storageService.deleteFile(audio.filePath)
      } catch (error) {
        console.error(`Failed to delete audio file: ${audio.filePath}`, error)
        // Continue with deletion even if file removal fails
      }

      await audio.delete()
      deletedCount++
    }

    return response.ok({
      message: i18n.t('messages.audio.batch_deleted', { count: deletedCount }),
      deletedCount,
    })
  }

  /**
   * Export audio transcription/analysis to various formats (PDF, DOCX, TXT, MD).
   *
   * POST /api/audios/:id/export
   */
  async export({ params, request, response, bouncer, i18n }: HttpContext) {
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

    // Validate request body
    const { format, content } = await request.validateUsing(audioExportValidator)

    try {
      // Generate export
      const result = await exportService.generate({
        audio,
        format,
        content,
        i18n,
      })

      // Set response headers
      const safeFilename = result.filename.replace(/[^\w.-]/g, '_')
      response.header('Content-Type', result.mimeType)
      response.header('Content-Disposition', `attachment; filename="${safeFilename}"`)
      response.header('Content-Length', result.buffer.length.toString())

      return response.send(result.buffer)
    } catch (error) {
      console.error('Export generation failed:', error)
      return response.internalServerError({
        message:
          error instanceof Error ? error.message : i18n.t('messages.export.generation_failed'),
      })
    }
  }
}

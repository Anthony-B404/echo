import type { HttpContext } from '@adonisjs/core/http'
import shareService from '#services/share_service'
import exportService from '#services/export_service'
import storageService from '#services/storage_service'

export default class SharedAudioController {
  /**
   * Get shared audio data (public endpoint)
   * GET /shared/:identifier
   */
  public async show({ response, params, i18n }: HttpContext) {
    const { identifier } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(identifier)) {
      return response.badRequest({
        message: i18n.t('messages.share.invalid_link'),
      })
    }

    const share = await shareService.getByIdentifier(identifier)

    if (!share) {
      return response.notFound({
        message: i18n.t('messages.share.not_found'),
      })
    }

    const audio = share.audio

    // Build response with only necessary data
    return response.ok({
      share: {
        id: share.id,
        identifier: share.identifier,
        sharedWithEmail: share.sharedWithEmail,
        accessCount: share.accessCount,
        createdAt: share.createdAt,
        sharedBy: {
          fullName: share.sharedBy?.fullName,
          firstName: share.sharedBy?.firstName,
        },
      },
      audio: {
        id: audio.id,
        title: audio.title,
        fileName: audio.fileName,
        duration: audio.duration,
        fileSize: audio.fileSize,
        createdAt: audio.createdAt,
        status: audio.status,
        transcription: audio.transcription
          ? {
              rawText: audio.transcription.rawText,
              analysis: audio.transcription.analysis,
              language: audio.transcription.language,
              confidence: audio.transcription.confidence,
              timestamps: audio.transcription.timestamps,
            }
          : null,
      },
    })
  }

  /**
   * Export shared audio (public endpoint)
   * GET /shared/:identifier/export?format=pdf&content=both
   */
  public async export({ response, params, request, i18n }: HttpContext) {
    const { identifier } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(identifier)) {
      return response.badRequest({
        message: i18n.t('messages.share.invalid_link'),
      })
    }

    const share = await shareService.getByIdentifierForExport(identifier)

    if (!share) {
      return response.notFound({
        message: i18n.t('messages.share.not_found'),
      })
    }

    const audio = share.audio

    // Get format and content from query params (with defaults for backward compatibility)
    const format = (request.input('format', 'pdf') as 'pdf' | 'docx' | 'txt' | 'md') || 'pdf'
    const content =
      (request.input('content', 'both') as 'transcription' | 'analysis' | 'both') || 'both'

    // Validate format
    const validFormats = ['pdf', 'docx', 'txt', 'md']
    if (!validFormats.includes(format)) {
      return response.badRequest({
        message: i18n.t('messages.export.invalid_format'),
      })
    }

    // Check if audio has content to export based on selected content
    const hasTranscription = !!audio.transcription?.rawText
    const hasAnalysis = !!audio.transcription?.analysis

    if (content === 'transcription' && !hasTranscription) {
      return response.badRequest({
        message: i18n.t('messages.share.no_content'),
      })
    }
    if (content === 'analysis' && !hasAnalysis) {
      return response.badRequest({
        message: i18n.t('messages.share.no_content'),
      })
    }
    if (content === 'both' && !hasTranscription && !hasAnalysis) {
      return response.badRequest({
        message: i18n.t('messages.share.no_content'),
      })
    }

    try {
      // Generate export with specified format and content
      const result = await exportService.generate({
        audio,
        format,
        content,
        i18n,
      })

      // Set response headers for file download
      response.header('Content-Type', result.mimeType)
      response.header('Content-Disposition', `attachment; filename="${result.filename}"`)
      response.header('Content-Length', result.buffer.length.toString())

      return response.send(result.buffer)
    } catch (error) {
      console.error('Error exporting shared audio:', error)
      return response.internalServerError({
        message: i18n.t('messages.export.generation_failed'),
      })
    }
  }

  /**
   * Stream shared audio file (public endpoint)
   * GET /shared/:identifier/audio
   */
  public async audio({ response, params, i18n }: HttpContext) {
    const { identifier } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(identifier)) {
      return response.badRequest({
        message: i18n.t('messages.share.invalid_link'),
      })
    }

    const share = await shareService.getByIdentifierForExport(identifier)

    if (!share) {
      return response.notFound({
        message: i18n.t('messages.share.not_found'),
      })
    }

    const audio = share.audio

    // Check if file exists
    const exists = await storageService.fileExists(audio.filePath)
    if (!exists) {
      return response.notFound({
        message: i18n.t('messages.audio.file_not_found'),
      })
    }

    // Stream the file
    const stream = await storageService.getFileStream(audio.filePath)

    // Set appropriate headers
    const mimeType = audio.mimeType || 'audio/mpeg'
    const safeFileName = (audio.fileName || 'audio.mp3').replace(/[^\w.-]/g, '_')

    response.header('Content-Type', mimeType)
    response.header('Content-Disposition', `inline; filename="${safeFileName}"`)
    response.header('Accept-Ranges', 'bytes')

    return response.stream(stream)
  }
}

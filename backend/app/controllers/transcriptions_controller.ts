import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'
import AudioPolicy from '#policies/audio_policy'
import { TranscriptionVersionField } from '#models/transcription_version'
import transcriptionVersionService from '#services/transcription_version_service'
import {
  transcriptionEditValidator,
  transcriptionHistoryValidator,
  transcriptionDiffValidator,
} from '#validators/transcription'

export default class TranscriptionsController {
  /**
   * Update (edit) a transcription field with conflict detection
   * PUT /api/audios/:id/transcription
   */
  async update({ params, request, response, bouncer, auth, i18n }: HttpContext) {
    // Validate ID parameter
    const audioId = Number(params.id)
    if (!Number.isInteger(audioId) || audioId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    // Find audio
    const audio = await Audio.find(audioId)
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

    // Load transcription
    await audio.load('transcription')
    if (!audio.transcription) {
      return response.notFound({
        message: i18n.t('messages.transcription.not_found'),
      })
    }

    // Validate request body
    const data = await request.validateUsing(transcriptionEditValidator)

    // Map field name to enum
    const fieldName =
      data.field === 'raw_text'
        ? TranscriptionVersionField.RawText
        : TranscriptionVersionField.Analysis

    // Attempt edit with optimistic locking
    const result = await transcriptionVersionService.editField(
      audio.transcription,
      fieldName,
      data.content,
      data.expectedVersion,
      auth.user!,
      data.changeSummary
    )

    if (!result.success && result.conflict) {
      return response.conflict({
        code: 'EDIT_CONFLICT',
        message: i18n.t('messages.transcription.edit_conflict'),
        conflict: {
          currentVersion: result.conflict.currentVersion,
          lastEditedBy: result.conflict.lastEditedBy
            ? {
                id: result.conflict.lastEditedBy.id,
                fullName: result.conflict.lastEditedBy.fullName,
                email: result.conflict.lastEditedBy.email,
              }
            : null,
          lastEditedAt: result.conflict.lastEditedAt?.toISO(),
        },
      })
    }

    // Reload the audio with updated transcription for response
    await audio.refresh()
    await audio.load('transcription', (transcriptionQuery) => {
      transcriptionQuery.preload('lastEditedByUser')
    })

    return response.ok({
      message: i18n.t('messages.transcription.updated'),
      audio,
      version: result.version
        ? {
            id: result.version.id,
            versionNumber: result.version.versionNumber,
            fieldName: result.version.fieldName,
            changeSummary: result.version.changeSummary,
            createdAt: result.version.createdAt.toISO(),
            user: {
              id: result.version.user.id,
              fullName: result.version.user.fullName,
            },
          }
        : null,
    })
  }

  /**
   * Get version history for a transcription
   * GET /api/audios/:id/transcription/history
   */
  async history({ params, request, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const audioId = Number(params.id)
    if (!Number.isInteger(audioId) || audioId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    // Find audio
    const audio = await Audio.find(audioId)
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

    // Load transcription
    await audio.load('transcription')
    if (!audio.transcription) {
      return response.notFound({
        message: i18n.t('messages.transcription.not_found'),
      })
    }

    // Validate query params
    const data = await request.validateUsing(transcriptionHistoryValidator)

    // Get field name if provided
    let fieldName: TranscriptionVersionField | undefined
    if (data.field) {
      fieldName =
        data.field === 'raw_text'
          ? TranscriptionVersionField.RawText
          : TranscriptionVersionField.Analysis
    }

    // Get history (returns SimplePaginator from Lucid)
    const paginator = await transcriptionVersionService.getHistory(
      audio.transcription.id,
      fieldName,
      data.page ?? 1,
      data.limit ?? 20
    )

    return response.ok({
      data: paginator.all().map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        fieldName: version.fieldName,
        changeSummary: version.changeSummary,
        preview: version.getPreview(100),
        wordCount: version.getWordCount(),
        createdAt: version.createdAt.toISO(),
        user: {
          id: version.user.id,
          fullName: version.user.fullName,
          email: version.user.email,
        },
      })),
      meta: {
        total: paginator.total,
        page: paginator.currentPage,
        limit: paginator.perPage,
      },
    })
  }

  /**
   * Get a specific version content
   * GET /api/audios/:id/transcription/version/:versionId
   */
  async showVersion({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameters
    const audioId = Number(params.id)
    const versionId = Number(params.versionId)
    if (!Number.isInteger(audioId) || audioId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }
    if (!Number.isInteger(versionId) || versionId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    // Find audio
    const audio = await Audio.find(audioId)
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

    // Load transcription
    await audio.load('transcription')
    if (!audio.transcription) {
      return response.notFound({
        message: i18n.t('messages.transcription.not_found'),
      })
    }

    // Get version
    const version = await transcriptionVersionService.getVersion(versionId)
    if (!version) {
      return response.notFound({
        message: i18n.t('messages.transcription.version_not_found'),
      })
    }

    // Verify version belongs to this transcription
    if (version.transcriptionId !== audio.transcription.id) {
      return response.notFound({
        message: i18n.t('messages.transcription.version_not_found'),
      })
    }

    return response.ok({
      id: version.id,
      versionNumber: version.versionNumber,
      fieldName: version.fieldName,
      content: version.content,
      changeSummary: version.changeSummary,
      wordCount: version.getWordCount(),
      createdAt: version.createdAt.toISO(),
      user: {
        id: version.user.id,
        fullName: version.user.fullName,
        email: version.user.email,
      },
    })
  }

  /**
   * Restore a previous version
   * POST /api/audios/:id/transcription/restore/:versionId
   */
  async restore({ params, response, bouncer, auth, i18n }: HttpContext) {
    // Validate ID parameters
    const audioId = Number(params.id)
    const versionId = Number(params.versionId)
    if (!Number.isInteger(audioId) || audioId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }
    if (!Number.isInteger(versionId) || versionId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    // Find audio
    const audio = await Audio.find(audioId)
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

    // Load transcription
    await audio.load('transcription')
    if (!audio.transcription) {
      return response.notFound({
        message: i18n.t('messages.transcription.not_found'),
      })
    }

    try {
      // Restore version
      const result = await transcriptionVersionService.restoreVersion(
        audio.transcription,
        versionId,
        auth.user!
      )

      // Reload the audio with updated transcription for response
      await audio.refresh()
      await audio.load('transcription', (transcriptionQuery) => {
        transcriptionQuery.preload('lastEditedByUser')
      })

      return response.ok({
        message: i18n.t('messages.transcription.restored'),
        audio,
        version: result.version
          ? {
              id: result.version.id,
              versionNumber: result.version.versionNumber,
              fieldName: result.version.fieldName,
              changeSummary: result.version.changeSummary,
              createdAt: result.version.createdAt.toISO(),
              user: {
                id: result.version.user.id,
                fullName: result.version.user.fullName,
              },
            }
          : null,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === 'Version not found' ||
          error.message === 'Version does not belong to this transcription'
        ) {
          return response.notFound({
            message: i18n.t('messages.transcription.version_not_found'),
          })
        }
      }
      throw error
    }
  }

  /**
   * Compare two versions
   * GET /api/audios/:id/transcription/diff
   */
  async diff({ params, request, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const audioId = Number(params.id)
    if (!Number.isInteger(audioId) || audioId <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    // Find audio
    const audio = await Audio.find(audioId)
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

    // Load transcription
    await audio.load('transcription')
    if (!audio.transcription) {
      return response.notFound({
        message: i18n.t('messages.transcription.not_found'),
      })
    }

    // Validate query params
    const data = await request.validateUsing(transcriptionDiffValidator)

    try {
      const result = await transcriptionVersionService.compareVersions(data.version1, data.version2)

      // Verify versions belong to this transcription
      if (result.version1.transcriptionId !== audio.transcription.id) {
        return response.notFound({
          message: i18n.t('messages.transcription.version_not_found'),
        })
      }

      return response.ok({
        field: result.field,
        version1: {
          id: result.version1.id,
          versionNumber: result.version1.versionNumber,
          content: result.version1.content,
          changeSummary: result.version1.changeSummary,
          wordCount: result.version1.getWordCount(),
          createdAt: result.version1.createdAt.toISO(),
          user: {
            id: result.version1.user.id,
            fullName: result.version1.user.fullName,
          },
        },
        version2: {
          id: result.version2.id,
          versionNumber: result.version2.versionNumber,
          content: result.version2.content,
          changeSummary: result.version2.changeSummary,
          wordCount: result.version2.getWordCount(),
          createdAt: result.version2.createdAt.toISO(),
          user: {
            id: result.version2.user.id,
            fullName: result.version2.user.fullName,
          },
        },
        diff: result.diff,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return response.notFound({
            message: i18n.t('messages.transcription.version_not_found'),
          })
        }
        if (error.message.includes('same transcription') || error.message.includes('same field')) {
          return response.badRequest({
            message: error.message,
          })
        }
      }
      throw error
    }
  }
}

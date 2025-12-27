import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'
import AudioShare from '#models/audio_share'
import AudioSharePolicy from '#policies/audio_share_policy'
import { shareAudioValidator } from '#validators/share'
import shareService from '#services/share_service'

export default class AudioSharesController {
  /**
   * Share an audio by email
   * POST /api/audios/:id/share
   */
  public async share({ request, response, auth, bouncer, params, i18n }: HttpContext) {
    const user = auth.user!

    // Load the audio
    const audio = await Audio.query()
      .where('id', params.id)
      .preload('transcription')
      .first()

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioSharePolicy).denies('shareAudio', audio)) {
      return response.forbidden({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    // Check if audio has content to share
    if (!audio.transcription?.rawText && !audio.transcription?.analysis) {
      return response.badRequest({
        message: i18n.t('messages.share.no_content'),
      })
    }

    // Validate request
    const payload = await request.validateUsing(shareAudioValidator)

    try {
      const result = await shareService.shareByEmail({
        audioId: audio.id,
        email: payload.email,
        userId: user.id,
        i18n,
      })

      return response.created({
        message: result.message,
        share: result.share,
      })
    } catch (error) {
      console.error('Error sharing audio:', error)
      return response.internalServerError({
        message: i18n.t('messages.share.send_error'),
      })
    }
  }

  /**
   * List shares for an audio
   * GET /api/audios/:id/shares
   */
  public async index({ response, bouncer, params, i18n }: HttpContext) {
    // Load the audio
    const audio = await Audio.find(params.id)

    if (!audio) {
      return response.notFound({
        message: i18n.t('messages.audio.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioSharePolicy).denies('listShares', audio)) {
      return response.forbidden({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    const shares = await shareService.listByAudioId(audio.id)

    return response.ok({
      shares,
    })
  }

  /**
   * Revoke (delete) a share
   * DELETE /api/shares/:id
   */
  public async destroy({ response, bouncer, params, i18n }: HttpContext) {
    const share = await AudioShare.find(params.id)

    if (!share) {
      return response.notFound({
        message: i18n.t('messages.share.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(AudioSharePolicy).denies('revokeShare', share)) {
      return response.forbidden({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    await shareService.revokeShare(share.id)

    return response.ok({
      message: i18n.t('messages.share.revoked'),
    })
  }
}

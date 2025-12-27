import type { I18n } from '@adonisjs/i18n'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import Audio from '#models/audio'
import AudioShare from '#models/audio_share'
import User from '#models/user'
import exportService from './export_service.js'

export interface ShareByEmailOptions {
  audioId: number
  email: string
  userId: number
  i18n: I18n
}

export interface ShareResult {
  share: AudioShare
  message: string
}

/**
 * Service for managing audio sharing functionality.
 * Handles sharing audios via email with PDF attachments.
 */
class ShareService {
  /**
   * Share an audio by email with PDF attachment
   */
  async shareByEmail(options: ShareByEmailOptions): Promise<ShareResult> {
    const { audioId, email, userId, i18n } = options

    // Load audio with transcription
    const audio = await Audio.query()
      .where('id', audioId)
      .preload('transcription')
      .firstOrFail()

    // Load the user who is sharing
    const sharedByUser = await User.findOrFail(userId)

    // Check if share already exists for this audio-email combination
    let share = await AudioShare.query()
      .where('audioId', audioId)
      .where('sharedWithEmail', email)
      .first()

    if (share) {
      // Share already exists, we'll resend the email
      // No need to create a new share
    } else {
      // Create new share
      share = await AudioShare.create({
        audioId,
        sharedByUserId: userId,
        sharedWithEmail: email,
        accessCount: 0,
      })
    }

    // Generate PDF with analysis only (summary)
    const exportResult = await exportService.generate({
      audio,
      format: 'pdf',
      content: 'analysis',
      i18n,
    })

    // Build public share URL
    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const shareUrl = `${frontendUrl}/shared/${share.identifier}`

    // Get sender name
    const senderName = sharedByUser.fullName || sharedByUser.firstName || sharedByUser.email

    // Get audio title
    const audioTitle = audio.title || audio.fileName

    // Send email with PDF attachment
    await mail.send((message) => {
      message
        .to(email)
        .from('onboarding@resend.dev')
        .subject(i18n.t('emails.audio_share.subject', { senderName }))
        .htmlView('emails/audio_share', {
          senderName,
          audioTitle,
          shareUrl,
          i18n,
        })
        .attachData(exportResult.buffer, {
          filename: exportResult.filename,
          contentType: exportResult.mimeType,
        })
    })

    return {
      share,
      message: i18n.t('messages.share.sent_success'),
    }
  }

  /**
   * Get a share by its public identifier
   * Also increments the access count
   */
  async getByIdentifier(identifier: string): Promise<AudioShare | null> {
    const share = await AudioShare.query()
      .where('identifier', identifier)
      .preload('audio', (query) => {
        query.preload('transcription')
      })
      .preload('sharedBy')
      .first()

    if (share) {
      await share.incrementAccessCount()
    }

    return share
  }

  /**
   * Get a share by its public identifier without incrementing count
   * Used for export operations
   */
  async getByIdentifierForExport(identifier: string): Promise<AudioShare | null> {
    return AudioShare.query()
      .where('identifier', identifier)
      .preload('audio', (query) => {
        query.preload('transcription')
      })
      .first()
  }

  /**
   * List all shares for an audio
   */
  async listByAudioId(audioId: number): Promise<AudioShare[]> {
    return AudioShare.query()
      .where('audioId', audioId)
      .preload('sharedBy')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Revoke (delete) a share
   */
  async revokeShare(shareId: number): Promise<void> {
    const share = await AudioShare.findOrFail(shareId)
    await share.delete()
  }
}

export default new ShareService()

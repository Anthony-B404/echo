import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User from '#models/user'
import Audio from '#models/audio'
import AudioShare from '#models/audio_share'

export default class AudioSharePolicy extends BasePolicy {
  /**
   * Check if user can share an audio
   *
   * Permission rules:
   * - Audio must belong to user's current organization
   */
  public async shareAudio(user: User, audio: Audio): Promise<AuthorizerResponse> {
    return user.currentOrganizationId === audio.organizationId
  }

  /**
   * Check if user can list shares for an audio
   *
   * Permission rules:
   * - Audio must belong to user's current organization
   */
  public async listShares(user: User, audio: Audio): Promise<AuthorizerResponse> {
    return user.currentOrganizationId === audio.organizationId
  }

  /**
   * Check if user can revoke a share
   *
   * Permission rules:
   * - User must be the one who created the share
   */
  public async revokeShare(user: User, share: AudioShare): Promise<AuthorizerResponse> {
    return user.id === share.sharedByUserId
  }
}

import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User from '#models/user'
import Audio from '#models/audio'

export default class AudioPolicy extends BasePolicy {
  /**
   * Check if user can list audios
   *
   * Permission rules:
   * - User must have a current organization set
   */
  public async listAudios(user: User): Promise<AuthorizerResponse> {
    return user.currentOrganizationId !== null
  }

  /**
   * Check if user can view an audio
   *
   * Permission rules:
   * - Audio must belong to user's current organization
   */
  public async viewAudio(user: User, audio: Audio): Promise<AuthorizerResponse> {
    return user.currentOrganizationId === audio.organizationId
  }

  /**
   * Check if user can update an audio
   *
   * Permission rules:
   * - Audio must belong to user's current organization
   */
  public async updateAudio(user: User, audio: Audio): Promise<AuthorizerResponse> {
    return user.currentOrganizationId === audio.organizationId
  }

  /**
   * Check if user can delete an audio
   *
   * Permission rules:
   * - Audio must belong to user's current organization
   */
  public async deleteAudio(user: User, audio: Audio): Promise<AuthorizerResponse> {
    return user.currentOrganizationId === audio.organizationId
  }
}

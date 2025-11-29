import User, { UserRole } from '#models/user'
import Organization from '#models/organization'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class OrganizationPolicy extends BasePolicy {
  /**
   * Tout user authentifié peut créer une organisation
   */
  public async createOrganization(user: User): Promise<AuthorizerResponse> {
    return user !== null
  }

  /**
   * Vérifier si le user a accès à une organisation
   */
  public async viewOrganization(
    user: User,
    organization: Organization
  ): Promise<AuthorizerResponse> {
    return await user.hasOrganization(organization.id)
  }

  /**
   * Seul le owner peut obtenir la liste des users d'une organisation
   */
  public async getOrganizationWithUsers(
    user: User,
    organization: Organization
  ): Promise<AuthorizerResponse> {
    return await user.isOwnerOf(organization.id)
  }

  /**
   * Seul le owner peut modifier une organisation
   */
  public async updateOrganization(
    user: User,
    organization: Organization
  ): Promise<AuthorizerResponse> {
    return await user.isOwnerOf(organization.id)
  }

  /**
   * Seul le owner peut supprimer une organisation
   */
  public async deleteOrganization(
    user: User,
    organization: Organization
  ): Promise<AuthorizerResponse> {
    return await user.isOwnerOf(organization.id)
  }
}

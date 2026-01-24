import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User, { UserRole } from '#models/user'
import CreditRequest, { CreditRequestType } from '#models/credit_request'

export default class CreditRequestPolicy extends BasePolicy {
  /**
   * Helper to get user's role in the organization
   */
  private async getUserRoleInOrg(user: User, organizationId: number): Promise<number | null> {
    await user.load('organizations')
    const org = user.organizations.find((o) => o.id === organizationId)
    return org?.$extras.pivot_role ?? null
  }

  /**
   * Check if user can create a credit request (member to owner)
   * All members can create requests in individual mode
   */
  public async create(user: User, organizationId: number): Promise<AuthorizerResponse> {
    return user.hasOrganization(organizationId)
  }

  /**
   * Check if user can create a request to reseller (owner to reseller)
   * Only Owner can request from reseller
   */
  public async createToReseller(user: User, organizationId: number): Promise<AuthorizerResponse> {
    return user.isOwnerOf(organizationId)
  }

  /**
   * Check if user can view their own requests
   */
  public async viewOwn(user: User, request: CreditRequest): Promise<AuthorizerResponse> {
    return request.requesterId === user.id
  }

  /**
   * Check if user can view pending requests in their organization
   * Only Owner can view pending member requests
   */
  public async viewPending(user: User, organizationId: number): Promise<AuthorizerResponse> {
    return user.isOwnerOf(organizationId)
  }

  /**
   * Check if user can approve a member-to-owner request
   * Only Owner can approve
   */
  public async approve(user: User, request: CreditRequest): Promise<AuthorizerResponse> {
    if (request.type !== CreditRequestType.MemberToOwner) {
      return false
    }
    return user.isOwnerOf(request.organizationId)
  }

  /**
   * Check if user can reject a member-to-owner request
   * Only Owner can reject
   */
  public async reject(user: User, request: CreditRequest): Promise<AuthorizerResponse> {
    if (request.type !== CreditRequestType.MemberToOwner) {
      return false
    }
    return user.isOwnerOf(request.organizationId)
  }

  /**
   * Check if user can view all requests in the organization (for admins)
   * Owner and Administrator can view
   */
  public async viewAll(user: User, organizationId: number): Promise<AuthorizerResponse> {
    const role = await this.getUserRoleInOrg(user, organizationId)
    if (!role) return false
    return role === UserRole.Owner || role === UserRole.Administrator
  }
}

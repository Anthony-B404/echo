import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User, { UserRole } from '#models/user'

export default class MemberPolicy extends BasePolicy {
  /**
   * Helper to get user's role in the organization
   */
  private async getUserRoleInOrg(user: User, organizationId: number): Promise<number | null> {
    await user.load('organizations')
    const org = user.organizations.find((o) => o.id === organizationId)
    return org?.$extras.pivot_role ?? null
  }

  /**
   * Check if user can manage (edit/delete) a member
   *
   * Permission rules:
   * - Owner can manage everyone except themselves
   * - Admin can only manage Members (role=3), not Owner, themselves, or other Admins
   * - Member cannot manage anyone
   */
  public async manageMember(
    user: User,
    targetUser: User,
    organizationId: number
  ): Promise<AuthorizerResponse> {
    // Cannot manage yourself
    if (user.id === targetUser.id) {
      return false
    }

    const currentUserRole = await this.getUserRoleInOrg(user, organizationId)
    const targetUserRole = await this.getUserRoleInOrg(targetUser, organizationId)

    // User must belong to the organization
    if (!currentUserRole || !targetUserRole) {
      return false
    }

    // Owner can manage anyone except themselves (already checked above)
    if (currentUserRole === UserRole.Owner) {
      // Cannot manage the Owner (there shouldn't be another owner, but safety check)
      if (targetUserRole === UserRole.Owner) {
        return false
      }
      return true
    }

    // Administrator can only manage Members
    if (currentUserRole === UserRole.Administrator) {
      return targetUserRole === UserRole.Member
    }

    // Members cannot manage anyone
    return false
  }

  /**
   * Check if user can change a member's role
   *
   * Permission rules:
   * - Owner can change anyone's role except themselves
   * - Admin can change Member's role (including promotion to Admin)
   * - Admin cannot change Owner's or other Admin's roles
   * - Member cannot change anyone's role
   */
  public async changeRole(
    user: User,
    targetUser: User,
    organizationId: number,
    newRole: number
  ): Promise<AuthorizerResponse> {
    // Cannot change your own role
    if (user.id === targetUser.id) {
      return false
    }

    // Cannot change to Owner role
    if (newRole === UserRole.Owner) {
      return false
    }

    const currentUserRole = await this.getUserRoleInOrg(user, organizationId)
    const targetUserRole = await this.getUserRoleInOrg(targetUser, organizationId)

    // User must belong to the organization
    if (!currentUserRole || !targetUserRole) {
      return false
    }

    // Owner can change anyone's role (except to Owner, already checked)
    if (currentUserRole === UserRole.Owner) {
      // Cannot change the Owner's role
      if (targetUserRole === UserRole.Owner) {
        return false
      }
      return true
    }

    // Administrator can only change Member's role
    if (currentUserRole === UserRole.Administrator) {
      // Admin can promote Member to Admin or keep as Member
      // Admin cannot change Owner's role or other Admin's role
      return targetUserRole === UserRole.Member
    }

    // Members cannot change anyone's role
    return false
  }

  /**
   * Check if user can delete a member from the organization
   *
   * Same rules as manageMember
   */
  public async deleteMember(
    user: User,
    targetUser: User,
    organizationId: number
  ): Promise<AuthorizerResponse> {
    return this.manageMember(user, targetUser, organizationId)
  }
}

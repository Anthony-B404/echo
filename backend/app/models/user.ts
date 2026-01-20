import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Organization from './organization.js'
import type { ManyToMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Reseller from './reseller.js'

export enum UserRole {
  Owner = 1,
  Administrator = 2,
  Member = 3,
}

export type UserRoleType = 'super_admin' | 'reseller_admin' | 'organization_user'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare email: string

  @column()
  declare googleId: string | null

  @column()
  declare avatar: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column()
  declare currentOrganizationId: number | null

  @manyToMany(() => Organization, {
    pivotTable: 'organization_user',
    pivotColumns: ['role'],
  })
  declare organizations: ManyToMany<typeof Organization>

  @belongsTo(() => Organization, {
    foreignKey: 'currentOrganizationId',
  })
  declare currentOrganization: BelongsTo<typeof Organization>

  @column()
  declare onboardingCompleted: boolean

  @column()
  declare disabled: boolean

  @column()
  declare magicLinkToken: string | null

  @column.dateTime()
  declare magicLinkExpiresAt: DateTime | null

  @column.dateTime()
  declare lastInvitationSentAt: DateTime | null

  @column()
  declare pendingEmail: string | null

  @column()
  declare emailChangeToken: string | null

  @column.dateTime()
  declare emailChangeExpiresAt: DateTime | null

  @column()
  declare isSuperAdmin: boolean

  @column()
  declare resellerId: number | null

  declare isCurrentUser?: boolean

  @belongsTo(() => Reseller)
  declare reseller: BelongsTo<typeof Reseller>

  static accessTokens = DbAccessTokensProvider.forModel(User)

  /**
   * Check if user is owner of a specific organization
   */
  async isOwnerOf(organizationId: number): Promise<boolean> {
    if (!this.$preloaded.organizations) {
      // @ts-expect-error - Lucid relation loading type issue
      await this.load('organizations')
    }
    const org = this.organizations.find((o) => o.id === organizationId)
    return org?.$extras.pivot_role === UserRole.Owner
  }

  /**
   * Check if user has access to a specific organization
   */
  async hasOrganization(organizationId: number): Promise<boolean> {
    if (!this.$preloaded.organizations) {
      // @ts-expect-error - Lucid relation loading type issue
      await this.load('organizations')
    }
    return this.organizations.some((o) => o.id === organizationId)
  }

  /**
   * Get the role type of the user in the system hierarchy
   * - super_admin: System administrator (DH-Echo)
   * - reseller_admin: Reseller administrator
   * - organization_user: Regular organization member
   */
  get roleType(): UserRoleType {
    if (this.isSuperAdmin) {
      return 'super_admin'
    }
    if (this.resellerId) {
      return 'reseller_admin'
    }
    return 'organization_user'
  }

  /**
   * Check if user is a reseller admin
   */
  isResellerAdmin(): boolean {
    return this.resellerId !== null && !this.isSuperAdmin
  }

  /**
   * Check if invitation can be resent (5 minute cooldown)
   */
  canResendInvitation(): boolean {
    if (!this.lastInvitationSentAt) {
      return true
    }
    const cooldownMinutes = 5
    const cooldownEnd = this.lastInvitationSentAt.plus({ minutes: cooldownMinutes })
    return DateTime.now() >= cooldownEnd
  }

  /**
   * Get remaining seconds until invitation can be resent
   * Returns 0 if resend is allowed
   */
  getResendCooldownSeconds(): number {
    if (!this.lastInvitationSentAt) {
      return 0
    }
    const cooldownMinutes = 5
    const cooldownEnd = this.lastInvitationSentAt.plus({ minutes: cooldownMinutes })
    const diff = cooldownEnd.diff(DateTime.now(), 'seconds').seconds
    return Math.max(0, Math.ceil(diff))
  }
}

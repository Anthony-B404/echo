import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Organization from './organization.js'
import type { ManyToMany, BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'

export enum UserRole {
  Owner = 1,
  Administrator = 2,
  Member = 3,
}

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

  @hasOne(() => Subscription)
  declare subscription: HasOne<typeof Subscription>

  @column()
  declare onboardingCompleted: boolean

  @column()
  declare disabled: boolean

  @column()
  declare magicLinkToken: string | null

  @column.dateTime()
  declare magicLinkExpiresAt: DateTime | null

  @column()
  declare pendingEmail: string | null

  @column()
  declare emailChangeToken: string | null

  @column.dateTime()
  declare emailChangeExpiresAt: DateTime | null

  @column.dateTime()
  declare trialStartedAt: DateTime | null

  @column.dateTime()
  declare trialEndsAt: DateTime | null

  @column()
  declare trialUsed: boolean

  declare isCurrentUser?: boolean

  static accessTokens = DbAccessTokensProvider.forModel(User)

  /**
   * Check if user is owner of a specific organization
   */
  async isOwnerOf(organizationId: number): Promise<boolean> {
    await this.load('organizations')
    const org = this.organizations.find((o) => o.id === organizationId)
    return org?.$extras.pivot_role === UserRole.Owner
  }

  /**
   * Check if user has access to a specific organization
   */
  async hasOrganization(organizationId: number): Promise<boolean> {
    await this.load('organizations')
    return this.organizations.some((o) => o.id === organizationId)
  }

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    await this.load('subscription')
    return this.subscription?.isActive() ?? false
  }

  /**
   * Check if user is currently on trial
   */
  isOnTrial(): boolean {
    if (!this.trialEndsAt) return false
    return DateTime.now() < this.trialEndsAt
  }

  /**
   * Get number of trial days remaining
   */
  getTrialDaysRemaining(): number {
    if (!this.trialEndsAt) return 0
    const diff = this.trialEndsAt.diff(DateTime.now(), 'days').days
    return Math.max(0, Math.ceil(diff))
  }

  /**
   * Check if trial has expired
   */
  isTrialExpired(): boolean {
    if (!this.trialUsed) return false
    if (!this.trialEndsAt) return false
    return DateTime.now() >= this.trialEndsAt
  }

  /**
   * Check if user has access (either on trial or has active subscription)
   */
  async hasAccess(): Promise<boolean> {
    if (this.isOnTrial()) return true
    return await this.hasActiveSubscription()
  }

  /**
   * Get the organization owner's access status for the current organization
   * Used to check if a member should have access based on the owner's subscription
   */
  async getOrganizationOwnerAccess(): Promise<{ hasAccess: boolean; owner: User | null }> {
    if (!this.currentOrganizationId) {
      return { hasAccess: false, owner: null }
    }

    await this.load('currentOrganization')
    const owner = await this.currentOrganization.getOwner()

    if (!owner) {
      return { hasAccess: false, owner: null }
    }

    const ownerHasAccess = await owner.hasAccess()
    return { hasAccess: ownerHasAccess, owner }
  }
}

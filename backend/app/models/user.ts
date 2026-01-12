import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Organization from './organization.js'
import type { ManyToMany, BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import CreditTransaction, { CreditTransactionType } from './credit_transaction.js'
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

  @column()
  declare pendingEmail: string | null

  @column()
  declare emailChangeToken: string | null

  @column.dateTime()
  declare emailChangeExpiresAt: DateTime | null

  @column()
  declare credits: number

  @column()
  declare isSuperAdmin: boolean

  @column()
  declare resellerId: number | null

  declare isCurrentUser?: boolean

  @hasMany(() => CreditTransaction)
  declare creditTransactions: HasMany<typeof CreditTransaction>

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
   * Check if user has enough credits for an operation
   */
  hasEnoughCredits(amount: number): boolean {
    return this.credits >= amount
  }

  /**
   * Deduct credits from user and create a transaction record
   */
  async deductCredits(
    amount: number,
    description: string,
    audioId?: number
  ): Promise<CreditTransaction> {
    if (!this.hasEnoughCredits(amount)) {
      throw new Error('Insufficient credits')
    }

    this.credits -= amount
    await this.save()

    const transaction = await CreditTransaction.create({
      userId: this.id,
      amount: -amount,
      balanceAfter: this.credits,
      type: CreditTransactionType.Usage,
      description,
      audioId: audioId || null,
    })

    return transaction
  }

  /**
   * Add credits to user (for purchases, bonuses, refunds)
   */
  async addCredits(
    amount: number,
    type: CreditTransactionType,
    description: string
  ): Promise<CreditTransaction> {
    this.credits += amount
    await this.save()

    const transaction = await CreditTransaction.create({
      userId: this.id,
      amount: amount,
      balanceAfter: this.credits,
      type,
      description,
    })

    return transaction
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
}

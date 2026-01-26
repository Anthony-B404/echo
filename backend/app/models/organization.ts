import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User, { UserRole } from './user.js'
import Invitation from './invitation.js'
import Reseller from './reseller.js'
import CreditTransaction, { CreditTransactionType } from './credit_transaction.js'
import UserCredit from './user_credit.js'
import UserCreditTransaction from './user_credit_transaction.js'

export type CreditMode = 'shared' | 'individual'

export type RenewalType = 'first_of_month' | 'anniversary'

export type BusinessSector = 'psychology' | 'finance' | 'legal' | 'sales' | 'hr'

export const BUSINESS_SECTORS: BusinessSector[] = ['psychology', 'finance', 'legal', 'sales', 'hr']

export enum OrganizationStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

/**
 * Number of days before soft-deleted organizations are purged (GDPR compliance)
 */
export const PURGE_DELAY_DAYS = 30

export default class Organization extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare logo: string | null

  @column()
  declare email: string

  @column()
  declare resellerId: number | null

  @column()
  declare credits: number

  @column()
  declare creditMode: CreditMode

  // Subscription fields
  @column()
  declare subscriptionEnabled: boolean

  @column()
  declare monthlyCreditsTarget: number | null

  @column()
  declare renewalType: RenewalType | null

  @column()
  declare renewalDay: number | null

  @column.dateTime()
  declare subscriptionCreatedAt: DateTime | null

  @column.dateTime()
  declare subscriptionPausedAt: DateTime | null

  @column.dateTime()
  declare lastRenewalAt: DateTime | null

  @column.dateTime()
  declare nextRenewalAt: DateTime | null

  // Global auto-refill toggle (for individual credit mode)
  // When enabled, creates/updates user_credit records for all members
  @column()
  declare autoRefillEnabled: boolean

  // Default amount and day for new members when global auto-refill is active
  @column()
  declare autoRefillDefaultAmount: number | null

  @column()
  declare autoRefillDefaultDay: number | null

  // Status fields
  @column()
  declare status: OrganizationStatus

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column.dateTime()
  declare suspendedAt: DateTime | null

  @column()
  declare suspensionReason: string | null

  @column({
    prepare: (value: BusinessSector[]) => JSON.stringify(value),
    consume: (value: string) => (typeof value === 'string' ? JSON.parse(value) : value || []),
  })
  declare businessSectors: BusinessSector[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships

  @manyToMany(() => User, {
    pivotTable: 'organization_user',
    pivotColumns: ['role'],
  })
  declare users: ManyToMany<typeof User>

  @hasMany(() => Invitation)
  declare invitations: HasMany<typeof Invitation>

  @belongsTo(() => Reseller)
  declare reseller: BelongsTo<typeof Reseller>

  @hasMany(() => UserCredit)
  declare userCredits: HasMany<typeof UserCredit>

  @hasMany(() => UserCreditTransaction)
  declare userCreditTransactions: HasMany<typeof UserCreditTransaction>

  @hasMany(() => CreditTransaction)
  declare creditTransactions: HasMany<typeof CreditTransaction>

  // Methods

  /**
   * Check if organization uses shared credit mode (pool commun)
   */
  isSharedMode(): boolean {
    return this.creditMode === 'shared'
  }

  /**
   * Check if organization uses individual credit mode (distribution individuelle)
   */
  isIndividualMode(): boolean {
    return this.creditMode === 'individual'
  }

  /**
   * Check if global auto-refill is fully configured and active
   * Returns true only if:
   * - Organization is in individual mode
   * - autoRefillEnabled is true
   * - Both defaultAmount and defaultDay are set
   */
  get isGlobalAutoRefillActive(): boolean {
    return (
      this.isIndividualMode() &&
      this.autoRefillEnabled &&
      this.autoRefillDefaultAmount !== null &&
      this.autoRefillDefaultDay !== null
    )
  }

  /**
   * Get the owner of this organization
   */
  async getOwner(): Promise<User | null> {
    if (!this.$preloaded.users) {
      // @ts-expect-error - Lucid relation loading type issue
      await this.load('users')
    }
    return this.users.find((u) => u.$extras.pivot_role === UserRole.Owner) ?? null
  }

  /**
   * Check if organization has enough credits for an operation
   */
  hasEnoughCredits(amount: number): boolean {
    return this.credits >= amount
  }

  /**
   * Deduct credits from organization and create a transaction record
   * This is called when audio is processed
   */
  async deductCredits(
    amount: number,
    description: string,
    userId: number,
    audioId?: number
  ): Promise<CreditTransaction> {
    if (!this.hasEnoughCredits(amount)) {
      throw new Error('Insufficient credits')
    }

    this.credits -= amount
    await this.save()

    const transaction = await CreditTransaction.create({
      userId,
      organizationId: this.id,
      amount: -amount,
      balanceAfter: this.credits,
      type: CreditTransactionType.Usage,
      description,
      audioId: audioId || null,
    })

    // Check if credits dropped below 100 and notify owner
    if (this.credits < 100) {
      const notificationService = await import('#services/notification_service')
      await notificationService.default.notifyLowCredits(this.id, this.credits)
    }

    return transaction
  }

  /**
   * Add credits to organization (from reseller distribution)
   *
   * @param amount - Amount of credits to add
   * @param type - Transaction type
   * @param description - Transaction description
   * @param userId - User who performed the action
   * @param existingTrx - Optional existing transaction to reuse (prevents deadlocks)
   */
  async addCredits(
    amount: number,
    type: CreditTransactionType,
    description: string,
    userId: number,
    existingTrx?: TransactionClientContract
  ): Promise<CreditTransaction> {
    this.credits += amount

    if (existingTrx) {
      await this.useTransaction(existingTrx).save()
    } else {
      await this.save()
    }

    const transaction = await CreditTransaction.create(
      {
        userId,
        organizationId: this.id,
        amount: amount,
        balanceAfter: this.credits,
        type,
        description,
      },
      existingTrx ? { client: existingTrx } : undefined
    )

    return transaction
  }

  // Subscription methods

  /**
   * Check if subscription is active (enabled and not paused)
   */
  get isSubscriptionActive(): boolean {
    return this.subscriptionEnabled && this.subscriptionPausedAt === null
  }

  /**
   * Calculate credits needed to reach the monthly target
   * Returns 0 if current credits are already at or above target
   */
  getCreditsNeededForRenewal(): number {
    if (!this.monthlyCreditsTarget) {
      return 0
    }
    return Math.max(0, this.monthlyCreditsTarget - this.credits)
  }

  /**
   * Calculate the next renewal date based on renewal type
   * @param fromDate Optional date to calculate from (defaults to now)
   */
  calculateNextRenewalDate(fromDate?: DateTime): DateTime | null {
    if (!this.renewalType) {
      return null
    }

    const now = fromDate || DateTime.now()

    if (this.renewalType === 'first_of_month') {
      // Next first day of month
      const nextMonth = now.plus({ months: 1 }).startOf('month')
      return nextMonth
    }

    if (this.renewalType === 'anniversary' && this.renewalDay) {
      // Next occurrence of the renewal day
      const currentDay = now.day
      const renewalDay = Math.min(this.renewalDay, 28) // Cap at 28 to avoid month issues

      if (currentDay < renewalDay) {
        // Renewal day is later this month
        return now.set({ day: renewalDay }).startOf('day')
      } else {
        // Renewal day has passed, move to next month
        const nextMonth = now.plus({ months: 1 })
        const maxDay = nextMonth.daysInMonth ?? 28
        return nextMonth.set({ day: Math.min(renewalDay, maxDay) }).startOf('day')
      }
    }

    return null
  }

  /**
   * Check if subscription is due for renewal
   */
  isDueForRenewal(): boolean {
    if (!this.isSubscriptionActive || !this.nextRenewalAt) {
      return false
    }
    return this.nextRenewalAt <= DateTime.now()
  }

  // Status getters

  /**
   * Check if organization is active
   */
  get isActive(): boolean {
    return this.status === OrganizationStatus.Active
  }

  /**
   * Check if organization is suspended
   */
  get isSuspended(): boolean {
    return this.status === OrganizationStatus.Suspended
  }

  /**
   * Check if organization is soft-deleted
   */
  get isDeleted(): boolean {
    return this.status === OrganizationStatus.Deleted
  }

  // Status management methods

  /**
   * Suspend the organization and pause any active subscription
   * @param reason Optional reason for suspension
   * @throws Error if organization is already suspended or deleted
   */
  async suspend(reason?: string): Promise<void> {
    if (this.status === OrganizationStatus.Suspended) {
      throw new Error('ALREADY_SUSPENDED')
    }
    if (this.status === OrganizationStatus.Deleted) {
      throw new Error('ORGANIZATION_DELETED')
    }

    this.status = OrganizationStatus.Suspended
    this.suspendedAt = DateTime.now()
    this.suspensionReason = reason || null

    // Pause subscription if active
    if (this.subscriptionEnabled && !this.subscriptionPausedAt) {
      this.subscriptionPausedAt = DateTime.now()
    }

    await this.save()
  }

  /**
   * Restore a suspended organization to active status
   * Note: Does NOT automatically resume subscription - that should be done explicitly
   * @throws Error if organization is not suspended (cannot restore deleted orgs)
   */
  async restore(): Promise<void> {
    if (this.status === OrganizationStatus.Active) {
      throw new Error('ALREADY_ACTIVE')
    }
    if (this.status === OrganizationStatus.Deleted) {
      throw new Error('CANNOT_RESTORE_DELETED')
    }

    this.status = OrganizationStatus.Active
    this.suspendedAt = null
    this.suspensionReason = null

    await this.save()
  }

  /**
   * Soft delete the organization (GDPR compliant - will be purged after PURGE_DELAY_DAYS)
   * @throws Error if organization is already deleted
   */
  async softDelete(): Promise<void> {
    if (this.status === OrganizationStatus.Deleted) {
      throw new Error('ALREADY_DELETED')
    }

    this.status = OrganizationStatus.Deleted
    this.deletedAt = DateTime.now()

    // Pause subscription if active
    if (this.subscriptionEnabled && !this.subscriptionPausedAt) {
      this.subscriptionPausedAt = DateTime.now()
    }

    await this.save()
  }

  /**
   * Get the number of days until this organization will be purged
   * Returns null if organization is not soft-deleted
   */
  getDaysUntilPurge(): number | null {
    if (!this.isDeleted || !this.deletedAt) {
      return null
    }

    const purgeDate = this.deletedAt.plus({ days: PURGE_DELAY_DAYS })
    const daysRemaining = Math.ceil(purgeDate.diff(DateTime.now(), 'days').days)

    return Math.max(0, daysRemaining)
  }
}

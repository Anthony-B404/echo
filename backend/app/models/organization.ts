import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import User, { UserRole } from './user.js'
import Invitation from './invitation.js'
import Reseller from './reseller.js'
import CreditTransaction, { CreditTransactionType } from './credit_transaction.js'
import type { ManyToMany, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'

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

  // Methods

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
   * NOTE: Phase 2 will add organization_id to credit_transactions
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

    // Note: organizationId will be added in Phase 2 migration
    const transaction = await CreditTransaction.create({
      userId,
      amount: -amount,
      balanceAfter: this.credits,
      type: CreditTransactionType.Usage,
      description,
      audioId: audioId || null,
    })

    return transaction
  }

  /**
   * Add credits to organization (from reseller distribution)
   * NOTE: Phase 2 will add organization_id to credit_transactions
   */
  async addCredits(
    amount: number,
    type: CreditTransactionType,
    description: string,
    userId: number
  ): Promise<CreditTransaction> {
    this.credits += amount
    await this.save()

    // Note: organizationId will be added in Phase 2 migration
    const transaction = await CreditTransaction.create({
      userId,
      amount: amount,
      balanceAfter: this.credits,
      type,
      description,
    })

    return transaction
  }
}

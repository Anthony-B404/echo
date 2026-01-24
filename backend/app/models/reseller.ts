import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Organization from './organization.js'
import ResellerTransaction, { ResellerTransactionType } from './reseller_transaction.js'
import User from './user.js'

/**
 * Custom error for insufficient credits
 */
export class InsufficientCreditsError extends Error {
  static readonly code = 'E_INSUFFICIENT_CREDITS'
  readonly code = InsufficientCreditsError.code

  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Insufficient credits: ${available} available, ${requested} requested`)
    this.name = 'InsufficientCreditsError'
  }
}

export default class Reseller extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare email: string

  @column()
  declare phone: string | null

  @column()
  declare company: string

  @column()
  declare siret: string | null

  @column()
  declare address: string | null

  @column()
  declare creditBalance: number

  @column()
  declare isActive: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships

  @hasMany(() => Organization)
  declare organizations: HasMany<typeof Organization>

  @hasMany(() => ResellerTransaction)
  declare transactions: HasMany<typeof ResellerTransaction>

  @hasMany(() => User)
  declare adminUsers: HasMany<typeof User>

  // Methods

  /**
   * Check if reseller has enough credits for a distribution
   */
  hasEnoughCredits(amount: number): boolean {
    return this.creditBalance >= amount
  }

  /**
   * Deduct credits from reseller pool and transfer to organization
   * Creates a distribution transaction record
   *
   * @param amount - Amount of credits to distribute
   * @param organizationId - Target organization ID
   * @param description - Transaction description
   * @param performedByUserId - User who performed the action
   * @param existingTrx - Optional existing transaction to reuse (prevents deadlocks)
   * @throws {InsufficientCreditsError} If reseller doesn't have enough credits
   */
  async distributeCredits(
    amount: number,
    organizationId: number,
    description: string,
    performedByUserId: number,
    existingTrx?: TransactionClientContract
  ): Promise<ResellerTransaction> {
    if (!this.hasEnoughCredits(amount)) {
      throw new InsufficientCreditsError(this.creditBalance, amount)
    }

    // If an existing transaction is provided, use it; otherwise create a new one
    const shouldCommit = !existingTrx
    const trx = existingTrx ?? (await db.transaction())

    try {
      this.creditBalance -= amount
      await this.useTransaction(trx).save()

      const transaction = await ResellerTransaction.create(
        {
          resellerId: this.id,
          amount: -amount,
          type: ResellerTransactionType.Distribution,
          targetOrganizationId: organizationId,
          description,
          performedByUserId,
        },
        { client: trx }
      )

      // Only commit if we created our own transaction
      if (shouldCommit) await trx.commit()
      return transaction
    } catch (error) {
      if (shouldCommit) await trx.rollback()
      throw error
    }
  }

  /**
   * Add credits to reseller pool (from Super Admin purchase)
   * Uses database transaction to ensure consistency
   */
  async addCredits(
    amount: number,
    description: string,
    performedByUserId: number
  ): Promise<ResellerTransaction> {
    const trx = await db.transaction()

    try {
      this.creditBalance += amount
      await this.useTransaction(trx).save()

      const transaction = await ResellerTransaction.create(
        {
          resellerId: this.id,
          amount: amount,
          type: ResellerTransactionType.Purchase,
          description,
          performedByUserId,
        },
        { client: trx }
      )

      await trx.commit()
      return transaction
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Adjust credits (for corrections, refunds, etc.)
   * Uses database transaction to ensure consistency
   */
  async adjustCredits(
    amount: number,
    description: string,
    performedByUserId: number
  ): Promise<ResellerTransaction> {
    const trx = await db.transaction()

    try {
      this.creditBalance += amount
      await this.useTransaction(trx).save()

      const transaction = await ResellerTransaction.create(
        {
          resellerId: this.id,
          amount: amount,
          type: ResellerTransactionType.Adjustment,
          description,
          performedByUserId,
        },
        { client: trx }
      )

      await trx.commit()
      return transaction
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}

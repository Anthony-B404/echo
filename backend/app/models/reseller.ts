import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Organization from './organization.js'
import ResellerTransaction, { ResellerTransactionType } from './reseller_transaction.js'
import User from './user.js'

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
   */
  async distributeCredits(
    amount: number,
    organizationId: number,
    description: string,
    performedByUserId: number
  ): Promise<ResellerTransaction> {
    if (!this.hasEnoughCredits(amount)) {
      throw new Error('Insufficient credits in reseller pool')
    }

    this.creditBalance -= amount
    await this.save()

    const transaction = await ResellerTransaction.create({
      resellerId: this.id,
      amount: -amount,
      type: ResellerTransactionType.Distribution,
      targetOrganizationId: organizationId,
      description,
      performedByUserId,
    })

    return transaction
  }

  /**
   * Add credits to reseller pool (from Super Admin purchase)
   */
  async addCredits(
    amount: number,
    description: string,
    performedByUserId: number
  ): Promise<ResellerTransaction> {
    this.creditBalance += amount
    await this.save()

    const transaction = await ResellerTransaction.create({
      resellerId: this.id,
      amount: amount,
      type: ResellerTransactionType.Purchase,
      description,
      performedByUserId,
    })

    return transaction
  }

  /**
   * Adjust credits (for corrections, refunds, etc.)
   */
  async adjustCredits(
    amount: number,
    description: string,
    performedByUserId: number
  ): Promise<ResellerTransaction> {
    this.creditBalance += amount
    await this.save()

    const transaction = await ResellerTransaction.create({
      resellerId: this.id,
      amount: amount,
      type: ResellerTransactionType.Adjustment,
      description,
      performedByUserId,
    })

    return transaction
  }
}

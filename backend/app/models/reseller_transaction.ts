import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Reseller from './reseller.js'
import Organization from './organization.js'
import User from './user.js'

export enum ResellerTransactionType {
  Purchase = 'purchase',
  Distribution = 'distribution',
  Adjustment = 'adjustment',
}

export default class ResellerTransaction extends BaseModel {
  public static table = 'reseller_transactions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare resellerId: number

  @column()
  declare amount: number

  @column()
  declare type: ResellerTransactionType

  @column()
  declare targetOrganizationId: number | null

  @column()
  declare description: string | null

  @column()
  declare performedByUserId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships

  @belongsTo(() => Reseller)
  declare reseller: BelongsTo<typeof Reseller>

  @belongsTo(() => Organization, {
    foreignKey: 'targetOrganizationId',
  })
  declare targetOrganization: BelongsTo<typeof Organization>

  @belongsTo(() => User, {
    foreignKey: 'performedByUserId',
  })
  declare performedBy: BelongsTo<typeof User>
}

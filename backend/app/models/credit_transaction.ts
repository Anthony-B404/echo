import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Audio from './audio.js'

export enum CreditTransactionType {
  Usage = 'usage',
  Purchase = 'purchase',
  Bonus = 'bonus',
  Refund = 'refund',
}

export default class CreditTransaction extends BaseModel {
  public static table = 'credit_transactions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare amount: number

  @column()
  declare balanceAfter: number

  @column()
  declare type: CreditTransactionType

  @column()
  declare description: string | null

  @column()
  declare audioId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Audio)
  declare audio: BelongsTo<typeof Audio>
}

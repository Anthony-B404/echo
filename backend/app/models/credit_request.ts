import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'
import Organization from './organization.js'
import Reseller from './reseller.js'

export enum CreditRequestType {
  MemberToOwner = 'member_to_owner',
  OwnerToReseller = 'owner_to_reseller',
}

export enum CreditRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export default class CreditRequest extends BaseModel {
  static table = 'credit_requests'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: CreditRequestType

  @column()
  declare requesterId: number

  @column()
  declare organizationId: number

  @column()
  declare resellerId: number | null

  @column()
  declare amount: number

  @column()
  declare justification: string | null

  @column()
  declare status: CreditRequestStatus

  @column()
  declare processedByUserId: number | null

  @column()
  declare rejectionReason: string | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'requesterId',
  })
  declare requester: BelongsTo<typeof User>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => Reseller)
  declare reseller: BelongsTo<typeof Reseller>

  @belongsTo(() => User, {
    foreignKey: 'processedByUserId',
  })
  declare processedBy: BelongsTo<typeof User>

  /**
   * Check if the request is still pending
   */
  isPending(): boolean {
    return this.status === CreditRequestStatus.Pending
  }

  /**
   * Check if the request has been processed
   */
  isProcessed(): boolean {
    return this.status !== CreditRequestStatus.Pending
  }
}

import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'
import Organization from './organization.js'

export enum NotificationType {
  CreditRequest = 'credit_request', // Member requests credits from Owner
  OwnerCreditRequest = 'owner_credit_request', // Owner requests credits from Reseller
  LowCredits = 'low_credits', // Organization credits below threshold
  InsufficientRefill = 'insufficient_refill', // Not enough credits for auto-refill
  ResellerDistribution = 'reseller_distribution', // Reseller distributed credits
  CreditsReceived = 'credits_received', // Member received credits from Owner
}

export interface NotificationData {
  // Common fields
  organizationId?: number
  organizationName?: string

  // Credit request related
  requestId?: number
  requesterId?: number
  requesterName?: string
  amount?: number
  justification?: string

  // Balance related
  balance?: number
  threshold?: number

  // Link for navigation
  link?: string
}

export default class Notification extends BaseModel {
  static table = 'notifications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare organizationId: number

  @column()
  declare type: NotificationType

  @column()
  declare title: string

  @column()
  declare message: string | null

  @column({
    prepare: (value: NotificationData | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | NotificationData | null) => {
      if (!value) return null
      // PostgreSQL JSONB returns already parsed objects
      if (typeof value === 'object') return value as NotificationData
      // Fallback for string values
      return JSON.parse(value) as NotificationData
    },
  })
  declare data: NotificationData | null

  @column()
  declare isRead: boolean

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  /**
   * Mark the notification as read
   */
  async markAsRead(): Promise<void> {
    if (!this.isRead) {
      this.isRead = true
      this.readAt = DateTime.now()
      await this.save()
    }
  }
}

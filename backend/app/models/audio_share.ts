import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import Audio from './audio.js'
import User from './user.js'

export default class AudioShare extends BaseModel {
  public static table = 'audio_shares'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare audioId: number

  @column()
  declare sharedByUserId: number

  @column()
  declare identifier: string

  @column()
  declare sharedWithEmail: string

  @column()
  declare accessCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships

  @belongsTo(() => Audio)
  declare audio: BelongsTo<typeof Audio>

  @belongsTo(() => User, {
    foreignKey: 'sharedByUserId',
  })
  declare sharedBy: BelongsTo<typeof User>

  // Hooks

  @beforeCreate()
  static generateIdentifier(share: AudioShare) {
    if (!share.identifier) {
      share.identifier = randomUUID()
    }
  }

  // Helper methods

  /**
   * Increment the access count
   */
  async incrementAccessCount(): Promise<void> {
    this.accessCount = (this.accessCount || 0) + 1
    await this.save()
  }
}

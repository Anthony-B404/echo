import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transcription from './transcription.js'
import User from './user.js'

/**
 * Supported fields that can be versioned
 */
export enum TranscriptionVersionField {
  RawText = 'raw_text',
  Analysis = 'analysis',
}

export default class TranscriptionVersion extends BaseModel {
  public static table = 'transcription_versions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transcriptionId: number

  @column()
  declare userId: number

  @column()
  declare versionNumber: number

  @column()
  declare fieldName: TranscriptionVersionField

  @column()
  declare content: string

  @column()
  declare changeSummary: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships

  @belongsTo(() => Transcription)
  declare transcription: BelongsTo<typeof Transcription>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * Get a preview of the content (first N characters)
   */
  getPreview(maxLength: number = 100): string {
    if (!this.content) return ''
    if (this.content.length <= maxLength) return this.content
    return this.content.substring(0, maxLength).trim() + '...'
  }

  /**
   * Get word count of this version's content
   */
  getWordCount(): number {
    if (!this.content) return 0
    return this.content.trim().split(/\s+/).filter(Boolean).length
  }
}

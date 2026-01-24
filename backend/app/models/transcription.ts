import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Audio from './audio.js'
import Document from './document.js'
import TranscriptionVersion from './transcription_version.js'
import User from './user.js'

/**
 * Timestamp segment for transcription with timing info
 */
export interface TranscriptionTimestamp {
  start: number // seconds
  end: number // seconds
  text: string
  speaker?: string // if diarization available
}

export default class Transcription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare audioId: number

  @column()
  declare rawText: string

  @column()
  declare language: string

  @column({
    prepare: (value: TranscriptionTimestamp[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: TranscriptionTimestamp[] | string | null) => {
      if (!value) return null
      // PostgreSQL with pg driver returns JSONB as objects already
      if (typeof value === 'object') return value
      return JSON.parse(value)
    },
  })
  declare timestamps: TranscriptionTimestamp[] | null

  @column()
  declare confidence: number | null

  @column()
  declare analysis: string | null

  // Version tracking fields
  @column()
  declare rawTextVersion: number

  @column()
  declare analysisVersion: number

  @column()
  declare lastEditedByUserId: number | null

  @column.dateTime()
  declare lastEditedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships

  @belongsTo(() => Audio)
  declare audio: BelongsTo<typeof Audio>

  @hasMany(() => Document)
  declare documents: HasMany<typeof Document>

  @hasMany(() => TranscriptionVersion)
  declare versions: HasMany<typeof TranscriptionVersion>

  @belongsTo(() => User, {
    foreignKey: 'lastEditedByUserId',
  })
  declare lastEditedByUser: BelongsTo<typeof User>

  // Helper methods

  /**
   * Get word count of the transcription
   */
  getWordCount(): number {
    if (!this.rawText) return 0
    return this.rawText.trim().split(/\s+/).filter(Boolean).length
  }

  /**
   * Get a preview of the transcription (first N characters)
   */
  getPreview(maxLength: number = 200): string {
    if (!this.rawText) return ''
    if (this.rawText.length <= maxLength) return this.rawText

    return this.rawText.substring(0, maxLength).trim() + '...'
  }

  /**
   * Check if timestamps are available
   */
  hasTimestamps(): boolean {
    return Array.isArray(this.timestamps) && this.timestamps.length > 0
  }

  /**
   * Get confidence as percentage string
   */
  getConfidencePercentage(): string {
    if (this.confidence === null) return 'N/A'
    return `${(this.confidence * 100).toFixed(1)}%`
  }
}

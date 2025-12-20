import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Audio from './audio.js'
import Document from './document.js'

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

  @column()
  declare timestamps: TranscriptionTimestamp[] | null

  @column()
  declare confidence: number | null

  @column()
  declare analysis: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relationships

  @belongsTo(() => Audio)
  declare audio: BelongsTo<typeof Audio>

  @hasMany(() => Document)
  declare documents: HasMany<typeof Document>

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

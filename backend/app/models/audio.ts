import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne, HasMany } from '@adonisjs/lucid/types/relations'
import Organization from './organization.js'
import User from './user.js'
import Transcription from './transcription.js'
import Document from './document.js'

export enum AudioStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export default class Audio extends BaseModel {
  public static table = 'audios'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organizationId: number

  @column()
  declare userId: number

  @column()
  declare title: string | null

  @column()
  declare fileName: string

  @column()
  declare filePath: string

  @column()
  declare fileSize: number

  @column()
  declare mimeType: string | null

  @column()
  declare duration: number | null

  @column()
  declare status: AudioStatus

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasOne(() => Transcription)
  declare transcription: HasOne<typeof Transcription>

  @hasMany(() => Document)
  declare documents: HasMany<typeof Document>

  // Helper methods

  /**
   * Check if audio processing is complete
   */
  isCompleted(): boolean {
    return this.status === AudioStatus.Completed
  }

  /**
   * Check if audio processing failed
   */
  isFailed(): boolean {
    return this.status === AudioStatus.Failed
  }

  /**
   * Check if audio is still being processed
   */
  isProcessing(): boolean {
    return this.status === AudioStatus.Processing
  }

  /**
   * Get formatted duration (mm:ss or hh:mm:ss)
   */
  getFormattedDuration(): string {
    if (!this.duration) return '00:00'

    const hours = Math.floor(this.duration / 3600)
    const minutes = Math.floor((this.duration % 3600) / 60)
    const seconds = this.duration % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  /**
   * Get file size in human-readable format
   */
  getFormattedFileSize(): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = this.fileSize
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

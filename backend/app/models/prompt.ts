import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Organization from './organization.js'
import PromptCategory from './prompt_category.js'

export default class Prompt extends BaseModel {
  public static table = 'prompts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organizationId: number

  @column()
  declare categoryId: number | null

  @column()
  declare title: string

  @column()
  declare content: string

  @column()
  declare isDefault: boolean

  @column()
  declare isFavorite: boolean

  @column()
  declare usageCount: number

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => PromptCategory, {
    foreignKey: 'categoryId',
  })
  declare category: BelongsTo<typeof PromptCategory>

  // Helper methods

  /**
   * Increment usage count
   */
  async incrementUsage(): Promise<void> {
    this.usageCount = (this.usageCount || 0) + 1
    await this.save()
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(): Promise<boolean> {
    this.isFavorite = !this.isFavorite
    await this.save()
    return this.isFavorite
  }

  /**
   * Get a preview of the content (first N characters)
   */
  getContentPreview(maxLength: number = 100): string {
    if (this.content.length <= maxLength) {
      return this.content
    }
    return this.content.substring(0, maxLength).trim() + '...'
  }
}

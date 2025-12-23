import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Organization from './organization.js'
import Prompt from './prompt.js'

export default class PromptCategory extends BaseModel {
  public static table = 'prompt_categories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organizationId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare color: string | null

  @column()
  declare icon: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isDefault: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @hasMany(() => Prompt, {
    foreignKey: 'categoryId',
  })
  declare prompts: HasMany<typeof Prompt>

  // Helper methods

  /**
   * Check if category has any prompts
   */
  async hasPrompts(): Promise<boolean> {
    await this.load('prompts')
    return this.prompts.length > 0
  }

  /**
   * Get prompts count
   */
  async getPromptsCount(): Promise<number> {
    await this.load('prompts')
    return this.prompts.length
  }
}

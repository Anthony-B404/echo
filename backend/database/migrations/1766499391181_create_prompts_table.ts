import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prompts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Organization scope (multi-tenant)
      table
        .integer('organization_id')
        .unsigned()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
        .notNullable()

      // Category (optional)
      table
        .integer('category_id')
        .unsigned()
        .references('id')
        .inTable('prompt_categories')
        .onDelete('SET NULL')
        .nullable()

      // Prompt content
      table.string('title', 255).notNullable()
      table.text('content').notNullable()

      // Flags and metadata
      table.boolean('is_default').defaultTo(false) // system prompt
      table.boolean('is_favorite').defaultTo(false)
      table.integer('usage_count').unsigned().defaultTo(0)
      table.integer('sort_order').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Indexes for common queries
      table.index(['organization_id', 'category_id'])
      table.index(['organization_id', 'is_favorite'])
      table.index(['organization_id', 'sort_order'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

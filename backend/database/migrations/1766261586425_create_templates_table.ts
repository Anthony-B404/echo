import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'templates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Organization scope (nullable = system template)
      table
        .integer('organization_id')
        .unsigned()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
        .nullable() // NULL = system-wide default template

      // Template metadata
      table.string('name', 255).notNullable()
      table.text('description').nullable()

      // Category for grouping
      table.enum('category', ['medical', 'legal', 'commercial', 'general']).notNullable()

      // Template structure definition
      table.jsonb('schema').notNullable() // Sections definition

      // Default flag (one default per category per org)
      table.boolean('is_default').defaultTo(false).notNullable()

      // Creator tracking
      table
        .integer('created_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Indexes
      table.index(['organization_id', 'category'])
      table.index(['is_default'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

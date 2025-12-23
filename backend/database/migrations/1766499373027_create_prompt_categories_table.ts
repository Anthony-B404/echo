import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prompt_categories'

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

      // Category info
      table.string('name', 100).notNullable()
      table.string('description', 500).nullable()
      table.string('color', 20).nullable() // hex color for UI
      table.string('icon', 50).nullable() // icon name for UI

      // Ordering and system flags
      table.integer('sort_order').unsigned().defaultTo(0)
      table.boolean('is_default').defaultTo(false) // system category

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Indexes
      table.index(['organization_id', 'sort_order'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

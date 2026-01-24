import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcriptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Version tracking for each editable field
      table.integer('raw_text_version').unsigned().defaultTo(1).notNullable()
      table.integer('analysis_version').unsigned().defaultTo(1).notNullable()

      // Track who last edited and when (for UI display and conflict detection)
      table
        .integer('last_edited_by_user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('last_edited_at').nullable()

      // Updated at for optimistic locking
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('raw_text_version')
      table.dropColumn('analysis_version')
      table.dropColumn('last_edited_by_user_id')
      table.dropColumn('last_edited_at')
      table.dropColumn('updated_at')
    })
  }
}

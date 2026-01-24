import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transcription_versions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Reference to the transcription being versioned
      table
        .integer('transcription_id')
        .unsigned()
        .references('id')
        .inTable('transcriptions')
        .onDelete('CASCADE')
        .notNullable()

      // User who made the edit
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      // Version tracking
      table.integer('version_number').unsigned().notNullable()

      // Which field was edited: 'raw_text' or 'analysis'
      table.string('field_name', 50).notNullable()

      // The content at this version
      table.text('content').notNullable()

      // Optional summary of changes
      table.string('change_summary', 255).nullable()

      table.timestamp('created_at').notNullable()

      // Unique constraint to ensure only one version per field per version number
      table.unique(['transcription_id', 'field_name', 'version_number'])
    })

    // Index for efficient history lookups
    this.schema.raw(
      'CREATE INDEX idx_transcription_versions_lookup ON transcription_versions(transcription_id, field_name, created_at DESC)'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_transcription_versions_lookup')
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio_shares'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Reference to the shared audio
      table
        .integer('audio_id')
        .unsigned()
        .references('id')
        .inTable('audios')
        .onDelete('CASCADE')
        .notNullable()

      // User who shared the audio
      table
        .integer('shared_by_user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      // UUID for public access link
      table.uuid('identifier').unique().notNullable()

      // Email of the recipient
      table.string('shared_with_email', 255).notNullable()

      // Access tracking
      table.integer('access_count').unsigned().defaultTo(0).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Unique constraint: one share per audio-email combination
      table.unique(['audio_id', 'shared_with_email'])

      // Index for quick lookups by identifier
      table.index(['identifier'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

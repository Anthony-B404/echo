import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('type', 50).notNullable() // 'credit_request', 'owner_credit_request', 'low_credits', etc.
      table.string('title', 255).notNullable()
      table.text('message').nullable()
      table.jsonb('data').nullable()
      table.boolean('is_read').notNullable().defaultTo(false)
      table.timestamp('read_at').nullable()
      table.timestamp('created_at').notNullable()

      // Index for efficient querying of unread notifications by user
      table.index(['user_id', 'is_read'], 'idx_notifications_user_unread')
      // Index for cleanup job (read notifications older than 30 days)
      table.index(['read_at'], 'idx_notifications_cleanup')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

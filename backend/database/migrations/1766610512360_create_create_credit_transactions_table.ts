import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'credit_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // User reference
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      // Transaction details
      table.integer('amount').notNullable() // Positive = credit, Negative = debit
      table.integer('balance_after').unsigned().notNullable()
      table.string('type', 50).notNullable() // 'usage', 'purchase', 'bonus', 'refund'
      table.string('description', 255).nullable()

      // Optional audio reference (for usage transactions)
      table
        .integer('audio_id')
        .unsigned()
        .references('id')
        .inTable('audios')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('created_at').notNullable()

      // Indexes
      table.index(['user_id', 'created_at'])
      table.index(['user_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

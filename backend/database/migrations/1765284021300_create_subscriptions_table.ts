import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // User relationship (owner-level subscription)
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()

      // Lemon Squeezy identifiers
      table.string('lemon_squeezy_subscription_id').unique().notNullable()
      table.string('lemon_squeezy_customer_id').notNullable()
      table.string('lemon_squeezy_variant_id').notNullable()

      // Subscription status
      table
        .enum('status', [
          'active',
          'cancelled',
          'expired',
          'paused',
          'past_due',
          'unpaid',
          'on_trial',
        ])
        .defaultTo('active')
        .notNullable()

      // Period info
      table.timestamp('current_period_end').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

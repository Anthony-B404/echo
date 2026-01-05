import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // 1. Drop subscriptions table
    this.schema.dropTableIfExists('subscriptions')

    // 2. Remove trial fields from users table
    this.schema.alterTable('users', (table) => {
      table.dropColumn('trial_started_at')
      table.dropColumn('trial_ends_at')
      table.dropColumn('trial_used')
    })
  }

  async down() {
    // 1. Re-create subscriptions table
    this.schema.createTable('subscriptions', (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE')
      table.string('lemon_squeezy_subscription_id').unique()
      table.string('lemon_squeezy_customer_id')
      table.string('lemon_squeezy_variant_id')
      table
        .enum('status', ['active', 'cancelled', 'expired', 'paused', 'past_due', 'unpaid', 'on_trial'])
        .defaultTo('active')
      table.string('card_brand').nullable()
      table.string('card_last_four').nullable()
      table.timestamp('current_period_end').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    // 2. Re-add trial fields to users table
    this.schema.alterTable('users', (table) => {
      table.timestamp('trial_started_at').nullable()
      table.timestamp('trial_ends_at').nullable()
      table.boolean('trial_used').defaultTo(false)
    })
  }
}

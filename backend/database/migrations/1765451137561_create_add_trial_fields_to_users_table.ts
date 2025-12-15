import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Trial start date (set on registration completion)
      table.timestamp('trial_started_at').nullable()

      // Trial end date (14 days from start)
      table.timestamp('trial_ends_at').nullable()

      // Track if trial has been used (prevent restart after cancellation)
      table.boolean('trial_used').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('trial_started_at')
      table.dropColumn('trial_ends_at')
      table.dropColumn('trial_used')
    })
  }
}
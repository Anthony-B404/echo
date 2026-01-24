import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'credit_requests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('type', 50).notNullable() // 'member_to_owner', 'owner_to_reseller'
      table
        .integer('requester_id')
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
      table
        .integer('reseller_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('resellers')
        .onDelete('CASCADE')
      table.integer('amount').notNullable()
      table.text('justification').nullable()
      table.string('status', 20).notNullable().defaultTo('pending') // 'pending', 'approved', 'rejected'
      table
        .integer('processed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('rejection_reason').nullable()
      table.timestamp('processed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Indexes for efficient queries
      table.index(['organization_id', 'status'])
      table.index(['requester_id', 'status'])
      table.index(['reseller_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

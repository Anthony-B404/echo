import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reseller_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('reseller_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('resellers')
        .onDelete('CASCADE')

      table.integer('amount').notNullable()

      table
        .enum('type', ['purchase', 'distribution', 'adjustment'])
        .notNullable()

      table
        .integer('target_organization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')

      table.text('description').nullable()

      table
        .integer('performed_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()

      // Indexes for performance
      table.index(['reseller_id', 'created_at'])
      table.index(['reseller_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

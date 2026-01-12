import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_super_admin').notNullable().defaultTo(false)

      table
        .integer('reseller_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('resellers')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_super_admin')
      table.dropForeign(['reseller_id'])
      table.dropColumn('reseller_id')
    })
  }
}

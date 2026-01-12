import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('reseller_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('resellers')
        .onDelete('SET NULL')

      table.integer('credits').unsigned().notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['reseller_id'])
      table.dropColumn('reseller_id')
      table.dropColumn('credits')
    })
  }
}

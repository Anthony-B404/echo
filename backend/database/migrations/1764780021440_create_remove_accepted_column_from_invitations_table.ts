import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invitations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('accepted')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('accepted').defaultTo(false).notNullable()
    })
  }
}

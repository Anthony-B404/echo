import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_chunked').defaultTo(false).notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_chunked')
    })
  }
}

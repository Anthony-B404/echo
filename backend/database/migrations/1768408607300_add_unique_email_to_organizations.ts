import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Use nullsNotDistinct to prevent multiple NULL emails
      // PostgreSQL by default treats NULL != NULL, so without this
      // multiple organizations could have NULL emails
      table.unique(['email'], { nullsNotDistinct: true })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['email'])
    })
  }
}

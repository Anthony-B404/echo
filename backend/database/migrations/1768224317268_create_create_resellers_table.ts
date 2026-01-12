import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'resellers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('name', 255).notNullable()
      table.string('email', 255).notNullable().unique()
      table.string('phone', 50).nullable()
      table.string('company', 255).notNullable()
      table.string('siret', 20).nullable()
      table.text('address').nullable()
      table.integer('credit_balance').unsigned().notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

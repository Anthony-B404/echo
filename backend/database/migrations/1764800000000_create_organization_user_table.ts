import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organization_user'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('user_id')
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

      table.integer('role').notNullable() // 1=Owner, 2=Administrator, 3=Member

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable().defaultTo(this.now())

      // Index unique pour éviter les doublons
      table.unique(['user_id', 'organization_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

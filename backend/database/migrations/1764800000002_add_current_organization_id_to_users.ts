import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // Étape 1: Créer la colonne
    await this.db.rawQuery(`
      ALTER TABLE users
      ADD COLUMN current_organization_id INTEGER NULL
      REFERENCES organizations(id) ON DELETE SET NULL
    `)

    // Étape 2: Initialiser current_organization_id avec organization_id actuel
    await this.db.rawQuery(`
      UPDATE users
      SET current_organization_id = organization_id
      WHERE organization_id IS NOT NULL
    `)
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['current_organization_id'])
      table.dropColumn('current_organization_id')
    })
  }
}

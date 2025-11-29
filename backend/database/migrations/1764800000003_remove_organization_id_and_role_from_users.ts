import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['organization_id'])
      table.dropColumn('organization_id')
      table.dropColumn('role')
    })
  }

  async down() {
    // Étape 1: Recréer les colonnes
    await this.db.rawQuery(`
      ALTER TABLE users
      ADD COLUMN organization_id INTEGER NULL REFERENCES organizations(id) ON DELETE CASCADE,
      ADD COLUMN role INTEGER NULL
    `)

    // Étape 2: Restaurer les valeurs depuis organization_user
    // On prend la première organisation de chaque user
    await this.db.rawQuery(`
      UPDATE users u
      SET
        organization_id = (
          SELECT organization_id
          FROM organization_user ou
          WHERE ou.user_id = u.id
          LIMIT 1
        ),
        role = (
          SELECT role
          FROM organization_user ou
          WHERE ou.user_id = u.id
          LIMIT 1
        )
    `)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organization_user'

  async up() {
    // Migrer toutes les relations existantes users -> organizations dans la table pivot
    await this.db.rawQuery(`
      INSERT INTO organization_user (user_id, organization_id, role, created_at, updated_at)
      SELECT
        id as user_id,
        organization_id,
        role,
        created_at,
        updated_at
      FROM users
      WHERE organization_id IS NOT NULL
    `)
  }

  async down() {
    // Supprimer toutes les entrées de la table pivot
    // (les données originales dans users seront restaurées par la migration 4 en rollback)
    await this.db.rawQuery('DELETE FROM organization_user')
  }
}

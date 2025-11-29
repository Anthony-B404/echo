import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // Étape 1: Mettre à jour les rôles existants
    // Member (2) devient (3)
    // Administrator n'existe pas encore, on le réserve à (2)
    await this.db.rawQuery('UPDATE users SET role = 3 WHERE role = 2')

    // Étape 2: Supprimer la colonne is_owner
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_owner')
    })
  }

  async down() {
    // Remettre la colonne is_owner
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_owner').notNullable().defaultTo(false)
    })

    // Remettre les anciennes valeurs de rôles
    // Member (3) redevient (2)
    await this.db.rawQuery('UPDATE users SET role = 2 WHERE role = 3')

    // Remettre is_owner à true pour les Owner
    await this.db.rawQuery('UPDATE users SET is_owner = true WHERE role = 1')
  }
}

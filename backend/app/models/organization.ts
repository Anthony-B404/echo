import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany } from '@adonisjs/lucid/orm'
import User, { UserRole } from './user.js'
import Invitation from './invitation.js'
import type { ManyToMany, HasMany } from '@adonisjs/lucid/types/relations'

export default class Organization extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare logo: string | null

  @column()
  declare email: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => User, {
    pivotTable: 'organization_user',
    pivotColumns: ['role'],
  })
  declare users: ManyToMany<typeof User>

  @hasMany(() => Invitation)
  declare invitations: HasMany<typeof Invitation>

  /**
   * Get the owner of this organization
   */
  async getOwner(): Promise<User | null> {
    await this.load('users')
    return this.users.find((u) => u.$extras.pivot_role === UserRole.Owner) ?? null
  }
}

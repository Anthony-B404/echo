import vine from '@vinejs/vine'
import { UserRole } from '#models/user'

/**
 * Validator for updating a member's profile
 * All fields are optional - only provided fields will be updated
 */
export const updateMemberValidator = vine.compile(
  vine.object({
    firstName: vine.string().minLength(2).optional(),
    lastName: vine.string().minLength(2).optional(),
    email: vine
      .string()
      .email()
      .unique(async (db, value, field) => {
        // Skip uniqueness check if email hasn't changed
        const user = await db
          .from('users')
          .where('email', value)
          .whereNot('id', field.meta.targetUserId)
          .first()
        return !user
      })
      .optional(),
    removeAvatar: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a member's role
 * Role can only be Administrator (2) or Member (3) - never Owner (1)
 */
export const updateMemberRoleValidator = vine.compile(
  vine.object({
    role: vine.enum([UserRole.Administrator, UserRole.Member]),
  })
)

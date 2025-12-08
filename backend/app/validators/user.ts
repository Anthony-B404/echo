import vine from '@vinejs/vine'
import { UserRole } from '#models/user'

// Validator for registration request (initial signup - step 1)
export const registrationRequestValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .email()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        // Allow if: no user OR onboarding not completed OR user is disabled
        return !user || !user.onboarding_completed || user.disabled
      }),
  })
)

// Validator for complete registration (step 2 with organization details)
export const completeRegistrationValidator = vine.compile(
  vine.object({
    magicLinkToken: vine.string().uuid(),
    firstName: vine.string().minLength(2),
    lastName: vine.string().minLength(2),
    organizationName: vine.string().minLength(2),
  })
)

// Validator for OAuth complete registration (without magicLinkToken)
export const completeOAuthRegistrationValidator = vine.compile(
  vine.object({
    firstName: vine.string().minLength(2),
    lastName: vine.string().minLength(2),
    organizationName: vine.string().minLength(2),
  })
)

// Validator for login request with magic link
export const loginRequestValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
  })
)

// Keep registerValidator for backward compatibility (invitations, etc.)
export const registerValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .email()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        return !user
      }),
    fullName: vine.string(),
    role: vine.enum(
      Object.values(UserRole).filter((value) => typeof value === 'number') as number[]
    ),
    organizationId: vine.number(),
    onboardingCompleted: vine.boolean({ strict: true }),
  })
)

// Validator for updating user profile
export const updateProfileValidator = vine.compile(
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
          .whereNot('id', field.meta.userId)
          .first()
        return !user
      })
      .optional(),
    removeAvatar: vine.boolean().optional(),
  })
)

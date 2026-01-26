import vine from '@vinejs/vine'

/**
 * Validator for notification query params
 */
export const notificationQueryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)

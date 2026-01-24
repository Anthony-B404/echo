import vine from '@vinejs/vine'

/**
 * Validator for creating a credit request (member to owner)
 */
export const createCreditRequestValidator = vine.compile(
  vine.object({
    amount: vine.number().positive().max(100000),
    justification: vine.string().maxLength(1000).optional(),
  })
)

/**
 * Validator for creating a credit request from owner to reseller
 */
export const createOwnerCreditRequestValidator = vine.compile(
  vine.object({
    amount: vine.number().positive().max(1000000),
    justification: vine.string().maxLength(1000).optional(),
  })
)

/**
 * Validator for rejecting a credit request
 */
export const rejectCreditRequestValidator = vine.compile(
  vine.object({
    reason: vine.string().maxLength(1000).optional(),
  })
)

/**
 * Validator for credit request query params
 */
export const creditRequestQueryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    status: vine.enum(['pending', 'approved', 'rejected', 'all']).optional(),
  })
)

import vine from '@vinejs/vine'

/**
 * Validator for creating a new prompt category
 */
export const createPromptCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    description: vine.string().trim().maxLength(500).optional(),
    color: vine.string().trim().maxLength(20).optional(),
    icon: vine.string().trim().maxLength(50).optional(),
  })
)

/**
 * Validator for updating a prompt category
 */
export const updatePromptCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    description: vine.string().trim().maxLength(500).nullable().optional(),
    color: vine.string().trim().maxLength(20).nullable().optional(),
    icon: vine.string().trim().maxLength(50).nullable().optional(),
    sortOrder: vine.number().min(0).optional(),
  })
)

/**
 * Validator for prompt category list (index) request
 */
export const promptCategoryIndexValidator = vine.compile(
  vine.object({
    includePromptCount: vine.boolean().optional(),
  })
)

/**
 * Validator for reordering categories
 */
export const promptCategoryReorderValidator = vine.compile(
  vine.object({
    categories: vine
      .array(
        vine.object({
          id: vine.number().positive(),
          sortOrder: vine.number().min(0),
        })
      )
      .minLength(1),
  })
)

import vine from '@vinejs/vine'

/**
 * Validator for creating a new prompt
 */
export const createPromptValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    content: vine.string().trim().minLength(5).maxLength(5000),
    categoryId: vine.number().positive().optional(),
    isFavorite: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a prompt
 */
export const updatePromptValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    content: vine.string().trim().minLength(5).maxLength(5000).optional(),
    categoryId: vine.number().positive().nullable().optional(),
    isFavorite: vine.boolean().optional(),
    sortOrder: vine.number().min(0).optional(),
  })
)

/**
 * Validator for prompt list (index) request with pagination and filters
 */
export const promptIndexValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    categoryId: vine.number().positive().optional(),
    favorites: vine.boolean().optional(),
    search: vine.string().maxLength(255).optional(),
    sort: vine.enum(['createdAt', 'title', 'usageCount', 'sortOrder']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)

/**
 * Validator for batch delete request
 */
export const promptBatchDeleteValidator = vine.compile(
  vine.object({
    ids: vine.array(vine.number().positive()).minLength(1).maxLength(50),
  })
)

/**
 * Validator for reordering prompts
 */
export const promptReorderValidator = vine.compile(
  vine.object({
    prompts: vine
      .array(
        vine.object({
          id: vine.number().positive(),
          sortOrder: vine.number().min(0),
        })
      )
      .minLength(1),
  })
)

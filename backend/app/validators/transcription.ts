import vine from '@vinejs/vine'

/**
 * Validator for editing a transcription field
 */
export const transcriptionEditValidator = vine.compile(
  vine.object({
    field: vine.enum(['raw_text', 'analysis'] as const),
    content: vine.string().minLength(1).maxLength(500000), // 500KB max for text content
    expectedVersion: vine.number().positive(),
    changeSummary: vine.string().maxLength(255).optional(),
  })
)

/**
 * Validator for fetching transcription history
 */
export const transcriptionHistoryValidator = vine.compile(
  vine.object({
    field: vine.enum(['raw_text', 'analysis'] as const).optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)

/**
 * Validator for comparing two versions
 */
export const transcriptionDiffValidator = vine.compile(
  vine.object({
    version1: vine.number().positive(),
    version2: vine.number().positive(),
  })
)

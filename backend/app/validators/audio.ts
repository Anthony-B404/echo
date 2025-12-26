import vine from '@vinejs/vine'

/**
 * Validator for audio processing request
 */
export const audioProcessValidator = vine.compile(
    vine.object({
        prompt: vine.string().minLength(5).maxLength(1000),
    })
)

/**
 * Allowed audio mime types
 */
export const ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
]

/**
 * Allowed audio file extensions
 */
export const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'flac']

/**
 * Maximum file size in bytes (512MB)
 */
export const MAX_AUDIO_SIZE = 512 * 1024 * 1024

/**
 * Validator for audio list (index) request with pagination and filters
 */
export const audioIndexValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    status: vine.enum(['pending', 'processing', 'completed', 'failed']).optional(),
    search: vine.string().maxLength(255).optional(),
    sort: vine.enum(['createdAt', 'title', 'duration', 'status']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)

/**
 * Validator for batch delete request
 */
export const audioBatchDeleteValidator = vine.compile(
  vine.object({
    ids: vine.array(vine.number().positive()).minLength(1).maxLength(50),
  })
)

/**
 * Validator for audio update request
 */
export const audioUpdateValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
  })
)

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'md'

/**
 * Export content options
 */
export type ExportContent = 'transcription' | 'analysis' | 'both'

/**
 * Validator for audio export request
 */
export const audioExportValidator = vine.compile(
  vine.object({
    format: vine.enum(['pdf', 'docx', 'txt', 'md'] as const),
    content: vine.enum(['transcription', 'analysis', 'both'] as const),
  })
)

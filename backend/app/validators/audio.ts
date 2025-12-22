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
  })
)

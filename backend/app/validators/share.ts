import vine from '@vinejs/vine'

/**
 * Validator for sharing an audio by email
 */
export const shareAudioValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
  })
)

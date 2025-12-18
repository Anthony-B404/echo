import type { HttpContext } from '@adonisjs/core/http'
import { audioProcessValidator, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_SIZE } from '#validators/audio'
import MistralService from '#services/mistral_service'
import { errors } from '@vinejs/vine'

export default class AudioController {
    /**
     * Process audio file: transcribe and analyze according to user prompt
     */
    async process({ request, response, i18n }: HttpContext) {
        try {
            // Validate prompt
            const { prompt } = await request.validateUsing(audioProcessValidator)

            // Get uploaded file
            const audioFile = request.file('audio', {
                size: `${MAX_AUDIO_SIZE / (1024 * 1024)}mb`,
                extnames: ALLOWED_AUDIO_EXTENSIONS,
            })

            if (!audioFile) {
                return response.badRequest({
                    message: i18n.t('messages.audio.no_file_uploaded'),
                })
            }

            if (!audioFile.isValid) {
                return response.badRequest({
                    message: audioFile.errors[0]?.message || i18n.t('messages.audio.invalid_file'),
                })
            }

            if (!audioFile.tmpPath) {
                return response.badRequest({
                    message: i18n.t('messages.audio.file_upload_error'),
                })
            }

            // Process with Mistral
            const mistralService = new MistralService()

            // Step 1: Transcribe audio
            const transcription = await mistralService.transcribe(
                audioFile.tmpPath,
                audioFile.clientName
            )

            if (!transcription || transcription.trim() === '') {
                return response.unprocessableEntity({
                    message: i18n.t('messages.audio.transcription_empty'),
                })
            }

            // Step 2: Analyze transcription with user prompt
            const analysis = await mistralService.analyze(transcription, prompt)

            return response.ok({
                transcription,
                analysis,
            })
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                const firstError = error.messages[0]
                if (firstError) {
                    const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)
                    const translatedMessage = i18n.t(firstError.message, { field: translatedField })
                    return response.status(422).json({
                        message: translatedMessage,
                        error: 'Validation failure',
                    })
                }
            }

            // Log the error for debugging
            console.error('Audio processing error:', error)

            return response.internalServerError({
                message: i18n.t('messages.audio.processing_error'),
            })
        }
    }
}

import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import Transcription from '#models/transcription'
import TranscriptionVersion, { TranscriptionVersionField } from '#models/transcription_version'

export default class BackfillInitialVersions extends BaseCommand {
  static commandName = 'backfill:initial-versions'
  static description =
    'Create initial version entries (v1) for transcriptions that do not have them'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Starting backfill of initial version entries...')

    // Find all transcriptions
    const transcriptions = await Transcription.query().preload('audio')

    let createdCount = 0
    let skippedCount = 0

    for (const transcription of transcriptions) {
      // Check if v1 for raw_text already exists
      const existingRawTextV1 = await TranscriptionVersion.query()
        .where('transcriptionId', transcription.id)
        .where('fieldName', TranscriptionVersionField.RawText)
        .where('versionNumber', 1)
        .first()

      // Check if v1 for analysis already exists
      const existingAnalysisV1 = await TranscriptionVersion.query()
        .where('transcriptionId', transcription.id)
        .where('fieldName', TranscriptionVersionField.Analysis)
        .where('versionNumber', 1)
        .first()

      // Get the user ID from the audio
      const userId = transcription.audio?.userId

      if (!userId) {
        this.logger.warning(`Skipping transcription ${transcription.id}: no user ID found`)
        skippedCount++
        continue
      }

      // Create v1 for raw_text if it doesn't exist and there's content
      if (!existingRawTextV1 && transcription.rawText) {
        await TranscriptionVersion.create({
          transcriptionId: transcription.id,
          userId: userId,
          versionNumber: 1,
          fieldName: TranscriptionVersionField.RawText,
          content: transcription.rawText,
          changeSummary: 'Initial transcription',
        })
        createdCount++
        this.logger.info(`Created raw_text v1 for transcription ${transcription.id}`)
      }

      // Create v1 for analysis if it doesn't exist and there's content
      if (!existingAnalysisV1 && transcription.analysis) {
        await TranscriptionVersion.create({
          transcriptionId: transcription.id,
          userId: userId,
          versionNumber: 1,
          fieldName: TranscriptionVersionField.Analysis,
          content: transcription.analysis,
          changeSummary: 'Initial analysis',
        })
        createdCount++
        this.logger.info(`Created analysis v1 for transcription ${transcription.id}`)
      }

      if (existingRawTextV1 && existingAnalysisV1) {
        skippedCount++
      }
    }

    this.logger.success(
      `Backfill complete: ${createdCount} version entries created, ${skippedCount} transcriptions skipped`
    )
  }
}

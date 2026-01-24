import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import * as Diff from 'diff'
import Transcription from '#models/transcription'
import TranscriptionVersion, { TranscriptionVersionField } from '#models/transcription_version'
import User from '#models/user'

/**
 * Result of an edit operation
 */
export interface EditResult {
  success: boolean
  transcription?: Transcription
  version?: TranscriptionVersion
  conflict?: {
    currentVersion: number
    lastEditedBy: User | null
    lastEditedAt: DateTime | null
  }
}

/**
 * A single change in the diff
 */
export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

/**
 * Statistics about the diff
 */
export interface DiffStats {
  linesAdded: number
  linesRemoved: number
  linesUnchanged: number
}

/**
 * Result of a version comparison with computed diff
 */
export interface VersionDiff {
  version1: TranscriptionVersion
  version2: TranscriptionVersion
  field: TranscriptionVersionField
  diff: {
    changes: DiffChange[]
    stats: DiffStats
  }
}

/**
 * Service for managing transcription version history and editing with optimistic locking.
 */
class TranscriptionVersionService {
  /**
   * Edit a transcription field with optimistic locking.
   * Creates a new version entry and updates the transcription.
   *
   * @param transcription - The transcription to edit
   * @param fieldName - Which field to edit ('raw_text' or 'analysis')
   * @param content - The new content
   * @param expectedVersion - The version number the client expects (for conflict detection)
   * @param user - The user making the edit
   * @param changeSummary - Optional summary of changes
   */
  async editField(
    transcription: Transcription,
    fieldName: TranscriptionVersionField,
    content: string,
    expectedVersion: number,
    user: User,
    changeSummary?: string
  ): Promise<EditResult> {
    // Get current version number for this field
    const currentVersion =
      fieldName === TranscriptionVersionField.RawText
        ? transcription.rawTextVersion
        : transcription.analysisVersion

    // Check for conflict (optimistic locking)
    if (currentVersion !== expectedVersion) {
      // Load last editor info for conflict response
      if (transcription.lastEditedByUserId) {
        await transcription.load('lastEditedByUser')
      }

      return {
        success: false,
        conflict: {
          currentVersion,
          lastEditedBy: transcription.lastEditedByUser ?? null,
          lastEditedAt: transcription.lastEditedAt,
        },
      }
    }

    const newVersion = currentVersion + 1

    // Use transaction to ensure atomicity
    const trx = await db.transaction()

    try {
      // Create version history entry
      const versionEntry = await TranscriptionVersion.create(
        {
          transcriptionId: transcription.id,
          userId: user.id,
          versionNumber: newVersion,
          fieldName,
          content,
          changeSummary,
        },
        { client: trx }
      )

      // Update transcription
      if (fieldName === TranscriptionVersionField.RawText) {
        transcription.rawText = content
        transcription.rawTextVersion = newVersion
      } else {
        transcription.analysis = content
        transcription.analysisVersion = newVersion
      }

      transcription.lastEditedByUserId = user.id
      transcription.lastEditedAt = DateTime.now()

      await transcription.useTransaction(trx).save()

      await trx.commit()

      // Load the user relation for the response
      await versionEntry.load('user')

      return {
        success: true,
        transcription,
        version: versionEntry,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Get version history for a transcription, optionally filtered by field.
   * Uses Lucid's built-in paginate() for efficient single-query pagination.
   *
   * @param transcriptionId - The transcription ID
   * @param fieldName - Optional field filter
   * @param page - Page number (1-based)
   * @param limit - Items per page
   */
  async getHistory(
    transcriptionId: number,
    fieldName?: TranscriptionVersionField,
    page: number = 1,
    limit: number = 20
  ) {
    const query = TranscriptionVersion.query()
      .where('transcriptionId', transcriptionId)
      .preload('user')
      .orderBy('createdAt', 'desc')

    if (fieldName) {
      query.where('fieldName', fieldName)
    }

    // Use Lucid's paginate() for efficient single-query pagination
    return await query.paginate(page, limit)
  }

  /**
   * Get a specific version by ID.
   *
   * @param versionId - The version ID
   */
  async getVersion(versionId: number): Promise<TranscriptionVersion | null> {
    return TranscriptionVersion.query()
      .where('id', versionId)
      .preload('user')
      .preload('transcription')
      .first()
  }

  /**
   * Restore a previous version, creating a new version entry in the process.
   *
   * @param transcription - The transcription to restore
   * @param versionId - The version ID to restore from
   * @param user - The user performing the restore
   */
  async restoreVersion(
    transcription: Transcription,
    versionId: number,
    user: User
  ): Promise<EditResult> {
    // Get the version to restore
    const versionToRestore = await TranscriptionVersion.find(versionId)

    if (!versionToRestore) {
      throw new Error('Version not found')
    }

    // Verify the version belongs to this transcription
    if (versionToRestore.transcriptionId !== transcription.id) {
      throw new Error('Version does not belong to this transcription')
    }

    // Get current version number for the field
    const currentVersion =
      versionToRestore.fieldName === TranscriptionVersionField.RawText
        ? transcription.rawTextVersion
        : transcription.analysisVersion

    const newVersion = currentVersion + 1

    // Use transaction
    const trx = await db.transaction()

    try {
      // Create new version entry for the restore
      const versionEntry = await TranscriptionVersion.create(
        {
          transcriptionId: transcription.id,
          userId: user.id,
          versionNumber: newVersion,
          fieldName: versionToRestore.fieldName,
          content: versionToRestore.content,
          changeSummary: `Restored from version ${versionToRestore.versionNumber}`,
        },
        { client: trx }
      )

      // Update transcription
      if (versionToRestore.fieldName === TranscriptionVersionField.RawText) {
        transcription.rawText = versionToRestore.content
        transcription.rawTextVersion = newVersion
      } else {
        transcription.analysis = versionToRestore.content
        transcription.analysisVersion = newVersion
      }

      transcription.lastEditedByUserId = user.id
      transcription.lastEditedAt = DateTime.now()

      await transcription.useTransaction(trx).save()

      await trx.commit()

      // Load user for response
      await versionEntry.load('user')

      return {
        success: true,
        transcription,
        version: versionEntry,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Compare two versions and return their content with computed diff.
   * The diff is calculated server-side to reduce network payload and centralize the logic.
   *
   * @param version1Id - First version ID (older version)
   * @param version2Id - Second version ID (newer version)
   */
  async compareVersions(version1Id: number, version2Id: number): Promise<VersionDiff> {
    const [version1, version2] = await Promise.all([
      TranscriptionVersion.query().where('id', version1Id).preload('user').firstOrFail(),
      TranscriptionVersion.query().where('id', version2Id).preload('user').firstOrFail(),
    ])

    // Verify both versions are from the same transcription and field
    if (version1.transcriptionId !== version2.transcriptionId) {
      throw new Error('Versions must belong to the same transcription')
    }

    if (version1.fieldName !== version2.fieldName) {
      throw new Error('Versions must be for the same field')
    }

    // Compute line-by-line diff using the diff library
    const diffResult = Diff.diffLines(version1.content, version2.content)

    // Transform to our format
    const changes: DiffChange[] = []
    let linesAdded = 0
    let linesRemoved = 0
    let linesUnchanged = 0

    for (const part of diffResult) {
      // Split the value into lines, preserving empty lines
      const lines = part.value.split('\n')
      // If the value ends with \n, the last element will be empty string - skip it
      const hasTrailingNewline = part.value.endsWith('\n')
      const linesToProcess = hasTrailingNewline ? lines.slice(0, -1) : lines

      for (const line of linesToProcess) {
        if (part.added) {
          changes.push({ type: 'added', value: line })
          linesAdded++
        } else if (part.removed) {
          changes.push({ type: 'removed', value: line })
          linesRemoved++
        } else {
          changes.push({ type: 'unchanged', value: line })
          linesUnchanged++
        }
      }
    }

    return {
      version1,
      version2,
      field: version1.fieldName,
      diff: {
        changes,
        stats: {
          linesAdded,
          linesRemoved,
          linesUnchanged,
        },
      },
    }
  }

  /**
   * Create initial version entries for a transcription (e.g., after first transcription).
   * This is used to establish the baseline version 1.
   *
   * @param transcription - The transcription to create initial versions for
   * @param userId - The user who created/owns the transcription
   */
  async createInitialVersions(transcription: Transcription, userId: number): Promise<void> {
    const versions: Partial<TranscriptionVersion>[] = []

    // Create version for raw_text if it exists
    if (transcription.rawText) {
      versions.push({
        transcriptionId: transcription.id,
        userId,
        versionNumber: 1,
        fieldName: TranscriptionVersionField.RawText,
        content: transcription.rawText,
        changeSummary: 'Initial transcription',
      })
    }

    // Create version for analysis if it exists
    if (transcription.analysis) {
      versions.push({
        transcriptionId: transcription.id,
        userId,
        versionNumber: 1,
        fieldName: TranscriptionVersionField.Analysis,
        content: transcription.analysis,
        changeSummary: 'Initial analysis',
      })
    }

    if (versions.length > 0) {
      await TranscriptionVersion.createMany(versions)
    }
  }
}

export default new TranscriptionVersionService()

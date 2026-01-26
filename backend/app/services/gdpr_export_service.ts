import { DateTime } from 'luxon'
import archiver from 'archiver'
import { PassThrough } from 'node:stream'
import User, { UserRole } from '#models/user'
import Audio from '#models/audio'
import CreditTransaction from '#models/credit_transaction'

export interface ExportProfile {
  id: number
  email: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  avatar: string | null
  googleId: string | null
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string | null
}

export interface ExportOrganization {
  id: number
  name: string
  email: string | null
  logo: string | null
  role: string
  joinedAt: string
}

export interface ExportAudio {
  id: number
  title: string | null
  fileName: string
  fileSize: number
  mimeType: string | null
  duration: number | null
  status: string
  organizationId: number
  organizationName: string
  createdAt: string
  transcription: ExportTranscription | null
  documents: ExportDocument[]
}

export interface ExportTranscription {
  id: number
  rawText: string | null
  language: string | null
  confidence: number | null
  analysis: string | null
  createdAt: string
}

export interface ExportDocument {
  id: number
  title: string | null
  format: string | null
  status: string
  createdAt: string
}

export interface ExportCreditTransaction {
  id: number
  amount: number
  balanceAfter: number
  type: string
  description: string | null
  audioId: number | null
  audioTitle: string | null
  createdAt: string
}

/**
 * Service for generating GDPR data exports
 */
class GdprExportService {
  /**
   * Generate a complete data export as a ZIP buffer
   */
  async generateExport(user: User): Promise<Buffer> {
    // Load all user data
    await user.load('organizations')

    // Prepare export data
    const profile = this.exportProfile(user)
    const organizations = this.exportOrganizations(user)
    const audios = await this.exportAudios(user)
    const credits = await this.exportCredits(user)

    // Create ZIP archive
    return this.createZipArchive(profile, organizations, audios, credits, user)
  }

  /**
   * Export user profile data
   */
  private exportProfile(user: User): ExportProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      googleId: user.googleId,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt.toISO() || '',
      updatedAt: user.updatedAt?.toISO() || null,
    }
  }

  /**
   * Export organizations data
   */
  private exportOrganizations(user: User): ExportOrganization[] {
    const roleNames: Record<number, string> = {
      [UserRole.Owner]: 'Owner',
      [UserRole.Administrator]: 'Administrator',
      [UserRole.Member]: 'Member',
    }

    return user.organizations.map((org) => ({
      id: org.id,
      name: org.name,
      email: org.email,
      logo: org.logo,
      role: roleNames[org.$extras.pivot_role] || 'Unknown',
      joinedAt: org.$extras.pivot_created_at || '',
    }))
  }

  /**
   * Export all audios with transcriptions and documents
   */
  private async exportAudios(user: User): Promise<ExportAudio[]> {
    const audios = await Audio.query()
      .where('userId', user.id)
      .preload('transcription')
      .preload('documents')
      .preload('organization')

    return audios.map((audio) => ({
      id: audio.id,
      title: audio.title,
      fileName: audio.fileName,
      fileSize: audio.fileSize,
      mimeType: audio.mimeType,
      duration: audio.duration,
      status: audio.status,
      organizationId: audio.organizationId,
      organizationName: audio.organization?.name || 'Unknown',
      createdAt: audio.createdAt.toISO() || '',
      transcription: audio.transcription
        ? {
            id: audio.transcription.id,
            rawText: audio.transcription.rawText,
            language: audio.transcription.language,
            confidence: audio.transcription.confidence,
            analysis: audio.transcription.analysis,
            createdAt: audio.transcription.createdAt.toISO() || '',
          }
        : null,
      documents: audio.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        format: doc.format,
        status: doc.status,
        createdAt: doc.createdAt.toISO() || '',
      })),
    }))
  }

  /**
   * Export credit transactions
   */
  private async exportCredits(user: User): Promise<ExportCreditTransaction[]> {
    const transactions = await CreditTransaction.query()
      .where('userId', user.id)
      .preload('audio')
      .orderBy('createdAt', 'desc')

    return transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      type: tx.type,
      description: tx.description,
      audioId: tx.audioId,
      audioTitle: tx.audio?.title || null,
      createdAt: tx.createdAt.toISO() || '',
    }))
  }

  /**
   * Create ZIP archive with all export data
   */
  private async createZipArchive(
    profile: ExportProfile,
    organizations: ExportOrganization[],
    audios: ExportAudio[],
    credits: ExportCreditTransaction[],
    user: User
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } })
      const chunks: Buffer[] = []
      const passthrough = new PassThrough()

      passthrough.on('data', (chunk) => chunks.push(chunk))
      passthrough.on('end', () => resolve(Buffer.concat(chunks)))
      passthrough.on('error', reject)

      archive.pipe(passthrough)

      // Add JSON files
      archive.append(JSON.stringify(profile, null, 2), { name: 'profile.json' })
      archive.append(JSON.stringify(organizations, null, 2), { name: 'organizations.json' })
      archive.append(JSON.stringify(audios, null, 2), { name: 'audios.json' })
      archive.append(JSON.stringify(credits, null, 2), { name: 'credits.json' })

      // Add README
      const readme = this.generateReadme(user, audios.length, credits.length)
      archive.append(readme, { name: 'README.txt' })

      // Add transcriptions as separate text files for readability
      for (const audio of audios) {
        if (audio.transcription?.rawText) {
          const filename = `transcriptions/${audio.id}_${this.sanitizeFilename(audio.title || audio.fileName)}.txt`
          const content = this.formatTranscription(audio)
          archive.append(content, { name: filename })
        }
      }

      // Note: We don't include actual audio files to keep export size reasonable
      // and because they can be very large. Users can request specific files separately.

      await archive.finalize()
    })
  }

  /**
   * Generate README file content
   */
  private generateReadme(user: User, audioCount: number, transactionCount: number): string {
    const exportDate = DateTime.now().toISO()

    return `GDPR DATA EXPORT
================

Export Date: ${exportDate}
User Email: ${user.email}

This archive contains all personal data associated with your account.

FILES INCLUDED:
- profile.json: Your user profile information
- organizations.json: Organizations you belong to and your roles
- audios.json: Metadata for all your audio files
- credits.json: Your credit transaction history
- transcriptions/: Text files of your audio transcriptions

DATA CATEGORIES:
- Audio files: ${audioCount} file(s)
- Credit transactions: ${transactionCount} transaction(s)

NOTES:
- Audio files are not included in this export due to size constraints.
- If you need the original audio files, please contact support.
- All dates are in ISO 8601 format.
- This export was generated in compliance with GDPR Article 20.

For questions about your data, please contact: informatique@dhsolutionsgroup.com
`
  }

  /**
   * Format transcription for text file
   */
  private formatTranscription(audio: ExportAudio): string {
    const parts: string[] = [
      `TRANSCRIPTION`,
      `=============`,
      ``,
      `Audio: ${audio.title || audio.fileName}`,
      `Duration: ${this.formatDuration(audio.duration)}`,
      `Language: ${audio.transcription?.language || 'Unknown'}`,
      `Confidence: ${audio.transcription?.confidence ? `${(audio.transcription.confidence * 100).toFixed(1)}%` : 'N/A'}`,
      `Created: ${audio.createdAt}`,
      ``,
      `--- TRANSCRIPTION TEXT ---`,
      ``,
      audio.transcription?.rawText || 'No transcription available',
    ]

    if (audio.transcription?.analysis) {
      parts.push(``, `--- ANALYSIS ---`, ``, audio.transcription.analysis)
    }

    return parts.join('\n')
  }

  /**
   * Format duration in mm:ss or hh:mm:ss
   */
  private formatDuration(seconds: number | null): string {
    if (!seconds) return 'N/A'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Sanitize filename for use in archive
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50)
  }
}

export default new GdprExportService()

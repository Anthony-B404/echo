import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import User, { UserRole } from '#models/user'
import Organization from '#models/organization'
import Audio from '#models/audio'
import Transcription from '#models/transcription'
import Document from '#models/document'
import DeletionRequest, {
  DeletionRequestStatus,
  OrphanOrgsDecision,
} from '#models/deletion_request'
import storageService from './storage_service.js'
import type { I18n } from '@adonisjs/i18n'

/** Duration in days before account is deleted */
const DELETION_DELAY_DAYS = 30

export interface DataSummary {
  profile: {
    email: string
    fullName: string | null
    firstName: string | null
    lastName: string | null
    avatar: string | null
    createdAt: string
  }
  organizations: {
    count: number
    details: Array<{
      id: number
      name: string
      role: string
      isOwner: boolean
    }>
  }
  audios: {
    count: number
    totalDuration: number
    totalSize: number
  }
  transcriptions: {
    count: number
  }
  documents: {
    count: number
  }
  credits: {
    balance: number
    transactionsCount: number
  }
}

export interface OrphanOrganization {
  id: number
  name: string
  membersCount: number
  members: Array<{
    id: number
    email: string
    fullName: string | null
    role: number
  }>
}

export interface DeletionSummary {
  audioCount: number
  transcriptionCount: number
  documentCount: number
  organizationsDeleted: number
  organizationsTransferred: number
}

export interface OrphanDecisionInput {
  organizationId: number
  action: 'transfer' | 'delete'
  newOwnerId?: number
}

/**
 * Service for GDPR-related operations including data export,
 * account deletion, and data summary.
 */
class GdprService {
  /**
   * Get a summary of all data stored for a user
   */
  async getDataSummary(user: User): Promise<DataSummary> {
    await user.load('organizations')
    await user.load('creditTransactions')

    // Get audio stats
    const audioStats = await Audio.query()
      .where('userId', user.id)
      .count('* as count')
      .sum('duration as totalDuration')
      .sum('file_size as totalSize')
      .first()

    // Get transcription count
    const transcriptionCount = await Transcription.query()
      .whereIn('audioId', Audio.query().select('id').where('userId', user.id))
      .count('* as count')
      .first()

    // Get document count
    const documentCount = await Document.query()
      .whereIn('audioId', Audio.query().select('id').where('userId', user.id))
      .count('* as count')
      .first()

    const roleNames: Record<number, string> = {
      [UserRole.Owner]: 'Owner',
      [UserRole.Administrator]: 'Administrator',
      [UserRole.Member]: 'Member',
    }

    return {
      profile: {
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        createdAt: user.createdAt.toISO() || '',
      },
      organizations: {
        count: user.organizations.length,
        details: user.organizations.map((org) => ({
          id: org.id,
          name: org.name,
          role: roleNames[org.$extras.pivot_role] || 'Unknown',
          isOwner: org.$extras.pivot_role === UserRole.Owner,
        })),
      },
      audios: {
        count: Number(audioStats?.$extras.count) || 0,
        totalDuration: Number(audioStats?.$extras.totalDuration) || 0,
        totalSize: Number(audioStats?.$extras.totalSize) || 0,
      },
      transcriptions: {
        count: Number(transcriptionCount?.$extras.count) || 0,
      },
      documents: {
        count: Number(documentCount?.$extras.count) || 0,
      },
      credits: {
        balance: user.credits,
        transactionsCount: user.creditTransactions.length,
      },
    }
  }

  /**
   * Detect organizations where the user is the sole owner
   */
  async detectOrphanOrganizations(user: User): Promise<OrphanOrganization[]> {
    await user.load('organizations')

    const orphanOrgs: OrphanOrganization[] = []

    for (const org of user.organizations) {
      // Only check orgs where user is owner
      if (org.$extras.pivot_role !== UserRole.Owner) {
        continue
      }

      // Load all users for this organization
      await org.load('users')

      // Check if there are other owners
      const otherOwners = org.users.filter(
        (u) => u.id !== user.id && u.$extras.pivot_role === UserRole.Owner
      )

      // If no other owners, this org will become orphaned
      if (otherOwners.length === 0) {
        orphanOrgs.push({
          id: org.id,
          name: org.name,
          membersCount: org.users.length,
          members: org.users
            .filter((u) => u.id !== user.id)
            .map((u) => ({
              id: u.id,
              email: u.email,
              fullName: u.fullName,
              role: u.$extras.pivot_role,
            })),
        })
      }
    }

    return orphanOrgs
  }

  /**
   * Request account deletion with 30-day delay
   */
  async requestDeletion(
    user: User,
    orphanDecisions: OrphanDecisionInput[],
    i18n: I18n,
    frontendUrl: string
  ): Promise<DeletionRequest> {
    // Check for existing pending request
    const existingRequest = await DeletionRequest.query()
      .where('userId', user.id)
      .where('status', DeletionRequestStatus.Pending)
      .first()

    if (existingRequest) {
      throw new Error('DELETION_ALREADY_PENDING')
    }

    // Validate orphan organization decisions
    const orphanOrgs = await this.detectOrphanOrganizations(user)
    if (orphanOrgs.length > 0 && orphanDecisions.length === 0) {
      throw new Error('ORPHAN_ORGS_REQUIRED')
    }

    // Validate each decision
    for (const decision of orphanDecisions) {
      const orphanOrg = orphanOrgs.find((o) => o.id === decision.organizationId)
      if (!orphanOrg) {
        throw new Error(`INVALID_ORG_ID:${decision.organizationId}`)
      }

      if (decision.action === 'transfer') {
        if (!decision.newOwnerId) {
          throw new Error(`NEW_OWNER_REQUIRED:${decision.organizationId}`)
        }
        // Verify new owner is a member of the org
        const isMember = orphanOrg.members.some((m) => m.id === decision.newOwnerId)
        if (!isMember) {
          throw new Error(`INVALID_NEW_OWNER:${decision.organizationId}`)
        }
      }
    }

    // Convert decisions to storage format
    const decisionsMap: OrphanOrgsDecision = {}
    for (const decision of orphanDecisions) {
      decisionsMap[decision.organizationId.toString()] = {
        action: decision.action,
        newOwnerId: decision.newOwnerId,
      }
    }

    // Create deletion request
    const token = randomUUID()
    const requestedAt = DateTime.now()
    const scheduledFor = requestedAt.plus({ days: DELETION_DELAY_DAYS })

    const deletionRequest = await DeletionRequest.create({
      userId: user.id,
      token,
      status: DeletionRequestStatus.Pending,
      requestedAt,
      scheduledFor,
      orphanOrgsDecision: Object.keys(decisionsMap).length > 0 ? decisionsMap : null,
    })

    // Send confirmation email
    await this.sendDeletionRequestedEmail(user, deletionRequest, i18n, frontendUrl)

    return deletionRequest
  }

  /**
   * Cancel a pending deletion request
   */
  async cancelDeletion(token: string, userId: number): Promise<void> {
    const request = await DeletionRequest.query()
      .where('token', token)
      .where('userId', userId)
      .first()

    if (!request) {
      throw new Error('INVALID_TOKEN')
    }

    if (!request.canBeCancelled()) {
      throw new Error('CANNOT_CANCEL')
    }

    request.status = DeletionRequestStatus.Cancelled
    request.cancelledAt = DateTime.now()
    await request.save()
  }

  /**
   * Execute account deletion (called by job after 30 days)
   */
  async executeDeletion(request: DeletionRequest, i18n: I18n): Promise<DeletionSummary> {
    const user = await User.findOrFail(request.userId)
    const userEmail = user.email // Store email before deletion for final email

    const summary: DeletionSummary = {
      audioCount: 0,
      transcriptionCount: 0,
      documentCount: 0,
      organizationsDeleted: 0,
      organizationsTransferred: 0,
    }

    const trx = await db.transaction()

    try {
      // Update request status
      request.status = DeletionRequestStatus.Processing
      await request.useTransaction(trx).save()

      // Handle orphan organizations
      if (request.orphanOrgsDecision) {
        for (const [orgId, decision] of Object.entries(request.orphanOrgsDecision)) {
          const org = await Organization.find(Number(orgId))
          if (!org) continue

          if (decision.action === 'transfer' && decision.newOwnerId) {
            // Transfer ownership
            await this.transferOwnershipInTransaction(
              Number(orgId),
              user.id,
              decision.newOwnerId,
              trx
            )
            summary.organizationsTransferred++
          } else if (decision.action === 'delete') {
            // Delete organization and all its data
            await this.deleteOrganizationData(org, trx)
            await org.useTransaction(trx).delete()
            summary.organizationsDeleted++
          }
        }
      }

      // Get all user's audios (across all remaining orgs)
      const audios = await Audio.query().where('userId', user.id)

      for (const audio of audios) {
        // Load and delete transcription
        await audio.load('transcription')
        if (audio.transcription) {
          summary.transcriptionCount++
        }

        // Load and delete documents
        await audio.load('documents')
        for (const doc of audio.documents) {
          if (doc.filePath) {
            await storageService.deleteFile(doc.filePath).catch(() => {})
          }
          summary.documentCount++
        }

        // Delete audio file
        if (audio.filePath) {
          await storageService.deleteFile(audio.filePath).catch(() => {})
        }
        summary.audioCount++
      }

      // Delete avatar if exists
      if (user.avatar && !user.avatar.startsWith('http')) {
        await storageService.deleteFile(user.avatar).catch(() => {})
      }

      // Delete user (cascades to audios, transcriptions, documents, credit_transactions, etc.)
      await user.useTransaction(trx).delete()

      // Update request as completed
      request.status = DeletionRequestStatus.Completed
      request.processedAt = DateTime.now()
      request.deletionSummary = JSON.stringify(summary)
      await request.useTransaction(trx).save()

      await trx.commit()

      // Send completion email (to stored email since user is deleted)
      await this.sendDeletionCompletedEmail(userEmail, summary, i18n)

      return summary
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Transfer ownership of an organization to another user
   */
  async transferOwnership(
    organizationId: number,
    currentOwnerId: number,
    newOwnerId: number
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      await this.transferOwnershipInTransaction(organizationId, currentOwnerId, newOwnerId, trx)
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Transfer ownership within a transaction
   */
  private async transferOwnershipInTransaction(
    organizationId: number,
    currentOwnerId: number,
    newOwnerId: number,
    trx: any
  ): Promise<void> {
    // Update current owner to member
    await trx
      .from('organization_user')
      .where('organization_id', organizationId)
      .where('user_id', currentOwnerId)
      .update({ role: UserRole.Member })

    // Update new owner
    await trx
      .from('organization_user')
      .where('organization_id', organizationId)
      .where('user_id', newOwnerId)
      .update({ role: UserRole.Owner })
  }

  /**
   * Delete all data for an organization
   */
  private async deleteOrganizationData(org: Organization, _trx: any): Promise<void> {
    // Get all audios for the organization
    const audios = await Audio.query().where('organizationId', org.id)

    for (const audio of audios) {
      // Delete audio file
      if (audio.filePath) {
        await storageService.deleteFile(audio.filePath).catch(() => {})
      }

      // Load and delete documents
      await audio.load('documents')
      for (const doc of audio.documents) {
        if (doc.filePath) {
          await storageService.deleteFile(doc.filePath).catch(() => {})
        }
      }
    }

    // Delete organization logo if exists
    if (org.logo && !org.logo.startsWith('http')) {
      await storageService.deleteFile(org.logo).catch(() => {})
    }
  }

  /**
   * Get the current deletion request for a user
   */
  async getDeletionStatus(userId: number): Promise<DeletionRequest | null> {
    return DeletionRequest.query()
      .where('userId', userId)
      .whereIn('status', [DeletionRequestStatus.Pending, DeletionRequestStatus.Processing])
      .first()
  }

  /**
   * Send email when deletion is requested
   */
  private async sendDeletionRequestedEmail(
    user: User,
    request: DeletionRequest,
    i18n: I18n,
    frontendUrl: string
  ): Promise<void> {
    const cancelUrl = `${frontendUrl}/dashboard/settings/privacy?cancel=${request.token}`
    const scheduledDate = request.scheduledFor
      .setLocale(i18n.locale)
      .toLocaleString(DateTime.DATE_FULL)

    await mail.send((message) => {
      message
        .to(user.email)
        .from('contact@dh-echo.cloud')
        .subject(i18n.t('emails.gdpr_deletion_requested.subject'))
        .htmlView('emails/gdpr_deletion_requested', {
          user,
          scheduledDate,
          cancelUrl,
          i18n,
        })
    })
  }

  /**
   * Send email when deletion is completed
   */
  private async sendDeletionCompletedEmail(
    email: string,
    summary: DeletionSummary,
    i18n: I18n
  ): Promise<void> {
    await mail.send((message) => {
      message
        .to(email)
        .from('contact@dh-echo.cloud')
        .subject(i18n.t('emails.gdpr_deletion_completed.subject'))
        .htmlView('emails/gdpr_deletion_completed', {
          summary,
          i18n,
        })
    })
  }

  /**
   * Send reminder email before deletion
   */
  async sendDeletionReminderEmail(
    user: User,
    request: DeletionRequest,
    daysRemaining: number,
    i18n: I18n,
    frontendUrl: string
  ): Promise<void> {
    const cancelUrl = `${frontendUrl}/dashboard/settings/privacy?cancel=${request.token}`
    const scheduledDate = request.scheduledFor
      .setLocale(i18n.locale)
      .toLocaleString(DateTime.DATE_FULL)

    await mail.send((message) => {
      message
        .to(user.email)
        .from('contact@dh-echo.cloud')
        .subject(
          i18n.t('emails.gdpr_deletion_reminder.subject', {
            daysRemaining: daysRemaining.toString(),
          })
        )
        .htmlView('emails/gdpr_deletion_reminder', {
          user,
          scheduledDate,
          daysRemaining,
          cancelUrl,
          i18n,
        })
    })
  }
}

export default new GdprService()

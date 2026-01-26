import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import Organization from '#models/organization'
import UserCredit from '#models/user_credit'
import notificationService from '#services/notification_service'

export interface AutoRefillCheckResult {
  organizationsChecked: number
  warnings: number
  details: {
    organizationId: number
    organizationName: string
    usersAffected: number
    creditsNeeded: number
    creditsAvailable: number
    notificationSent: boolean
  }[]
}

/**
 * Check for auto-refills due tomorrow and notify owners if there are insufficient credits.
 * This should be run daily via CRON, ideally at end of day (e.g., 18:00 or 20:00).
 */
export async function checkAutoRefillsForTomorrow(): Promise<AutoRefillCheckResult> {
  const tomorrow = DateTime.now().plus({ days: 1 }).day

  logger.info(`[AutoRefillCheckJob] Checking auto-refills due on day ${tomorrow}`)

  const result: AutoRefillCheckResult = {
    organizationsChecked: 0,
    warnings: 0,
    details: [],
  }

  // Find all user credits with auto-refill enabled for tomorrow, grouped by organization
  const userCredits = await UserCredit.query()
    .where('autoRefillEnabled', true)
    .where('autoRefillDay', tomorrow)
    .preload('user')
    .preload('organization')

  if (userCredits.length === 0) {
    logger.info('[AutoRefillCheckJob] No auto-refills scheduled for tomorrow')
    return result
  }

  // Group by organization
  const orgRefills = new Map<
    number,
    {
      organization: Organization
      userCredits: UserCredit[]
      totalCreditsNeeded: number
    }
  >()

  for (const userCredit of userCredits) {
    const orgId = userCredit.organizationId
    const organization = userCredit.organization

    // Skip if organization is not in individual mode
    if (!organization.isIndividualMode()) {
      continue
    }

    if (!orgRefills.has(orgId)) {
      orgRefills.set(orgId, {
        organization,
        userCredits: [],
        totalCreditsNeeded: 0,
      })
    }

    const orgData = orgRefills.get(orgId)!
    orgData.userCredits.push(userCredit)

    // Calculate credits needed for this user's refill
    // Refill brings user balance up to their autoRefillAmount (credit cap)
    const creditsNeeded = userCredit.getCreditsNeededForRefill()
    orgData.totalCreditsNeeded += creditsNeeded
  }

  // Check each organization's pool and send warnings if insufficient
  for (const [orgId, orgData] of orgRefills) {
    result.organizationsChecked++

    const { organization, userCredits: usersWithRefill, totalCreditsNeeded } = orgData
    const creditsAvailable = organization.credits

    const detail = {
      organizationId: orgId,
      organizationName: organization.name,
      usersAffected: usersWithRefill.length,
      creditsNeeded: totalCreditsNeeded,
      creditsAvailable,
      notificationSent: false,
    }

    // If organization doesn't have enough credits, notify owner
    if (totalCreditsNeeded > 0 && creditsAvailable < totalCreditsNeeded) {
      try {
        await notificationService.notifyInsufficientRefill(
          orgId,
          totalCreditsNeeded,
          creditsAvailable
        )
        detail.notificationSent = true
        result.warnings++

        logger.info(
          `[AutoRefillCheckJob] Warning sent for ${organization.name}: ` +
            `needs ${totalCreditsNeeded} credits, has ${creditsAvailable}`
        )
      } catch (error) {
        logger.error(
          `[AutoRefillCheckJob] Failed to send notification for ${organization.name}:`,
          error
        )
      }
    }

    result.details.push(detail)
  }

  logger.info(
    `[AutoRefillCheckJob] Completed. Checked: ${result.organizationsChecked} organizations, Warnings sent: ${result.warnings}`
  )

  return result
}

export default {
  checkAutoRefillsForTomorrow,
}

import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import CreditRequest, { CreditRequestStatus } from '#models/credit_request'

export interface CleanupResult {
  deleted: number
  scanned: number
}

/**
 * Clean up old credit requests that have been processed (not pending).
 * Only deletes requests older than the specified number of days.
 *
 * IMPORTANT: Pending requests are NEVER deleted to preserve user requests.
 *
 * @param days - Number of days to keep requests (default: 90)
 * @returns CleanupResult with count of deleted requests
 */
export async function cleanupOldCreditRequests(days: number = 90): Promise<CleanupResult> {
  const cutoffDate = DateTime.now().minus({ days })

  logger.info(
    `[CreditRequestCleanup] Starting cleanup for requests older than ${days} days (before ${cutoffDate.toFormat('yyyy-MM-dd')})`
  )

  // Count total requests that match criteria (for reporting)
  const toDelete = await CreditRequest.query()
    .where('createdAt', '<', cutoffDate.toSQL())
    .whereNot('status', CreditRequestStatus.Pending)

  const scanned = toDelete.length

  if (scanned === 0) {
    logger.info('[CreditRequestCleanup] No old credit requests to clean up')
    return { deleted: 0, scanned: 0 }
  }

  // Delete old processed requests (approved or rejected only)
  const deleteResult = await CreditRequest.query()
    .where('createdAt', '<', cutoffDate.toSQL())
    .whereNot('status', CreditRequestStatus.Pending)
    .delete()

  // deleteResult is an array with affected row counts in PostgreSQL
  const deleted = Array.isArray(deleteResult) ? deleteResult[0] : deleteResult

  logger.info(`[CreditRequestCleanup] Deleted ${deleted} old credit request(s)`)

  return { deleted, scanned }
}

export default {
  cleanupOldCreditRequests,
}

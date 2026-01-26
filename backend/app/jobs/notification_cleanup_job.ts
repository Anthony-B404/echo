import notificationService from '#services/notification_service'

export interface NotificationCleanupResult {
  deleted: number
}

/**
 * Clean up old read notifications (older than specified days)
 * This should be run daily via CRON
 */
export async function cleanupOldNotifications(
  days: number = 30
): Promise<NotificationCleanupResult> {
  const deleted = await notificationService.cleanupOldNotifications(days)

  return {
    deleted,
  }
}

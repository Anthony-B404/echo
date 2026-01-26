import type { HttpContext } from '@adonisjs/core/http'
import notificationService from '#services/notification_service'
import Notification from '#models/notification'

/**
 * Helper class for notification controller operations.
 * Shared logic between NotificationsController and ResellerNotificationsController.
 */
export class NotificationControllerHelper {
  /**
   * Get paginated notifications for a user
   */
  async getNotifications(userId: number, page: number, limit: number) {
    return notificationService.getUserNotifications(userId, page, limit)
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: number) {
    return notificationService.getUnreadCount(userId)
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(
    notificationId: number,
    { bouncer, i18n, response }: Pick<HttpContext, 'bouncer' | 'i18n' | 'response'>
  ) {
    if (Number.isNaN(notificationId)) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const notification = await Notification.find(notificationId)
    if (!notification) {
      return response.notFound({
        message: i18n.t('messages.errors.not_found'),
      })
    }

    // Check authorization
    await bouncer.with('NotificationPolicy').authorize('markRead', notification)

    await notification.markAsRead()

    return response.ok({
      message: i18n.t('messages.notifications.marked_as_read'),
      notification,
    })
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number, { i18n, response }: Pick<HttpContext, 'i18n' | 'response'>) {
    const count = await notificationService.markAllAsRead(userId)

    return response.ok({
      message: i18n.t('messages.notifications.all_marked_as_read'),
      count,
    })
  }
}

export default new NotificationControllerHelper()

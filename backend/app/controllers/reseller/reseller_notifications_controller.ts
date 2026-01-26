import type { HttpContext } from '@adonisjs/core/http'
import { notificationQueryValidator } from '#validators/notification'
import notificationHelper from '#helpers/notification_controller_helper'

export default class ResellerNotificationsController {
  /**
   * Get paginated notifications for the current reseller admin.
   *
   * GET /api/reseller/notifications
   */
  async index({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const { page, limit } = await request.validateUsing(notificationQueryValidator)

    const result = await notificationHelper.getNotifications(user.id, page ?? 1, limit ?? 20)

    return response.ok({
      notifications: result.notifications,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
    })
  }

  /**
   * Get the count of unread notifications for the current reseller admin.
   *
   * GET /api/reseller/notifications/unread-count
   */
  async unreadCount({ response, auth }: HttpContext) {
    const user = auth.user!
    const count = await notificationHelper.getUnreadCount(user.id)

    return response.ok({ count })
  }

  /**
   * Mark a specific notification as read.
   *
   * POST /api/reseller/notifications/:id/read
   */
  async markRead(ctx: HttpContext) {
    const notificationId = Number(ctx.params.id)
    return notificationHelper.markAsRead(notificationId, ctx)
  }

  /**
   * Mark all notifications as read for the current reseller admin.
   *
   * POST /api/reseller/notifications/read-all
   */
  async markAllRead(ctx: HttpContext) {
    const user = ctx.auth.user!
    return notificationHelper.markAllAsRead(user.id, ctx)
  }
}

import { DateTime } from 'luxon'
import i18nManager from '@adonisjs/i18n/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Notification, { NotificationType, type NotificationData } from '#models/notification'
import Organization from '#models/organization'
import User from '#models/user'

export interface NotificationPaginationResult {
  notifications: Notification[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Service for managing in-app notifications.
 * Handles creation, retrieval, and lifecycle of notifications.
 */
class NotificationService {
  /**
   * Get a translated message for notifications.
   */
  private t(key: string, data?: Record<string, string | number>, locale?: string): string {
    const i18n = i18nManager.locale(locale || 'en')
    return i18n.t(`notifications.${key}`, data)
  }

  /**
   * Create a notification for a specific user
   */
  async createForUser(
    userId: number,
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string | null,
    data?: NotificationData | null
  ): Promise<Notification> {
    logger.info(
      { userId, organizationId, type },
      '[NotificationService] Creating notification for user'
    )
    try {
      const notification = await Notification.create({
        userId,
        organizationId,
        type,
        title,
        message: message ?? null,
        data: data ?? null,
        isRead: false,
      })
      logger.debug(
        { notificationId: notification.id },
        '[NotificationService] Notification created successfully'
      )
      return notification
    } catch (error) {
      logger.error(
        { error, userId, organizationId, type },
        '[NotificationService] Failed to create notification'
      )
      throw error
    }
  }

  /**
   * Create a notification for the Owner of an organization
   */
  async createForOwner(
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string | null,
    data?: NotificationData | null
  ): Promise<Notification | null> {
    logger.info(
      { organizationId, type },
      '[NotificationService] Creating notification for organization owner'
    )

    const organization = await Organization.find(organizationId)
    if (!organization) {
      logger.warn({ organizationId }, '[NotificationService] Organization not found')
      return null
    }

    const owner = await organization.getOwner()
    if (!owner) {
      logger.warn({ organizationId }, '[NotificationService] Organization owner not found')
      return null
    }

    return this.createForUser(owner.id, organizationId, type, title, message, data)
  }

  /**
   * Create notifications for all admins of a reseller
   */
  async createForReseller(
    resellerId: number,
    organizationId: number,
    type: NotificationType,
    title: string,
    message?: string | null,
    data?: NotificationData | null
  ): Promise<Notification[]> {
    // Find all users that are admins for this reseller
    const resellerAdmins = await User.query().where('resellerId', resellerId)

    if (resellerAdmins.length === 0) {
      logger.warn({ resellerId }, '[NotificationService] No reseller admins found')
      return []
    }

    logger.info(
      { resellerId, organizationId, type, adminCount: resellerAdmins.length },
      '[NotificationService] Creating notifications for reseller admins'
    )

    const trx = await db.transaction()
    try {
      const notifications: Notification[] = []
      for (const admin of resellerAdmins) {
        const notification = await Notification.create(
          {
            userId: admin.id,
            organizationId,
            type,
            title,
            message: message ?? null,
            data: data ?? null,
            isRead: false,
          },
          { client: trx }
        )
        notifications.push(notification)
      }
      await trx.commit()
      logger.info(
        { resellerId, notificationCount: notifications.length },
        '[NotificationService] Reseller notifications created successfully'
      )
      return notifications
    } catch (error) {
      await trx.rollback()
      logger.error(
        { error, resellerId, organizationId, type },
        '[NotificationService] Failed to create reseller notifications, transaction rolled back'
      )
      throw error
    }
  }

  /**
   * Check if there's a recent low_credits notification for an organization (for deduplication)
   * Returns true if a notification was sent in the last 24 hours
   */
  async hasRecentLowCreditsNotification(organizationId: number): Promise<boolean> {
    const twentyFourHoursAgo = DateTime.now().minus({ hours: 24 })

    const recentNotification = await Notification.query()
      .where('organizationId', organizationId)
      .where('type', NotificationType.LowCredits)
      .where('createdAt', '>', twentyFourHoursAgo.toSQL())
      .first()

    return recentNotification !== null
  }

  /**
   * Get paginated notifications for a user
   */
  async getUserNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<NotificationPaginationResult> {
    const offset = (page - 1) * limit

    const [notifications, countResult] = await Promise.all([
      Notification.query()
        .where('userId', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset),
      Notification.query().where('userId', userId).count('id as total'),
    ])

    const total = Number(countResult[0].$extras.total)

    return {
      notifications,
      total,
      page,
      limit,
      hasMore: offset + notifications.length < total,
    }
  }

  /**
   * Get the count of unread notifications for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    const result = await Notification.query()
      .where('userId', userId)
      .where('isRead', false)
      .count('id as count')

    return Number(result[0].$extras.count)
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<Notification | null> {
    logger.debug({ notificationId, userId }, '[NotificationService] Marking notification as read')

    const notification = await Notification.query()
      .where('id', notificationId)
      .where('userId', userId)
      .first()

    if (!notification) {
      logger.debug(
        { notificationId, userId },
        '[NotificationService] Notification not found for user'
      )
      return null
    }

    await notification.markAsRead()
    return notification
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    const result = await Notification.query()
      .where('userId', userId)
      .where('isRead', false)
      .update({
        isRead: true,
        readAt: DateTime.now().toSQL(),
      })

    const count = result[0] ?? 0
    logger.info({ userId, count }, '[NotificationService] Marked all notifications as read')
    return count
  }

  /**
   * Cleanup old read notifications (older than 30 days)
   * Returns the number of deleted notifications
   */
  async cleanupOldNotifications(days: number = 30): Promise<number> {
    const cutoffDate = DateTime.now().minus({ days })

    logger.info(
      { days, cutoffDate: cutoffDate.toISO() },
      '[NotificationService] Starting cleanup of old notifications'
    )

    const result = await Notification.query()
      .where('isRead', true)
      .whereNotNull('readAt')
      .where('readAt', '<', cutoffDate.toSQL())
      .delete()

    const count = result[0] ?? 0
    logger.info({ count, days }, '[NotificationService] Cleaned up old notifications')
    return count
  }

  /**
   * Create a credit request notification for the owner
   */
  async notifyCreditRequest(
    organizationId: number,
    requesterId: number,
    requesterName: string,
    amount: number,
    locale?: string
  ): Promise<Notification | null> {
    const title = this.t('credit_request.title', {}, locale)
    const message = this.t('credit_request.message', { name: requesterName, amount }, locale)

    return this.createForOwner(organizationId, NotificationType.CreditRequest, title, message, {
      requesterId,
      requesterName,
      amount,
      link: '/dashboard/credits?tab=pendingRequests',
    })
  }

  /**
   * Create a credit request notification for reseller admins
   */
  async notifyOwnerCreditRequest(
    resellerId: number,
    organizationId: number,
    organizationName: string,
    amount: number,
    locale?: string
  ): Promise<Notification[]> {
    const title = this.t('owner_credit_request.title', {}, locale)
    const message = this.t(
      'owner_credit_request.message',
      { orgName: organizationName, amount },
      locale
    )

    return this.createForReseller(
      resellerId,
      organizationId,
      NotificationType.OwnerCreditRequest,
      title,
      message,
      {
        organizationId,
        organizationName,
        amount,
        link: '/reseller/credits?tab=requests',
      }
    )
  }

  /**
   * Create a low credits notification for the owner
   */
  async notifyLowCredits(
    organizationId: number,
    balance: number,
    locale?: string
  ): Promise<Notification | null> {
    // Check for deduplication
    const hasRecent = await this.hasRecentLowCreditsNotification(organizationId)
    if (hasRecent) {
      return null
    }

    const title = this.t('low_credits.title', {}, locale)
    const message = this.t('low_credits.message', { balance }, locale)

    return this.createForOwner(organizationId, NotificationType.LowCredits, title, message, {
      balance,
      threshold: 100,
      link: '/dashboard/credits',
    })
  }

  /**
   * Create an insufficient refill notification for the owner
   */
  async notifyInsufficientRefill(
    organizationId: number,
    requiredCredits: number,
    availableCredits: number,
    locale?: string
  ): Promise<Notification | null> {
    const title = this.t('insufficient_refill.title', {}, locale)
    const message = this.t('insufficient_refill.message', {}, locale)

    return this.createForOwner(
      organizationId,
      NotificationType.InsufficientRefill,
      title,
      message,
      {
        amount: requiredCredits,
        balance: availableCredits,
        link: '/dashboard/credits',
      }
    )
  }

  /**
   * Create a reseller distribution notification for the owner
   */
  async notifyResellerDistribution(
    organizationId: number,
    amount: number,
    locale?: string
  ): Promise<Notification | null> {
    const title = this.t('reseller_distribution.title', {}, locale)
    const message = this.t('reseller_distribution.message', { amount }, locale)

    return this.createForOwner(
      organizationId,
      NotificationType.ResellerDistribution,
      title,
      message,
      {
        amount,
        link: '/dashboard/credits',
      }
    )
  }

  /**
   * Create a credits received notification for a member
   */
  async notifyCreditsReceived(
    userId: number,
    organizationId: number,
    amount: number,
    locale?: string
  ): Promise<Notification> {
    const title = this.t('credits_received.title', {}, locale)
    const message = this.t('credits_received.message', { amount }, locale)

    return this.createForUser(
      userId,
      organizationId,
      NotificationType.CreditsReceived,
      title,
      message,
      {
        amount,
        link: '/dashboard/credits',
      }
    )
  }
}

export default new NotificationService()

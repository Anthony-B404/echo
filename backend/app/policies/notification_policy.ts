import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'
import User from '#models/user'
import Notification from '#models/notification'

export default class NotificationPolicy extends BasePolicy {
  /**
   * Check if user can mark a notification as read
   * User can only mark their own notifications as read
   */
  public async markRead(user: User, notification: Notification): Promise<AuthorizerResponse> {
    return user.id === notification.userId
  }

  /**
   * Check if user can view a notification
   * User can only view their own notifications
   */
  public async view(user: User, notification: Notification): Promise<AuthorizerResponse> {
    return user.id === notification.userId
  }
}

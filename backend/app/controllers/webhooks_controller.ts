import type { HttpContext } from '@adonisjs/core/http'
import Subscription, { SubscriptionStatus } from '#models/subscription'
import User from '#models/user'
import env from '#start/env'
import { createHmac } from 'node:crypto'
import { DateTime } from 'luxon'

export default class WebhooksController {
  /**
   * Handle Lemon Squeezy webhooks
   */
  public async handleLemonSqueezy({ request, response }: HttpContext) {
    // Get raw body for signature verification
    const rawBody = request.raw() || JSON.stringify(request.body())
    const signature = request.header('X-Signature')

    // Verify webhook signature
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return response.status(401).json({ error: 'Invalid signature' })
    }

    const payload = request.body()
    const eventName = payload.meta?.event_name

    console.log('Received Lemon Squeezy webhook:', eventName)

    try {
      switch (eventName) {
        case 'subscription_created':
          await this.handleSubscriptionCreated(payload)
          break
        // Future events can be added here:
        // case 'subscription_updated':
        // case 'subscription_cancelled':
        // case 'subscription_resumed':
        // case 'subscription_expired':
        default:
          console.log('Unhandled webhook event:', eventName)
      }

      return response.ok({ received: true })
    } catch (error) {
      console.error('Webhook processing error:', error)
      return response.status(500).json({ error: 'Webhook processing failed' })
    }
  }

  /**
   * Verify Lemon Squeezy webhook signature
   */
  private verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
    if (!signature) {
      return false
    }

    const secret = env.get('LEMON_SQUEEZY_WEBHOOK_SECRET')
    const hmac = createHmac('sha256', secret)
    const digest = hmac.update(payload).digest('hex')

    return signature === digest
  }

  /**
   * Handle subscription_created event
   */
  private async handleSubscriptionCreated(payload: any) {
    const subscriptionData = payload.data.attributes
    const customData = payload.meta?.custom_data

    // Extract user_id from custom data
    const userId = customData?.user_id

    if (!userId) {
      console.error('No user_id found in webhook payload')
      throw new Error('Missing user_id in webhook payload')
    }

    // Find user by ID
    const user = await User.find(Number(userId))

    if (!user) {
      console.error('User not found for ID:', userId)
      throw new Error(`User not found: ${userId}`)
    }

    // Check if subscription already exists for this Lemon Squeezy subscription
    const existingSubscription = await Subscription.findBy(
      'lemonSqueezySubscriptionId',
      String(payload.data.id)
    )

    if (existingSubscription) {
      console.log('Subscription already exists, skipping creation')
      return
    }

    // Map Lemon Squeezy status to our enum
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.Active,
      cancelled: SubscriptionStatus.Cancelled,
      expired: SubscriptionStatus.Expired,
      paused: SubscriptionStatus.Paused,
      past_due: SubscriptionStatus.PastDue,
      unpaid: SubscriptionStatus.Unpaid,
      on_trial: SubscriptionStatus.OnTrial,
    }

    const status = statusMap[subscriptionData.status] || SubscriptionStatus.Active

    // Create subscription record
    await Subscription.create({
      userId: user.id,
      lemonSqueezySubscriptionId: String(payload.data.id),
      lemonSqueezyCustomerId: String(subscriptionData.customer_id),
      lemonSqueezyVariantId: String(subscriptionData.variant_id),
      status: status,
      currentPeriodEnd: subscriptionData.renews_at ? DateTime.fromISO(subscriptionData.renews_at) : null,
    })

    console.log('Subscription created for user:', user.id)
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { SubscriptionStatus } from '#models/subscription'

interface LemonSqueezyCheckoutResponse {
  data: {
    attributes: {
      url: string
    }
  }
}

interface LemonSqueezySubscriptionResponse {
  data: {
    id: string
    attributes: {
      status: string
      card_brand: string | null
      card_last_four: string | null
      renews_at: string | null
      ends_at: string | null
      urls: {
        update_payment_method: string
        customer_portal: string
      }
    }
  }
}

export default class BillingController {
  /**
   * Get subscription status for current user
   */
  public async getSubscriptionStatus({ auth, response, i18n }: HttpContext) {
    const user = auth.user

    if (!user) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    await user.load('subscription')

    // Check if user is owner of current organization
    const isOwnerOfCurrentOrganization = user.currentOrganizationId
      ? await user.isOwnerOf(user.currentOrganizationId)
      : false

    // Build trial info (always included)
    const trialInfo = {
      isOnTrial: user.isOnTrial(),
      trialStartedAt: user.trialStartedAt?.toISO() ?? null,
      trialEndsAt: user.trialEndsAt?.toISO() ?? null,
      trialDaysRemaining: user.getTrialDaysRemaining(),
      trialExpired: user.isTrialExpired(),
      trialUsed: user.trialUsed,
    }

    // Calculate effective access based on role
    let effectiveHasAccess: boolean
    if (isOwnerOfCurrentOrganization) {
      // Owner: check their own access
      effectiveHasAccess = await user.hasAccess()
    } else {
      // Member: check organization owner's access
      const ownerAccess = await user.getOrganizationOwnerAccess()
      effectiveHasAccess = ownerAccess.hasAccess
    }

    if (!user.subscription) {
      return response.ok({
        hasSubscription: false,
        subscription: null,
        trial: trialInfo,
        hasAccess: effectiveHasAccess,
        isOwnerOfCurrentOrganization,
      })
    }

    // Fetch fresh data from Lemon Squeezy API
    try {
      const lsResponse = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${user.subscription.lemonSqueezySubscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${env.get('LEMON_SQUEEZY_API_KEY')}`,
            Accept: 'application/vnd.api+json',
          },
        }
      )

      if (lsResponse.ok) {
        const lsData = (await lsResponse.json()) as LemonSqueezySubscriptionResponse
        const attrs = lsData.data.attributes

        // Update local subscription with fresh card info
        if (
          attrs.card_brand !== user.subscription.cardBrand ||
          attrs.card_last_four !== user.subscription.cardLastFour
        ) {
          user.subscription.cardBrand = attrs.card_brand
          user.subscription.cardLastFour = attrs.card_last_four
          await user.subscription.save()
        }

        return response.ok({
          hasSubscription: true,
          subscription: {
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            isActive: user.subscription.isActive(),
            cardBrand: attrs.card_brand,
            cardLastFour: attrs.card_last_four,
            updatePaymentMethodUrl: attrs.urls.update_payment_method,
          },
          trial: trialInfo,
          hasAccess: effectiveHasAccess,
          isOwnerOfCurrentOrganization,
        })
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch subscription from Lemon Squeezy')
    }

    // Fallback to local data if API call fails
    return response.ok({
      hasSubscription: true,
      subscription: {
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        isActive: user.subscription.isActive(),
        cardBrand: user.subscription.cardBrand,
        cardLastFour: user.subscription.cardLastFour,
        updatePaymentMethodUrl: null,
      },
      trial: trialInfo,
      hasAccess: effectiveHasAccess,
      isOwnerOfCurrentOrganization,
    })
  }

  /**
   * Create Lemon Squeezy checkout session
   */
  public async createCheckoutSession({ auth, response, i18n }: HttpContext) {
    const user = auth.user

    if (!user) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    // Check if user already has an active subscription
    await user.load('subscription')
    if (user.subscription?.isActive()) {
      return response.status(400).json({
        message: i18n.t('messages.billing.already_subscribed'),
      })
    }

    // Map locale to ISO country code for checkout localization
    const localeToCountry: Record<string, string> = {
      fr: 'FR',
      en: 'US',
    }
    const country = localeToCountry[i18n.locale] || 'US'

    try {
      const checkoutResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.get('LEMON_SQUEEZY_API_KEY')}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                email: user.email,
                name: user.fullName || undefined,
                billing_address: {
                  country: country,
                },
                custom: {
                  user_id: String(user.id),
                },
              },
              product_options: {
                redirect_url: `${env.get('FRONTEND_URL')}/dashboard/settings/billing?success=true`,
              },
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: env.get('LEMON_SQUEEZY_STORE_ID'),
                },
              },
              variant: {
                data: {
                  type: 'variants',
                  id: env.get('LEMON_SQUEEZY_VARIANT_ID'),
                },
              },
            },
          },
        }),
      })

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json()
        logger.error({ err: errorData }, 'Lemon Squeezy checkout error')
        return response.status(500).json({
          message: i18n.t('messages.billing.checkout_failed'),
        })
      }

      const checkoutData = (await checkoutResponse.json()) as LemonSqueezyCheckoutResponse
      const checkoutUrl = checkoutData.data.attributes.url

      return response.ok({
        checkoutUrl,
      })
    } catch (error) {
      logger.error({ err: error }, 'Checkout creation error')
      return response.status(500).json({
        message: i18n.t('messages.billing.checkout_failed'),
      })
    }
  }

  /**
   * Cancel subscription
   */
  public async cancelSubscription({ auth, response, i18n }: HttpContext) {
    const user = auth.user

    if (!user) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    await user.load('subscription')

    if (!user.subscription) {
      return response.status(404).json({
        message: i18n.t('messages.billing.subscription_not_found'),
      })
    }

    if (!user.subscription.isActive()) {
      return response.status(400).json({
        message: i18n.t('messages.billing.no_active_subscription'),
      })
    }

    try {
      const cancelResponse = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${user.subscription.lemonSqueezySubscriptionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${env.get('LEMON_SQUEEZY_API_KEY')}`,
            Accept: 'application/vnd.api+json',
          },
        }
      )

      if (!cancelResponse.ok) {
        const errorData = await cancelResponse.json()
        logger.error({ err: errorData }, 'Lemon Squeezy cancel error')
        return response.status(500).json({
          message: i18n.t('messages.billing.cancel_failed'),
        })
      }

      // Update local subscription status
      user.subscription.status = SubscriptionStatus.Cancelled
      await user.subscription.save()

      return response.ok({
        message: i18n.t('messages.billing.subscription_cancelled'),
      })
    } catch (error) {
      logger.error({ err: error }, 'Subscription cancellation error')
      return response.status(500).json({
        message: i18n.t('messages.billing.cancel_failed'),
      })
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  public async reactivateSubscription({ auth, response, i18n }: HttpContext) {
    const user = auth.user

    if (!user) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    await user.load('subscription')

    if (!user.subscription) {
      return response.status(404).json({
        message: i18n.t('messages.billing.subscription_not_found'),
      })
    }

    if (user.subscription.status !== SubscriptionStatus.Cancelled) {
      return response.status(400).json({
        message: i18n.t('messages.billing.no_active_subscription'),
      })
    }

    // Check if subscription has expired
    if (
      user.subscription.currentPeriodEnd &&
      user.subscription.currentPeriodEnd.toJSDate() < new Date()
    ) {
      return response.status(400).json({
        message: i18n.t('messages.billing.cannot_reactivate'),
      })
    }

    try {
      const reactivateResponse = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${user.subscription.lemonSqueezySubscriptionId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${env.get('LEMON_SQUEEZY_API_KEY')}`,
            'Content-Type': 'application/vnd.api+json',
            'Accept': 'application/vnd.api+json',
          },
          body: JSON.stringify({
            data: {
              type: 'subscriptions',
              id: user.subscription.lemonSqueezySubscriptionId,
              attributes: {
                cancelled: false,
              },
            },
          }),
        }
      )

      if (!reactivateResponse.ok) {
        const errorData = await reactivateResponse.json()
        logger.error({ err: errorData }, 'Lemon Squeezy reactivate error')
        return response.status(500).json({
          message: i18n.t('messages.billing.reactivate_failed'),
        })
      }

      // Update local subscription status
      user.subscription.status = SubscriptionStatus.Active
      await user.subscription.save()

      return response.ok({
        message: i18n.t('messages.billing.subscription_reactivated'),
      })
    } catch (error) {
      logger.error({ err: error }, 'Subscription reactivation error')
      return response.status(500).json({
        message: i18n.t('messages.billing.reactivate_failed'),
      })
    }
  }
}

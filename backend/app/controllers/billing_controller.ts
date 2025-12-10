import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

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

    if (!user.subscription) {
      return response.ok({
        hasSubscription: false,
        subscription: null,
      })
    }

    return response.ok({
      hasSubscription: true,
      subscription: {
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        isActive: user.subscription.isActive(),
      },
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
        console.error('Lemon Squeezy checkout error:', errorData)
        return response.status(500).json({
          message: i18n.t('messages.billing.checkout_failed'),
        })
      }

      const checkoutData = await checkoutResponse.json()
      const checkoutUrl = checkoutData.data.attributes.url

      return response.ok({
        checkoutUrl,
      })
    } catch (error) {
      console.error('Checkout creation error:', error)
      return response.status(500).json({
        message: i18n.t('messages.billing.checkout_failed'),
      })
    }
  }
}

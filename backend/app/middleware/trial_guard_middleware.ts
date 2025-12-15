import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Subscription guard middleware checks if the user has access to the application.
 * For owners: checks their own trial/subscription status.
 * For members: checks the organization owner's trial/subscription status.
 */
export default class TrialGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { auth, response, i18n } = ctx
    const user = auth.user

    if (!user) {
      return next()
    }

    // Determine if user is owner of current organization
    const isOwner = user.currentOrganizationId
      ? await user.isOwnerOf(user.currentOrganizationId)
      : false

    let hasAccess: boolean

    if (isOwner) {
      // Owner: check their own access
      hasAccess = await user.hasAccess()
    } else {
      // Member: check organization owner's access
      const ownerAccess = await user.getOrganizationOwnerAccess()
      hasAccess = ownerAccess.hasAccess
    }

    if (!hasAccess) {
      return response.status(402).json({
        code: 'SUBSCRIPTION_ENDED',
        message: i18n.t('messages.billing.subscription_ended'),
        subscriptionEnded: true,
        isOwner,
      })
    }

    return next()
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import CreditTransaction from '#models/credit_transaction'
import vine from '@vinejs/vine'

export default class CreditsController {
  /**
   * Get current organization's credit balance.
   *
   * GET /api/credits
   */
  async balance({ response, auth }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    return response.ok({
      credits: user.currentOrganization?.credits ?? 0,
    })
  }

  /**
   * Get credit transaction history for the current organization.
   *
   * GET /api/credits/history
   */
  async history({ request, response, auth }: HttpContext) {
    const user = auth.user!

    // Validate query parameters
    const validator = vine.compile(
      vine.object({
        page: vine.number().positive().optional(),
        limit: vine.number().positive().max(100).optional(),
        type: vine.string().optional(),
      })
    )

    const { page = 1, limit = 20, type } = await request.validateUsing(validator)

    const query = CreditTransaction.query()
      .where('organizationId', user.currentOrganizationId!)
      .orderBy('createdAt', 'desc')
      .preload('audio')
      .preload('user', (userQuery) => {
        userQuery.select('id', 'fullName', 'firstName', 'lastName', 'email')
      })

    if (type) {
      query.where('type', type)
    }

    const transactions = await query.paginate(page, limit)

    return response.ok(transactions)
  }
}

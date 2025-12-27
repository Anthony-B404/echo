import type { HttpContext } from '@adonisjs/core/http'
import CreditTransaction from '#models/credit_transaction'
import vine from '@vinejs/vine'

export default class CreditsController {
  /**
   * Get current user's credit balance.
   *
   * GET /api/credits
   */
  async balance({ response, auth }: HttpContext) {
    const user = auth.user!

    return response.ok({
      credits: user.credits,
    })
  }

  /**
   * Get credit transaction history for the current user.
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
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .preload('audio')

    if (type) {
      query.where('type', type)
    }

    const transactions = await query.paginate(page, limit)

    return response.ok(transactions)
  }
}

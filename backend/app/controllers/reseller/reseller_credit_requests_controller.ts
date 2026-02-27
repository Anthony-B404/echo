import type { HttpContext } from '@adonisjs/core/http'
import CreditRequest, { CreditRequestType } from '#models/credit_request'
import CreditRequestService from '#services/credit_request_service'
import {
  rejectCreditRequestValidator,
  creditRequestQueryValidator,
} from '#validators/credit_request'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

export default class ResellerCreditRequestsController {
  private creditRequestService = new CreditRequestService()

  /**
   * Get all credit requests from organizations managed by this reseller.
   *
   * GET /api/reseller/credit-requests
   */
  async index({ request, response, reseller }: HttpContext) {
    const {
      page = 1,
      limit = 20,
      status,
    } = await request.validateUsing(creditRequestQueryValidator)

    const result = await this.creditRequestService.getAllRequestsForReseller(
      reseller!.id,
      page,
      limit,
      status
    )

    return response.ok(result)
  }

  /**
   * Get pending credit requests for this reseller.
   *
   * GET /api/reseller/credit-requests/pending
   */
  async pending({ response, reseller }: HttpContext) {
    const requests = await this.creditRequestService.getPendingRequestsForReseller(reseller!.id)

    return response.ok({
      data: requests,
    })
  }

  /**
   * Get count of pending requests for badge notification.
   *
   * GET /api/reseller/credit-requests/pending-count
   */
  async pendingCount({ response, reseller }: HttpContext) {
    const count = await this.creditRequestService.countPendingForReseller(reseller!.id)

    return response.ok({ count })
  }

  /**
   * Approve a credit request from an organization.
   *
   * POST /api/reseller/credit-requests/:id/approve
   */
  async approve({ params, response, auth, reseller, i18n }: HttpContext) {
    const user = auth.user!
    const requestId = Number(params.id)

    const creditRequest = await CreditRequest.query()
      .where('id', requestId)
      .where('resellerId', reseller!.id)
      .where('type', CreditRequestType.OwnerToReseller)
      .first()

    if (!creditRequest) {
      return response.notFound({
        message: i18n.t('messages.credit_requests.not_found'),
      })
    }

    try {
      const result = await this.creditRequestService.approveOwnerRequest(creditRequest, user)

      await result.request.load('requester')
      await result.request.load('organization')
      await result.request.load('processedBy')

      // Send email notification to the requester (organization owner)
      const requester = result.request.requester
      if (requester) {
        await mail.send((message) => {
          message
            .to(requester.email)
            .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
            .subject(i18n.t('emails.credit_request_approved.subject'))
            .htmlView('emails/credit_request_approved', {
              amount: result.creditsDistributed,
              i18n,
              frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
              apiUrl: env.get('API_URL', 'https://api.novika.com'),
            })
        })
      }

      return response.ok({
        message: i18n.t('messages.credit_requests.approved', { amount: result.creditsDistributed }),
        request: result.request,
        creditsDistributed: result.creditsDistributed,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'REQUEST_ALREADY_PROCESSED') {
          return response.conflict({
            message: i18n.t('messages.credit_requests.already_processed'),
            code: 'REQUEST_ALREADY_PROCESSED',
          })
        }
        if (error.message === 'INSUFFICIENT_RESELLER_CREDITS') {
          return response.badRequest({
            message: i18n.t('messages.reseller.insufficient_credits'),
            code: 'INSUFFICIENT_RESELLER_CREDITS',
          })
        }
      }
      throw error
    }
  }

  /**
   * Reject a credit request from an organization.
   *
   * POST /api/reseller/credit-requests/:id/reject
   */
  async reject({ params, request, response, auth, reseller, i18n }: HttpContext) {
    const user = auth.user!
    const requestId = Number(params.id)

    const creditRequest = await CreditRequest.query()
      .where('id', requestId)
      .where('resellerId', reseller!.id)
      .where('type', CreditRequestType.OwnerToReseller)
      .first()

    if (!creditRequest) {
      return response.notFound({
        message: i18n.t('messages.credit_requests.not_found'),
      })
    }

    const { reason } = await request.validateUsing(rejectCreditRequestValidator)

    try {
      const result = await this.creditRequestService.rejectRequest(creditRequest, user, reason)

      await result.request.load('requester')
      await result.request.load('organization')
      await result.request.load('processedBy')

      // Send email notification to the requester (organization owner)
      const requester = result.request.requester
      if (requester) {
        await mail.send((message) => {
          message
            .to(requester.email)
            .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
            .subject(i18n.t('emails.credit_request_rejected.subject'))
            .htmlView('emails/credit_request_rejected', {
              amount: creditRequest.amount,
              reason,
              i18n,
              frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
              apiUrl: env.get('API_URL', 'https://api.novika.com'),
            })
        })
      }

      return response.ok({
        message: i18n.t('messages.credit_requests.rejected'),
        request: result.request,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'REQUEST_ALREADY_PROCESSED') {
        return response.conflict({
          message: i18n.t('messages.credit_requests.already_processed'),
          code: 'REQUEST_ALREADY_PROCESSED',
        })
      }
      throw error
    }
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import CreditRequest from '#models/credit_request'
import CreditRequestService from '#services/credit_request_service'
import {
  createCreditRequestValidator,
  createOwnerCreditRequestValidator,
  rejectCreditRequestValidator,
  creditRequestQueryValidator,
} from '#validators/credit_request'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import User from '#models/user'
import notificationService from '#services/notification_service'

export default class CreditRequestsController {
  private creditRequestService = new CreditRequestService()

  /**
   * Create a credit request (member to owner).
   * Only available in individual mode.
   *
   * POST /api/credit-requests
   */
  async create({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    await bouncer.with('CreditRequestPolicy').authorize('create', organization.id)

    // Check organization is in individual mode
    if (organization.isSharedMode()) {
      return response.badRequest({
        message: i18n.t('messages.credit_requests.invalid_mode_shared'),
        code: 'INVALID_MODE',
      })
    }

    // Check user is not Owner (owners request from reseller, not from themselves)
    const isOwner = await user.isOwnerOf(organization.id)
    if (isOwner) {
      return response.badRequest({
        message: i18n.t('messages.credit_requests.owner_cannot_request_from_self'),
        code: 'OWNER_CANNOT_REQUEST',
      })
    }

    const { amount, justification } = await request.validateUsing(createCreditRequestValidator)

    try {
      const result = await this.creditRequestService.createMemberRequest(
        user,
        organization,
        amount,
        justification
      )

      await result.request.load('requester')

      // Send email notification to organization owner
      const owner = await organization.getOwner()
      if (owner) {
        await mail.send((message) => {
          message
            .to(owner.email)
            .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
            .subject(i18n.t('emails.credit_request_created.subject'))
            .htmlView('emails/credit_request_created', {
              requesterName: user.fullName || user.email,
              amount,
              justification,
              i18n,
              frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
              apiUrl: env.get('API_URL', 'https://api.novika.com'),
            })
        })

        // Create in-app notification for owner
        await notificationService.notifyCreditRequest(
          organization.id,
          user.id,
          user.fullName || user.email,
          amount,
          i18n.locale
        )
      }

      return response.created({
        message: i18n.t('messages.credit_requests.created'),
        request: result.request,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PENDING_REQUEST_EXISTS') {
          return response.conflict({
            message: i18n.t('messages.credit_requests.pending_exists'),
            code: 'PENDING_REQUEST_EXISTS',
          })
        }
        if (error.message === 'INVALID_MODE_FOR_REQUEST') {
          return response.badRequest({
            message: i18n.t('messages.credit_requests.invalid_mode_shared'),
            code: 'INVALID_MODE',
          })
        }
      }
      throw error
    }
  }

  /**
   * Create a credit request from owner to reseller.
   *
   * POST /api/credit-requests/to-reseller
   */
  async createToReseller({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    await bouncer.with('CreditRequestPolicy').authorize('createToReseller', organization.id)

    const { amount, justification } = await request.validateUsing(createOwnerCreditRequestValidator)

    try {
      const result = await this.creditRequestService.createOwnerRequest(
        user,
        organization,
        amount,
        justification
      )

      await result.request.load('requester')
      await result.request.load('organization')

      // Send email notification to reseller admin users
      if (organization.resellerId) {
        const resellerAdmins = await User.query().where('resellerId', organization.resellerId)
        for (const admin of resellerAdmins) {
          await mail.send((message) => {
            message
              .to(admin.email)
              .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
              .subject(
                i18n.t('emails.credit_request_owner_created.subject', {
                  organizationName: organization.name,
                })
              )
              .htmlView('emails/credit_request_owner_created', {
                organizationName: organization.name,
                amount,
                justification,
                i18n,
                frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
                apiUrl: env.get('API_URL', 'https://api.novika.com'),
              })
          })
        }

        // Create in-app notifications for reseller admins
        await notificationService.notifyOwnerCreditRequest(
          organization.resellerId,
          organization.id,
          organization.name,
          amount,
          i18n.locale
        )
      }

      return response.created({
        message: i18n.t('messages.credit_requests.created'),
        request: result.request,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PENDING_REQUEST_EXISTS') {
          return response.conflict({
            message: i18n.t('messages.credit_requests.pending_exists'),
            code: 'PENDING_REQUEST_EXISTS',
          })
        }
        if (error.message === 'NO_RESELLER_ASSIGNED') {
          return response.badRequest({
            message: i18n.t('messages.credit_requests.no_reseller'),
            code: 'NO_RESELLER_ASSIGNED',
          })
        }
      }
      throw error
    }
  }

  /**
   * Get current user's credit requests.
   *
   * GET /api/credit-requests
   */
  async index({ request, response, auth, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const {
      page = 1,
      limit = 20,
      status,
    } = await request.validateUsing(creditRequestQueryValidator)

    const result = await this.creditRequestService.getUserRequests(
      user.id,
      organization.id,
      page,
      limit,
      status
    )

    return response.ok(result)
  }

  /**
   * Get pending requests for the owner to review.
   *
   * GET /api/credit-requests/pending
   */
  async pending({ response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    await bouncer.with('CreditRequestPolicy').authorize('viewPending', organization.id)

    const requests = await this.creditRequestService.getPendingRequestsForOwner(organization.id)

    return response.ok({
      data: requests,
    })
  }

  /**
   * Get count of pending requests for badge notification.
   *
   * GET /api/credit-requests/pending-count
   */
  async pendingCount({ response, auth, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Check if user is owner
    const isOwner = await user.isOwnerOf(organization.id)

    if (isOwner) {
      // Get pending member requests
      const count = await this.creditRequestService.countPendingForOwner(organization.id)
      return response.ok({ count })
    }

    // Non-owners don't have pending requests to review
    return response.ok({ count: 0 })
  }

  /**
   * Approve a credit request.
   *
   * POST /api/credit-requests/:id/approve
   */
  async approve({ params, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    const requestId = Number(params.id)

    const creditRequest = await CreditRequest.find(requestId)
    if (!creditRequest) {
      return response.notFound({
        message: i18n.t('messages.credit_requests.not_found'),
      })
    }

    await bouncer.with('CreditRequestPolicy').authorize('approve', creditRequest)

    try {
      const result = await this.creditRequestService.approveMemberRequest(creditRequest, user)

      await result.request.load('requester')
      await result.request.load('processedBy')

      // Send email notification to the requester
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

        // Create in-app notification for the requester
        if (result.creditsDistributed !== undefined) {
          await notificationService.notifyCreditsReceived(
            requester.id,
            creditRequest.organizationId,
            result.creditsDistributed,
            i18n.locale
          )
        }
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
        if (error.message === 'INSUFFICIENT_ORG_CREDITS') {
          return response.badRequest({
            message: i18n.t('messages.credits.insufficient_org_credits'),
            code: 'INSUFFICIENT_ORG_CREDITS',
          })
        }
        if (error.message === 'INVALID_MODE_FOR_DISTRIBUTION') {
          return response.badRequest({
            message: i18n.t('messages.credits.invalid_mode'),
            code: 'INVALID_MODE',
          })
        }
      }
      throw error
    }
  }

  /**
   * Reject a credit request.
   *
   * POST /api/credit-requests/:id/reject
   */
  async reject({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    const requestId = Number(params.id)

    const creditRequest = await CreditRequest.find(requestId)
    if (!creditRequest) {
      return response.notFound({
        message: i18n.t('messages.credit_requests.not_found'),
      })
    }

    await bouncer.with('CreditRequestPolicy').authorize('reject', creditRequest)

    const { reason } = await request.validateUsing(rejectCreditRequestValidator)

    try {
      const result = await this.creditRequestService.rejectRequest(creditRequest, user, reason)

      await result.request.load('requester')
      await result.request.load('processedBy')

      // Send email notification to the requester
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

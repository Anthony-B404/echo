import type { HttpContext } from '@adonisjs/core/http'
import CreditTransaction from '#models/credit_transaction'
import UserCreditTransaction from '#models/user_credit_transaction'
import User from '#models/user'
import creditService from '#services/credit_service'
import notificationService from '#services/notification_service'
import {
  updateCreditModeValidator,
  distributeCreditValidator,
  recoverCreditValidator,
  configureAutoRefillValidator,
  configureGlobalAutoRefillValidator,
  creditHistoryQueryValidator,
} from '#validators/credit'

export default class CreditsController {
  /**
   * Get current organization's credit balance.
   * Returns balance based on credit mode (shared pool or individual)
   *
   * GET /api/credits
   */
  async balance({ response, auth }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    const effectiveBalance = await creditService.getEffectiveBalance(user, organization)

    return response.ok({
      credits: effectiveBalance,
      mode: organization.creditMode,
      organizationCredits: organization.credits,
    })
  }

  /**
   * Get credit transaction history for the current organization.
   * Owner/Admin see all, Members see only their own.
   *
   * GET /api/credits/history
   */
  async history({ request, response, auth, bouncer }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    const { page = 1, limit = 20, type } = await request.validateUsing(creditHistoryQueryValidator)

    // Check if user can view all history or just their own
    const canViewAll = await bouncer.with('CreditPolicy').allows('viewAllHistory', organization.id)

    if (organization.isIndividualMode() && !canViewAll) {
      // In individual mode, members only see their own user credit transactions
      const transactions = await UserCreditTransaction.query()
        .where('organizationId', organization.id)
        .where('userId', user.id)
        .if(type, (query) => query.where('type', type!))
        .orderBy('createdAt', 'desc')
        .preload('performedBy', (q) => q.select('id', 'fullName', 'firstName', 'lastName', 'email'))
        .preload('audio')
        .paginate(page, limit)

      return response.ok({
        ...transactions.toJSON(),
        mode: organization.creditMode,
      })
    }

    // Owner/Admin in any mode see organization-level transactions
    const query = CreditTransaction.query()
      .where('organizationId', organization.id)
      .orderBy('createdAt', 'desc')
      .preload('audio')
      .preload('user', (userQuery) => {
        userQuery.select('id', 'fullName', 'firstName', 'lastName', 'email')
      })

    if (type) {
      query.where('type', type)
    }

    const transactions = await query.paginate(page, limit)

    return response.ok({
      ...transactions.toJSON(),
      mode: organization.creditMode,
    })
  }

  /**
   * Get the organization's credit mode.
   *
   * GET /api/credits/mode
   */
  async getMode({ response, auth, bouncer }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('viewMode', organization.id)

    return response.ok({
      mode: organization.creditMode,
      organizationCredits: organization.credits,
    })
  }

  /**
   * Update the organization's credit mode.
   * Only Owner can do this.
   *
   * PUT /api/credits/mode
   */
  async updateMode({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('updateMode', organization.id)

    const { mode } = await request.validateUsing(updateCreditModeValidator)

    const result = await creditService.switchCreditMode(organization, mode, user.id)

    const modeLabel =
      mode === 'shared'
        ? i18n.t('messages.credits.mode_shared')
        : i18n.t('messages.credits.mode_individual')

    return response.ok({
      message: i18n.t('messages.credits.mode_changed', { mode: modeLabel }),
      mode: organization.creditMode,
      organizationCredits: organization.credits,
      previousMode: result.previousMode,
      recoveredCredits: result.recoveredCredits,
    })
  }

  /**
   * List all member credits for the organization.
   * Only Owner and Administrator can view.
   *
   * GET /api/credits/members
   */
  async listMembers({ response, auth, bouncer }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('viewMemberCredits', organization.id)

    const memberCredits = await creditService.listMemberCredits(organization.id)

    return response.ok({
      data: memberCredits,
      mode: organization.creditMode,
    })
  }

  /**
   * Distribute credits from organization pool to a user.
   * Only works in individual mode.
   *
   * POST /api/credits/distribute
   */
  async distribute({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('distributeCredits', organization.id)

    if (organization.isSharedMode()) {
      return response.badRequest({
        message: i18n.t('messages.credits.invalid_mode'),
        code: 'INVALID_MODE',
      })
    }

    const { userId, amount, description } = await request.validateUsing(distributeCreditValidator)

    // Verify target user is in the organization
    const targetUser = await User.find(userId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    try {
      const result = await creditService.distributeToUser(
        organization,
        userId,
        amount,
        user.id,
        description
      )

      const targetName = targetUser.fullName || targetUser.firstName || targetUser.email

      // Create in-app notification for the recipient
      await notificationService.notifyCreditsReceived(
        targetUser.id,
        organization.id,
        amount,
        i18n.locale
      )

      return response.ok({
        message: i18n.t('messages.credits.distribution_success', { amount, name: targetName }),
        transaction: result.transaction,
        userBalance: result.userBalance,
        organizationCredits: result.organizationCredits,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INSUFFICIENT_ORG_CREDITS') {
          return response.badRequest({
            message: i18n.t('messages.credits.insufficient_org_credits'),
            code: 'INSUFFICIENT_ORG_CREDITS',
          })
        }
        if (error.message === 'CANNOT_EXCEED_CAP') {
          return response.badRequest({
            message: i18n.t('messages.credits.cannot_exceed_cap'),
            code: 'CANNOT_EXCEED_CAP',
          })
        }
      }
      throw error
    }
  }

  /**
   * Recover credits from a user back to organization pool.
   * Only Owner can do this, only works in individual mode.
   *
   * POST /api/credits/recover
   */
  async recover({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('recoverCredits', organization.id)

    if (organization.isSharedMode()) {
      return response.badRequest({
        message: i18n.t('messages.credits.invalid_mode'),
        code: 'INVALID_MODE',
      })
    }

    const { userId, amount, description } = await request.validateUsing(recoverCreditValidator)

    // Verify target user is in the organization
    const targetUser = await User.find(userId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    try {
      const result = await creditService.recoverFromUser(
        organization,
        userId,
        amount,
        user.id,
        description
      )

      const targetName = targetUser.fullName || targetUser.firstName || targetUser.email

      return response.ok({
        message: i18n.t('messages.credits.recovery_success', { amount, name: targetName }),
        transaction: result.transaction,
        userBalance: result.userBalance,
        organizationCredits: result.organizationCredits,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_USER_CREDITS') {
        return response.badRequest({
          message: i18n.t('messages.credits.insufficient_user_credits'),
          code: 'INSUFFICIENT_USER_CREDITS',
        })
      }
      throw error
    }
  }

  /**
   * Get a specific member's credits.
   * Owner and Administrator can view.
   *
   * GET /api/credits/members/:userId
   */
  async getMemberCredits({ params, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('viewMemberCredits', organization.id)

    const targetUserId = Number(params.userId)
    const targetUser = await User.find(targetUserId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    const userCredit = await creditService.getOrCreateUserCredit(targetUserId, organization.id)
    await userCredit.load('user', (query) => {
      query.select('id', 'fullName', 'firstName', 'lastName', 'email', 'avatar')
    })

    return response.ok({
      userId: userCredit.userId,
      balance: userCredit.balance,
      creditCap: userCredit.creditCap,
      autoRefillEnabled: userCredit.autoRefillEnabled,
      autoRefillAmount: userCredit.autoRefillAmount,
      autoRefillDay: userCredit.autoRefillDay,
      user: userCredit.user,
    })
  }

  /**
   * Get a specific member's credit transaction history.
   *
   * GET /api/credits/members/:userId/history
   */
  async getMemberHistory({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('viewMemberCredits', organization.id)

    const { page = 1, limit = 20 } = await request.validateUsing(creditHistoryQueryValidator)

    const targetUserId = Number(params.userId)
    const targetUser = await User.find(targetUserId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    const transactions = await creditService.getUserCreditHistory(
      targetUserId,
      organization.id,
      page,
      limit
    )

    return response.ok(transactions)
  }

  /**
   * Configure auto-refill for a member's credits.
   *
   * PUT /api/credits/members/:userId/auto-refill
   */
  async configureAutoRefill({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('configureAutoRefill', organization.id)

    const targetUserId = Number(params.userId)
    const targetUser = await User.find(targetUserId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    const { enabled, amount, day } = await request.validateUsing(configureAutoRefillValidator)

    const userCredit = await creditService.getOrCreateUserCredit(targetUserId, organization.id)
    const updatedCredit = await creditService.configureAutoRefill(
      userCredit.id,
      enabled,
      amount,
      day
    )

    const targetName = targetUser.fullName || targetUser.firstName || targetUser.email

    return response.ok({
      message: enabled
        ? i18n.t('messages.credits.auto_refill_enabled', { name: targetName })
        : i18n.t('messages.credits.auto_refill_disabled', { name: targetName }),
      userCredit: {
        userId: updatedCredit.userId,
        balance: updatedCredit.balance,
        creditCap: updatedCredit.creditCap,
        autoRefillEnabled: updatedCredit.autoRefillEnabled,
        autoRefillAmount: updatedCredit.autoRefillAmount,
        autoRefillDay: updatedCredit.autoRefillDay,
      },
    })
  }

  /**
   * Disable auto-refill for a member's credits.
   *
   * DELETE /api/credits/members/:userId/auto-refill
   */
  async disableAutoRefill({ params, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('configureAutoRefill', organization.id)

    const targetUserId = Number(params.userId)
    const targetUser = await User.find(targetUserId)
    if (!targetUser || !(await targetUser.hasOrganization(organization.id))) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    const userCredit = await creditService.getUserCredit(targetUserId, organization.id)
    if (!userCredit) {
      return response.notFound({
        message: i18n.t('messages.credits.user_not_in_organization'),
      })
    }

    const updatedCredit = await creditService.configureAutoRefill(userCredit.id, false)

    const targetName = targetUser.fullName || targetUser.firstName || targetUser.email

    return response.ok({
      message: i18n.t('messages.credits.auto_refill_disabled', { name: targetName }),
      userCredit: {
        userId: updatedCredit.userId,
        balance: updatedCredit.balance,
        creditCap: updatedCredit.creditCap,
        autoRefillEnabled: updatedCredit.autoRefillEnabled,
        autoRefillAmount: updatedCredit.autoRefillAmount,
        autoRefillDay: updatedCredit.autoRefillDay,
      },
    })
  }

  /**
   * Get global auto-refill settings for the organization.
   * Only available in individual credit mode.
   *
   * GET /api/credits/auto-refill
   */
  async getGlobalAutoRefill({ response, auth, bouncer }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('viewMemberCredits', organization.id)

    // Get settings from CreditService - derives from user_credit records
    const settings = await creditService.getGlobalAutoRefillSettings(organization.id)

    return response.ok({
      enabled: settings.enabled,
      defaultAmount: settings.defaultAmount,
      defaultDay: settings.defaultDay,
      creditMode: organization.creditMode,
    })
  }

  /**
   * Configure global auto-refill settings for the organization.
   * Only Owner can do this.
   * When enabled, creates/updates user_credit records for ALL members with the specified settings.
   *
   * PUT /api/credits/auto-refill
   */
  async configureGlobalAutoRefill({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('updateMode', organization.id)

    if (organization.isSharedMode()) {
      return response.badRequest({
        message: i18n.t('messages.credits.invalid_mode'),
        code: 'INVALID_MODE',
      })
    }

    const { enabled, defaultAmount, defaultDay } = await request.validateUsing(
      configureGlobalAutoRefillValidator
    )

    if (enabled) {
      // Enable global auto-refill - creates/updates user_credit records for all members
      await creditService.enableGlobalAutoRefill(
        organization.id,
        defaultAmount!,
        defaultDay!,
        user.id
      )

      // Refresh organization state
      await organization.refresh()

      return response.ok({
        message: i18n.t('messages.credits.global_auto_refill_enabled'),
        enabled: true,
        defaultAmount: defaultAmount!,
        defaultDay: defaultDay!,
      })
    } else {
      // Disable global auto-refill - sets autoRefillEnabled=false on all user_credit records
      await creditService.disableGlobalAutoRefill(organization.id)

      // Refresh organization state
      await organization.refresh()

      return response.ok({
        message: i18n.t('messages.credits.global_auto_refill_disabled'),
        enabled: false,
        defaultAmount: null,
        defaultDay: null,
      })
    }
  }

  /**
   * Disable global auto-refill for the organization.
   * Only Owner can do this.
   * Sets autoRefillEnabled=false on ALL user_credit records but preserves balances.
   *
   * DELETE /api/credits/auto-refill
   */
  async disableGlobalAutoRefill({ response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!
    await user.load('currentOrganization')

    const organization = user.currentOrganization
    if (!organization) {
      return response.badRequest({ message: 'No current organization' })
    }

    await bouncer.with('CreditPolicy').authorize('updateMode', organization.id)

    // Disable global auto-refill - sets autoRefillEnabled=false on all user_credit records
    await creditService.disableGlobalAutoRefill(organization.id)

    // Refresh organization state
    await organization.refresh()

    return response.ok({
      message: i18n.t('messages.credits.global_auto_refill_disabled'),
      enabled: false,
      defaultAmount: null,
      defaultDay: null,
    })
  }
}

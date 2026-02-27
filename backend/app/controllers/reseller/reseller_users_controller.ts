import type { HttpContext } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import Organization from '#models/organization'
import User, { UserRole } from '#models/user'
import {
  createResellerOrgUserValidator,
  listResellerOrgUsersValidator,
} from '#validators/reseller_api'
import creditService from '#services/credit_service'

export default class ResellerUsersController {
  /**
   * List users in an organization
   * GET /api/reseller/organizations/:id/users
   */
  async index({ params, request, response, reseller, i18n }: HttpContext) {
    const organization = await Organization.find(params.id)

    if (!organization) {
      return response.notFound({
        message: i18n.t('messages.organization.not_found'),
      })
    }

    // Policy check: organization must belong to reseller
    if (organization.resellerId !== reseller!.id) {
      return response.forbidden({
        message: i18n.t('messages.reseller_api.organization_access_denied'),
      })
    }

    try {
      const { page = 1, limit = 20 } = await request.validateUsing(listResellerOrgUsersValidator)

      await organization.load('users', (query) => {
        query
          .select([
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'created_at',
            'onboarding_completed',
            'last_invitation_sent_at',
          ])
          .orderBy('created_at', 'desc')
      })

      // Format users with role from pivot
      const allUsers = organization.users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.$extras.pivot_role,
        createdAt: user.createdAt,
        onboardingCompleted: user.onboardingCompleted,
        lastInvitationSentAt: user.lastInvitationSentAt?.toISO() ?? null,
      }))

      // Manual pagination for ManyToMany relation
      const startIndex = (page - 1) * limit
      const paginatedUsers = allUsers.slice(startIndex, startIndex + limit)

      return response.ok({
        data: paginatedUsers,
        meta: {
          total: allUsers.length,
          perPage: limit,
          currentPage: page,
          lastPage: Math.ceil(allUsers.length / limit),
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.unprocessableEntity({
          message: i18n.t('messages.errors.validation_failed'),
          errors: error.messages,
        })
      }
      throw error
    }
  }

  /**
   * Create a new user in an organization
   * POST /api/reseller/organizations/:id/users
   *
   * Flow:
   * 1. Validate user doesn't exist or isn't already in org
   * 2. If user exists: Add to organization with role
   * 3. If user is new: Create user + add to org + send invitation email
   */
  async store({ params, request, response, reseller, i18n }: HttpContext) {
    const organization = await Organization.find(params.id)

    if (!organization) {
      return response.notFound({
        message: i18n.t('messages.organization.not_found'),
      })
    }

    // Policy check: organization must belong to reseller
    if (organization.resellerId !== reseller!.id) {
      return response.forbidden({
        message: i18n.t('messages.reseller_api.organization_access_denied'),
      })
    }

    try {
      const payload = await request.validateUsing(createResellerOrgUserValidator(organization.id))

      // Check if user already exists
      const existingUser = await User.findBy('email', payload.email)

      if (existingUser) {
        // Check if user is already in this organization
        const isMember = await existingUser.hasOrganization(organization.id)
        if (isMember) {
          return response.badRequest({
            code: 'ALREADY_MEMBER',
            message: i18n.t('messages.invitation.already_member'),
          })
        }

        // User exists - just add to organization
        await organization.related('users').attach({
          [existingUser.id]: { role: payload.role },
        })

        // Initialize credits for new member if global auto-refill is active
        await creditService.initializeNewMemberCredits(
          existingUser.id,
          organization.id,
          null // System action (reseller)
        )

        // If user doesn't have a current organization, set this one
        if (!existingUser.currentOrganizationId) {
          existingUser.currentOrganizationId = organization.id
          await existingUser.save()
        }

        // Send notification email about being added to new org
        const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
        const apiUrl = env.get('APP_URL', 'http://localhost:3333')

        await mail.send((message) => {
          message
            .to(existingUser.email)
            .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
            .subject(
              i18n.t('emails.reseller_user_added.subject', {
                organization: organization.name,
              })
            )
            .htmlView('emails/reseller_user_added', {
              userName: existingUser.fullName || existingUser.email,
              organizationName: organization.name,
              role: payload.role === UserRole.Administrator ? 'Administrator' : 'Member',
              loginUrl: `${frontendUrl}/login`,
              i18n,
              apiUrl,
            })
        })

        return response.created({
          message: i18n.t('messages.reseller_api.user_added_existing'),
          user: {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: payload.role,
          },
        })
      }

      // New user - create with magic link
      const magicLinkToken = randomUUID()

      const newUser = await db.transaction(async (trx) => {
        const user = await User.create(
          {
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            fullName: `${payload.firstName} ${payload.lastName}`,
            currentOrganizationId: organization.id,
            magicLinkToken,
            magicLinkExpiresAt: DateTime.now().plus({ days: 7 }),
            onboardingCompleted: false,
            disabled: false,
          },
          { client: trx }
        )

        await organization
          .useTransaction(trx)
          .related('users')
          .attach({
            [user.id]: { role: payload.role },
          })

        return user
      })

      // Initialize credits for new member if global auto-refill is active
      await creditService.initializeNewMemberCredits(
        newUser.id,
        organization.id,
        null // System action (reseller)
      )

      // Send invitation email
      const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
      const apiUrl = env.get('APP_URL', 'http://localhost:3333')

      await mail.send((message) => {
        message
          .to(newUser.email)
          .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
          .subject(
            i18n.t('emails.reseller_user_invitation.subject', {
              organization: organization.name,
            })
          )
          .htmlView('emails/reseller_user_invitation', {
            userName: newUser.fullName,
            organizationName: organization.name,
            role: payload.role === UserRole.Administrator ? 'Administrator' : 'Member',
            setupUrl: `${frontendUrl}/setup/${magicLinkToken}`,
            expiresAt: DateTime.now().plus({ days: 7 }).toFormat('dd/MM/yyyy'),
            i18n,
            apiUrl,
          })
      })

      return response.created({
        message: i18n.t('messages.reseller_api.user_created'),
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: payload.role,
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.unprocessableEntity({
          message: i18n.t('messages.errors.validation_failed'),
          errors: error.messages,
        })
      }
      throw error
    }
  }

  /**
   * Remove a user from an organization
   * DELETE /api/reseller/organizations/:id/users/:userId
   *
   * Rules:
   * - Cannot remove the Owner
   * - If user has no other organizations, disable the user
   */
  async destroy({ params, response, reseller, i18n }: HttpContext) {
    const organization = await Organization.find(params.id)

    if (!organization) {
      return response.notFound({
        message: i18n.t('messages.organization.not_found'),
      })
    }

    // Policy check: organization must belong to reseller
    if (organization.resellerId !== reseller!.id) {
      return response.forbidden({
        message: i18n.t('messages.reseller_api.organization_access_denied'),
      })
    }

    const user = await User.find(params.userId)

    if (!user) {
      return response.notFound({
        message: i18n.t('messages.user.not_found'),
      })
    }

    // Check user is in this organization
    const isMember = await user.hasOrganization(organization.id)
    if (!isMember) {
      return response.notFound({
        message: i18n.t('messages.member.not_found'),
      })
    }

    // Get user's role in this org
    await user.load('organizations')
    const orgMembership = user.organizations.find((o) => o.id === organization.id)
    const userRole = orgMembership?.$extras.pivot_role

    // Cannot remove Owner
    if (userRole === UserRole.Owner) {
      return response.forbidden({
        code: 'CANNOT_REMOVE_OWNER',
        message: i18n.t('messages.reseller_api.cannot_remove_owner'),
      })
    }

    // Clean up member credits before removal:
    // - Recover any remaining credits back to the organization pool
    // - Delete the UserCredit record (including auto-refill configuration)
    await creditService.cleanupMemberCredits(user.id, organization.id, null)

    // Remove from organization
    await organization.related('users').detach([user.id])

    // If this was user's current organization, clear it or set to another
    if (user.currentOrganizationId === organization.id) {
      // Try to set to another org user belongs to
      const remainingOrgs = user.organizations.filter((o) => o.id !== organization.id)
      user.currentOrganizationId = remainingOrgs.length > 0 ? remainingOrgs[0].id : null
      await user.save()
    }

    // Reload organizations to check if user has any remaining
    await user.load('organizations')

    // If user has no more organizations, disable them
    if (user.organizations.length === 0) {
      user.disabled = true
      await user.save()
    }

    return response.ok({
      message: i18n.t('messages.member.deleted'),
    })
  }

  /**
   * Resend invitation to a pending user
   * POST /api/reseller/organizations/:id/users/:userId/resend-invitation
   *
   * Rules:
   * - User must have onboardingCompleted === false
   * - Rate limit: 5 minutes between resends
   */
  async resendInvitation({ params, response, reseller, i18n }: HttpContext) {
    const organization = await Organization.find(params.id)

    if (!organization) {
      return response.notFound({
        message: i18n.t('messages.organization.not_found'),
      })
    }

    // Policy check: organization must belong to reseller
    if (organization.resellerId !== reseller!.id) {
      return response.forbidden({
        message: i18n.t('messages.reseller_api.organization_access_denied'),
      })
    }

    const user = await User.find(params.userId)

    if (!user) {
      return response.notFound({
        message: i18n.t('messages.user.not_found'),
      })
    }

    // Check user is in this organization
    const isMember = await user.hasOrganization(organization.id)
    if (!isMember) {
      return response.notFound({
        message: i18n.t('messages.reseller_api.user_not_in_organization'),
      })
    }

    // Check user has not completed onboarding (is pending)
    if (user.onboardingCompleted) {
      return response.badRequest({
        code: 'USER_ALREADY_VERIFIED',
        message: i18n.t('messages.reseller_api.user_already_verified'),
      })
    }

    // Check rate limit (5 minutes)
    if (!user.canResendInvitation()) {
      const remainingSeconds = user.getResendCooldownSeconds()
      return response.tooManyRequests({
        code: 'INVITATION_RATE_LIMIT',
        message: i18n.t('messages.reseller_api.invitation_rate_limit'),
        remainingSeconds,
      })
    }

    // Generate new magic link token (7 days expiry)
    const magicLinkToken = randomUUID()
    user.magicLinkToken = magicLinkToken
    user.magicLinkExpiresAt = DateTime.now().plus({ days: 7 })
    user.lastInvitationSentAt = DateTime.now()
    await user.save()

    // Get user's role in this organization
    await user.load('organizations')
    const orgMembership = user.organizations.find((o) => o.id === organization.id)
    const userRole = orgMembership?.$extras.pivot_role

    // Send invitation email
    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
    const apiUrl = env.get('APP_URL', 'http://localhost:3333')

    await mail.send((message) => {
      message
        .to(user.email)
        .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
        .subject(
          i18n.t('emails.reseller_user_invitation.subject', {
            organization: organization.name,
          })
        )
        .htmlView('emails/reseller_user_invitation', {
          userName: user.fullName || `${user.firstName} ${user.lastName}`,
          organizationName: organization.name,
          role: userRole === UserRole.Administrator ? 'Administrator' : 'Member',
          setupUrl: `${frontendUrl}/setup/${magicLinkToken}`,
          expiresAt: DateTime.now().plus({ days: 7 }).toFormat('dd/MM/yyyy'),
          i18n,
          apiUrl,
        })
    })

    return response.ok({
      message: i18n.t('messages.reseller_api.invitation_resent'),
      lastInvitationSentAt: user.lastInvitationSentAt?.toISO(),
    })
  }
}

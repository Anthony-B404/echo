import type { HttpContext } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import Reseller from '#models/reseller'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import {
  createResellerValidator,
  updateResellerValidator,
  listResellersValidator,
} from '#validators/reseller'

export default class ResellersController {
  /**
   * List all resellers with pagination and filtering.
   *
   * GET /admin/resellers
   */
  async index({ request, response, i18n }: HttpContext) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = await request.validateUsing(listResellersValidator)

      const query = Reseller.query().withCount('organizations').withCount('adminUsers')

      // Search filter
      if (search) {
        query.where((q) => {
          q.whereILike('name', `%${search}%`)
            .orWhereILike('email', `%${search}%`)
            .orWhereILike('company', `%${search}%`)
        })
      }

      // Active filter
      if (isActive !== undefined) {
        query.where('is_active', isActive)
      }

      // Sorting - convert camelCase to snake_case for database column names
      const sortByColumn = sortBy.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      query.orderBy(sortByColumn, sortOrder)

      const resellers = await query.paginate(page, limit)

      return response.ok(resellers)
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
   * Get a specific reseller with details.
   *
   * GET /admin/resellers/:id
   */
  async show({ params, response, i18n }: HttpContext) {
    const reseller = await Reseller.query()
      .where('id', params.id)
      .preload('organizations', (query) => {
        query.select(['id', 'name', 'email', 'credits', 'created_at'])
      })
      .preload('adminUsers', (query) => {
        query.select(['id', 'email', 'first_name', 'last_name', 'created_at'])
      })
      .withCount('organizations')
      .withCount('adminUsers')
      .first()

    if (!reseller) {
      return response.notFound({
        message: i18n.t('messages.reseller.not_found'),
      })
    }

    return response.ok(reseller)
  }

  /**
   * Create a new reseller with admin user.
   *
   * POST /admin/resellers
   *
   * Flow:
   * 1. Create the Reseller
   * 2. Create admin User for this Reseller
   * 3. Send welcome email with magic link token
   */
  async store({ request, response, auth, i18n }: HttpContext) {
    try {
      const payload = await request.validateUsing(createResellerValidator)
      const superAdmin = auth.user!

      // Use transaction for atomicity
      const result = await db.transaction(async (trx) => {
        // 1. Create the reseller
        const reseller = await Reseller.create(
          {
            name: payload.name,
            email: payload.email,
            phone: payload.phone || null,
            company: payload.company,
            siret: payload.siret || null,
            address: payload.address || null,
            notes: payload.notes || null,
            creditBalance: 0,
            isActive: true,
          },
          { client: trx }
        )

        // 2. If initial credits provided, add them with a transaction record
        if (payload.initialCredits && payload.initialCredits > 0) {
          reseller.creditBalance = payload.initialCredits
          await reseller.useTransaction(trx).save()

          // Create the purchase transaction using the model
          const { default: ResellerTransaction } = await import('#models/reseller_transaction')
          const { ResellerTransactionType } = await import('#models/reseller_transaction')

          await ResellerTransaction.create(
            {
              resellerId: reseller.id,
              amount: payload.initialCredits,
              type: ResellerTransactionType.Purchase,
              description: i18n.t('messages.reseller.initial_credits'),
              performedByUserId: superAdmin.id,
            },
            { client: trx }
          )
        }

        // 3. Create admin user for the reseller
        const magicLinkToken = randomUUID()
        const adminUser = await User.create(
          {
            email: payload.email,
            firstName: payload.name.split(' ')[0] || payload.name,
            lastName: payload.name.split(' ').slice(1).join(' ') || '',
            resellerId: reseller.id,
            isSuperAdmin: false,
            magicLinkToken,
            magicLinkExpiresAt: DateTime.now().plus({ days: 7 }),
            onboardingCompleted: false,
            disabled: false,
          },
          { client: trx }
        )

        return { reseller, adminUser, magicLinkToken }
      })

      // 4. Send welcome email with setup link
      const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:3000')
      const apiUrl = env.get('APP_URL', 'http://localhost:3333')

      await mail.send((message) => {
        message
          .to(result.adminUser.email)
          .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
          .subject(i18n.t('emails.reseller_welcome.subject'))
          .htmlView('emails/reseller_welcome', {
            resellerName: result.reseller.name,
            companyName: result.reseller.company,
            setupUrl: `${frontendUrl}/reseller/setup/${result.magicLinkToken}`,
            expiresAt: DateTime.now().plus({ days: 7 }).toFormat('dd/MM/yyyy'),
            i18n,
            apiUrl,
          })
      })

      return response.created({
        message: i18n.t('messages.reseller.created'),
        reseller: result.reseller,
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
   * Update a reseller.
   *
   * PUT /admin/resellers/:id
   */
  async update({ params, request, response, i18n }: HttpContext) {
    const reseller = await Reseller.find(params.id)

    if (!reseller) {
      return response.notFound({
        message: i18n.t('messages.reseller.not_found'),
      })
    }

    try {
      const payload = await request.validateUsing(updateResellerValidator(reseller.id))

      reseller.merge(payload)
      await reseller.save()

      return response.ok({
        message: i18n.t('messages.reseller.updated'),
        reseller,
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
   * Deactivate a reseller (soft delete).
   *
   * DELETE /admin/resellers/:id
   *
   * Note: Does not permanently delete, just sets isActive = false
   */
  async destroy({ params, response, i18n }: HttpContext) {
    const reseller = await Reseller.find(params.id)

    if (!reseller) {
      return response.notFound({
        message: i18n.t('messages.reseller.not_found'),
      })
    }

    reseller.isActive = false
    await reseller.save()

    // Also disable all admin users for this reseller
    await User.query().where('reseller_id', reseller.id).update({ disabled: true })

    return response.ok({
      message: i18n.t('messages.reseller.deactivated'),
    })
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import User, { UserRole } from '#models/user'
import {
  registrationRequestValidator,
  completeRegistrationValidator,
  loginRequestValidator,
} from '#validators/user'
import Organization from '#models/organization'
import mail from '@adonisjs/mail/services/main'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { errors } from '@vinejs/vine'
import defaultPromptsService from '#services/default_prompts_service'

export default class AuthController {
  private readonly LOGO_DIRECTORY = app.makePath('storage/organizations/logos')

  /**
   * Step 1: Send magic link to user's email for registration
   */
  public async registerWithMagicLink({ request, response, i18n }: HttpContext) {
    try {
      const payload = await request.validateUsing(registrationRequestValidator)

      // Check if user already exists
      const existingUser = await User.findBy('email', payload.email)

      if (existingUser) {
        // If user is disabled, allow re-registration with new onboarding
        if (existingUser.disabled) {
          existingUser.magicLinkToken = randomUUID()
          existingUser.magicLinkExpiresAt = DateTime.now().plus({ minutes: 15 })
          existingUser.onboardingCompleted = false // Reset for new onboarding
          await existingUser.save()

          // Send magic link email
          await mail.send((message) => {
            message
              .to(existingUser.email)
              .from('contact@dh-echo.cloud')
              .subject(i18n.t('emails.registration_magic_link.subject'))
              .htmlView('emails/registration_magic_link', {
                token: existingUser.magicLinkToken,
                locale: i18n.locale,
                i18n: i18n,
                frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
              })
          })

          return response.ok({ message: i18n.t('messages.auth.registration.magic_link_sent') })
        }

        // If onboarding already completed, return error
        if (existingUser.onboardingCompleted) {
          return response.status(422).json({
            message: i18n.t('messages.errors.email_already_used'),
          })
        }

        // Otherwise, regenerate token and resend email
        existingUser.magicLinkToken = randomUUID()
        existingUser.magicLinkExpiresAt = DateTime.now().plus({ minutes: 15 })
        await existingUser.save()

        // Resend magic link email
        await mail.send((message) => {
          message
            .to(existingUser.email)
            .from('contact@dh-echo.cloud')
            .subject(i18n.t('emails.registration_magic_link.subject'))
            .htmlView('emails/registration_magic_link', {
              token: existingUser.magicLinkToken,
              locale: i18n.locale,
              i18n: i18n,
              frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
            })
        })

        return response.ok({ message: i18n.t('messages.auth.registration.magic_link_sent') })
      }

      // Generate magic link token and expiration (15 minutes)
      const magicLinkToken = randomUUID()
      const magicLinkExpiresAt = DateTime.now().plus({ minutes: 15 })

      // Create organization with temporary name (will be updated later)
      const organization = await Organization.create({
        name: 'Temporary Organization',
        email: payload.email,
        logo: null,
      })

      // Create temporary user record (not yet activated)
      const user = await User.create({
        email: payload.email,
        fullName: null,
        firstName: null,
        lastName: null,
        onboardingCompleted: false,
        currentOrganizationId: organization.id,
        magicLinkToken,
        magicLinkExpiresAt,
      })

      // Créer la relation pivot avec role Owner
      await organization.related('users').attach({
        [user.id]: { role: UserRole.Owner },
      })

      // Send magic link email
      await mail.send((message) => {
        message
          .to(user.email)
          .from('contact@dh-echo.cloud')
          .subject(i18n.t('emails.registration_magic_link.subject'))
          .htmlView('emails/registration_magic_link', {
            token: magicLinkToken,
            locale: i18n.locale,
            i18n: i18n,
            frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
          })
      })

      return response.ok({ message: i18n.t('messages.auth.registration.magic_link_sent') })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        // Extraire le premier message d'erreur et traduire le nom du champ
        const firstError = error.messages[0]

        if (firstError) {
          // Traduire le nom du champ
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)

          // Injecter le nom traduit dans le message d'erreur
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }
      }

      return response.status(422).json({
        message: i18n.t('messages.errors.validation_failed'),
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Step 2: Verify magic link token (handles both registration and login)
   */
  public async verifyMagicLink({ params, response, i18n }: HttpContext) {
    const { token } = params

    const user = await User.findBy('magic_link_token', token)
    if (!user) {
      return response.notFound({ message: i18n.t('messages.auth.registration.token_invalid') })
    }

    // Check if token has expired
    if (user.magicLinkExpiresAt && user.magicLinkExpiresAt < DateTime.now()) {
      return response.unauthorized({ message: i18n.t('messages.auth.registration.token_expired') })
    }

    // If onboarding is completed, this is a login flow
    if (user.onboardingCompleted) {
      // Clear magic link token
      user.magicLinkToken = null
      user.magicLinkExpiresAt = null
      await user.save()

      // Create access token
      const accessToken = await User.accessTokens.create(user)

      return response.ok({
        message: i18n.t('messages.auth.login.success'),
        user,
        token: accessToken.value!.release(),
      })
    }

    // Otherwise, this is a registration flow - return user data for complete registration
    // Include existing user info for pre-filling forms (especially for disabled users re-registering)
    return response.ok({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token: token,
      isDisabled: user.disabled,
    })
  }

  /**
   * Step 3: Complete registration with organization details
   */
  public async completeRegistration({ request, response, i18n }: HttpContext) {
    try {
      const data = await request.validateUsing(completeRegistrationValidator)
      const logo = request.file('logo')

      // Find user by magic link token
      const user = await User.findBy('magic_link_token', data.magicLinkToken)
      if (!user) {
        return response.notFound({ message: i18n.t('messages.auth.registration.token_invalid') })
      }

      // Check if token has expired
      if (user.magicLinkExpiresAt && user.magicLinkExpiresAt < DateTime.now()) {
        return response.unauthorized({
          message: i18n.t('messages.auth.registration.token_expired'),
        })
      }

      // Handle logo upload
      const fileName = await this.handleLogoUpload(logo)

      // Calculate full name from first and last name
      const fullName = `${data.firstName} ${data.lastName}`

      // Handle organization: create new if disabled user, update existing otherwise
      let organization: Organization

      if (user.disabled) {
        // Disabled user re-registering: create new organization
        organization = await Organization.create({
          name: data.organizationName,
          email: user.email,
          logo: fileName,
        })

        // Attach user as Owner of the new organization
        await organization.related('users').attach({
          [user.id]: { role: UserRole.Owner },
        })

        // Update user: re-enable and set new organization
        user.currentOrganizationId = organization.id
        user.disabled = false
      } else {
        // Normal registration: update existing organization (created in step 1)
        organization = await Organization.findOrFail(user.currentOrganizationId)
        organization.name = data.organizationName
        organization.email = user.email
        organization.logo = fileName
        await organization.save()
      }

      // Update user with complete information
      user.firstName = data.firstName
      user.lastName = data.lastName
      user.fullName = fullName
      user.onboardingCompleted = true
      user.magicLinkToken = null
      user.magicLinkExpiresAt = null

      await user.save()

      // Seed default prompts for the organization (if not already seeded)
      await defaultPromptsService.seedIfNeeded(organization.id)

      // Create access token
      const accessToken = await User.accessTokens.create(user)

      return response.ok({
        message: i18n.t('messages.organization.created'),
        user,
        token: accessToken.value!.release(),
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        // Extraire le premier message d'erreur et traduire le nom du champ
        const firstError = error.messages[0]

        if (firstError) {
          // Traduire le nom du champ
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)

          // Injecter le nom traduit dans le message d'erreur
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }
      }

      return response.status(422).json({
        message: i18n.t('messages.errors.validation_failed'),
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Request magic link for login
   */
  public async loginWithMagicLink({ request, response, i18n }: HttpContext) {
    try {
      const payload = await request.validateUsing(loginRequestValidator)

      // Check if user exists
      const user = await User.findBy('email', payload.email)

      if (!user) {
        return response.status(404).json({
          message: i18n.t('messages.auth.login.user_not_found'),
        })
      }

      // Check if user is disabled
      if (user.disabled) {
        return response.status(403).json({
          message: i18n.t('messages.auth.login.account_disabled'),
          code: 'ACCOUNT_DISABLED',
          userData: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        })
      }

      // Check if onboarding is completed
      if (!user.onboardingCompleted) {
        return response.status(422).json({
          message: i18n.t('messages.auth.login.onboarding_not_completed'),
        })
      }

      // Generate magic link token and expiration (15 minutes)
      user.magicLinkToken = randomUUID()
      user.magicLinkExpiresAt = DateTime.now().plus({ minutes: 15 })
      await user.save()

      // Send magic link email
      await mail.send((message) => {
        message
          .to(user.email)
          .from('contact@dh-echo.cloud')
          .subject(i18n.t('emails.login_magic_link.subject'))
          .htmlView('emails/login_magic_link', {
            token: user.magicLinkToken,
            locale: i18n.locale,
            i18n: i18n,
            frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
          })
      })

      return response.ok({ message: i18n.t('messages.auth.login.magic_link_sent') })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        // Extraire le premier message d'erreur et traduire le nom du champ
        const firstError = error.messages[0]

        if (firstError) {
          // Traduire le nom du champ
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)

          // Injecter le nom traduit dans le message d'erreur
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }
      }

      return response.status(422).json({
        message: i18n.t('messages.errors.validation_failed'),
        errors: error.messages || error.message,
      })
    }
  }

  private async handleLogoUpload(logo: MultipartFile | null): Promise<string | null> {
    if (logo && logo.tmpPath) {
      const logoHash = await this.getFileHash(logo.tmpPath)
      const existingLogo = await this.findExistingLogo(logoHash)

      if (existingLogo) {
        return existingLogo
      } else {
        const fileName = `${cuid()}.${logo?.extname}`
        await logo?.move(this.LOGO_DIRECTORY, {
          name: fileName,
        })
        return fileName
      }
    }
    return null
  }

  private async getFileHash(input: string | Buffer): Promise<string> {
    const hashSum = createHash('sha256')
    if (typeof input === 'string') {
      const fileBuffer = await readFile(input)
      hashSum.update(fileBuffer)
    } else {
      hashSum.update(input)
    }
    return hashSum.digest('hex')
  }

  private async findExistingLogo(hash: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.LOGO_DIRECTORY)

      for (const file of files) {
        const filePath = join(this.LOGO_DIRECTORY, file)
        const fileHash = await this.getFileHash(filePath)
        if (fileHash === hash) {
          return file
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
      await fs.mkdir(this.LOGO_DIRECTORY, { recursive: true })
    }

    return null
  }

  public async logout({ auth, response, i18n }: HttpContext) {
    const token = auth.user!.currentAccessToken
    await User.accessTokens.delete(auth.user!, token.identifier)
    return response.ok({ message: i18n.t('messages.auth.logout_success') })
  }

  public async checkToken({ response, i18n }: HttpContext) {
    return response.ok({ message: i18n.t('messages.auth.token_valid') })
  }
}

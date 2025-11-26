import type { HttpContext } from '@adonisjs/core/http'
import User, { UserRole } from '#models/user'
import { registrationRequestValidator, completeRegistrationValidator, registerValidator, loginRequestValidator } from '#validators/user'
import Organization from '#models/organization'
import { createOrganizationValidator } from '#validators/organization'
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
            .from('onboarding@resend.dev')
            .subject(i18n.t('emails.registration_magic_link.subject'))
            .htmlView('emails/registration_magic_link', {
              token: existingUser.magicLinkToken,
              i18n: i18n,
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
        role: UserRole.Owner,
        isOwner: true,
        onboardingCompleted: false,
        organizationId: organization.id,
        magicLinkToken,
        magicLinkExpiresAt,
      })

      // Send magic link email
      await mail.send((message) => {
        message
          .to(user.email)
          .from('onboarding@resend.dev')
          .subject(i18n.t('emails.registration_magic_link.subject'))
          .htmlView('emails/registration_magic_link', {
            token: magicLinkToken,
            i18n: i18n,
          })
      })

      return response.ok({ message: i18n.t('messages.auth.registration.magic_link_sent') })
    } catch (error) {
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
    return response.ok({
      email: user.email,
      token: token,
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
        return response.unauthorized({ message: i18n.t('messages.auth.registration.token_expired') })
      }

      // Handle logo upload
      const fileName = await this.handleLogoUpload(logo)

      // Calculate full name from first and last name
      const fullName = `${data.firstName} ${data.lastName}`

      // Update existing organization (created in step 1)
      const organization = await Organization.findOrFail(user.organizationId)
      organization.name = data.organizationName
      organization.email = user.email
      organization.logo = fileName
      await organization.save()

      // Update user with complete information
      user.firstName = data.firstName
      user.lastName = data.lastName
      user.fullName = fullName
      user.onboardingCompleted = true
      user.magicLinkToken = null
      user.magicLinkExpiresAt = null
      await user.save()

      // Create access token
      const accessToken = await User.accessTokens.create(user)

      return response.ok({
        message: i18n.t('messages.organization.created'),
        user,
        token: accessToken.value!.release(),
      })
    } catch (error) {
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
          .from('onboarding@resend.dev')
          .subject(i18n.t('emails.login_magic_link.subject'))
          .htmlView('emails/login_magic_link', {
            token: user.magicLinkToken,
            i18n: i18n,
          })
      })

      return response.ok({ message: i18n.t('messages.auth.login.magic_link_sent') })
    } catch (error) {
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

  public async me({ auth, response }: HttpContext) {
    const user = auth.user
    return response.ok(user)
  }

  public async checkToken({ response, i18n }: HttpContext) {
    return response.ok({ message: i18n.t('messages.auth.token_valid') })
  }

  public async deleteMember({ params, response, i18n }: HttpContext) {
    const { id } = params

    const user = await User.find(id)
    if (!user) {
      return response.notFound({ message: i18n.t('messages.user.not_found') })
    }
    try {
      await user.delete()
      return response.ok({ message: i18n.t('messages.user.deleted') })
    } catch (error) {
      return response.status(500).json({
        message: i18n.t('messages.errors.user_delete_failed'),
        errors: error.messages,
      })
    }
  }

}

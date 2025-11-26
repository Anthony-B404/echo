import type { HttpContext } from '@adonisjs/core/http'
import User, { UserRole } from '#models/user'
import Organization from '#models/organization'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { cuid } from '@adonisjs/core/helpers'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'

export default class SocialAuthController {
  private readonly LOGO_DIRECTORY = app.makePath('storage/organizations/logos')
  /**
   * Redirect to Google OAuth page
   */
  public async googleRedirect({ ally }: HttpContext) {
    return ally.use('google').redirect()
  }

  /**
   * Handle Google OAuth callback
   */
  public async googleCallback({ ally, response, i18n }: HttpContext) {
    try {
      const google = ally.use('google')

      // Check if the user has denied the access
      if (google.accessDenied()) {
        return response.redirect(`${env.get('FRONTEND_URL')}/login?error=access_denied`)
      }

      // Check if there is an error
      if (google.hasError()) {
        return response.redirect(
          `${env.get('FRONTEND_URL')}/login?error=${google.getError()}`
        )
      }

      // Get user details from Google
      const googleUser = await google.user()

      // Check if user already exists
      let user = await User.query()
        .where('email', googleUser.email)
        .orWhere('google_id', googleUser.id)
        .first()

      if (user) {
        // User exists - login flow
        // Update Google ID if not set
        if (!user.googleId) {
          user.googleId = googleUser.id
          user.avatar = googleUser.avatarUrl
          await user.save()
        }

        // If onboarding not completed, redirect to complete registration
        if (!user.onboardingCompleted) {
          const token = await User.accessTokens.create(user)
          return response.redirect(
            `${env.get('FRONTEND_URL')}/auth/callback?token=${token.value!.release()}&needsOnboarding=true`
          )
        }

        // Generate access token for existing user
        const token = await User.accessTokens.create(user)
        return response.redirect(
          `${env.get('FRONTEND_URL')}/auth/callback?token=${token.value!.release()}`
        )
      }

      // User doesn't exist - registration flow
      // Extract names from Google
      const nameParts = googleUser.name.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Create new organization
      const organization = await Organization.create({
        name: 'Temporary Organization',
        email: googleUser.email,
        logo: null,
      })

      // Create new user
      user = await User.create({
        email: googleUser.email,
        firstName,
        lastName,
        fullName: googleUser.name,
        googleId: googleUser.id,
        avatar: googleUser.avatarUrl,
        role: UserRole.Owner,
        isOwner: true,
        onboardingCompleted: false,
        organizationId: organization.id,
        magicLinkToken: null,
        magicLinkExpiresAt: null,
      })

      // Generate access token
      const token = await User.accessTokens.create(user)

      // Redirect to frontend with token and needsOnboarding flag
      return response.redirect(
        `${env.get('FRONTEND_URL')}/auth/callback?token=${token.value!.release()}&needsOnboarding=true`
      )
    } catch (error) {
      console.error('Google OAuth error:', error)
      return response.redirect(`${env.get('FRONTEND_URL')}/login?error=oauth_error`)
    }
  }

  /**
   * Complete OAuth registration with organization details
   */
  public async completeOAuthRegistration({ request, response, auth, i18n }: HttpContext) {
    try {
      // Get authenticated user
      const user = auth.user!

      // Check if onboarding already completed
      if (user.onboardingCompleted) {
        return response.status(400).json({
          message: i18n.t('messages.auth.registration.already_completed'),
        })
      }

      // Validate request data
      const firstName = request.input('firstName')
      const lastName = request.input('lastName')
      const organizationName = request.input('organizationName')
      const logo = request.file('logo')

      if (!firstName || !lastName || !organizationName) {
        return response.status(422).json({
          message: i18n.t('messages.errors.validation_failed'),
        })
      }

      // Handle logo upload
      const fileName = await this.handleLogoUpload(logo)

      // Calculate full name
      const fullName = `${firstName} ${lastName}`

      // Update organization
      const organization = await Organization.findOrFail(user.organizationId)
      organization.name = organizationName
      organization.logo = fileName
      await organization.save()

      // Update user
      user.firstName = firstName
      user.lastName = lastName
      user.fullName = fullName
      user.onboardingCompleted = true
      await user.save()

      return response.ok({
        message: i18n.t('messages.organization.created'),
        user,
      })
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
}

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
import { completeOAuthRegistrationValidator } from '#validators/user'

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
  public async googleCallback({ ally, response }: HttpContext) {
    try {
      const google = ally.use('google')

      // Check if the user has denied the access
      if (google.accessDenied()) {
        return response.redirect(`${env.get('FRONTEND_URL')}/login?error=access_denied`)
      }

      // Check if there is an error
      if (google.hasError()) {
        return response.redirect(`${env.get('FRONTEND_URL')}/login?error=${google.getError()}`)
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

        // Check if user is disabled - require new onboarding to reactivate
        if (user.disabled) {
          // Reset onboarding to force creating a new organization
          user.onboardingCompleted = false
          await user.save()

          // Generate token and redirect to onboarding
          const token = await User.accessTokens.create(user)
          return response.redirect(
            `${env.get('FRONTEND_URL')}/auth/callback?token=${token.value!.release()}&needsOnboarding=true&reactivating=true`
          )
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

      // Check if an organization with this email already exists
      let organization = await Organization.query().where('email', googleUser.email).first()

      if (!organization) {
        // Create new organization only if it doesn't exist
        organization = await Organization.create({
          name: 'Temporary Organization',
          email: googleUser.email,
          logo: null,
        })
      }

      // Create new user
      user = await User.create({
        email: googleUser.email,
        firstName,
        lastName,
        fullName: googleUser.name,
        googleId: googleUser.id,
        avatar: googleUser.avatarUrl,
        onboardingCompleted: false,
        currentOrganizationId: organization.id,
        magicLinkToken: null,
        magicLinkExpiresAt: null,
      })

      // Link user to organization with Owner role
      await organization.related('users').attach({
        [user.id]: { role: UserRole.Owner },
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
  public async completeOAuthRegistration({ request, response, auth }: HttpContext) {
    try {
      // Get authenticated user
      const user = auth.user!

      // Check if onboarding already completed
      if (user.onboardingCompleted) {
        return response.status(400).json({
          message: 'Onboarding already completed',
        })
      }

      // Validate request data using validator
      const data = await request.validateUsing(completeOAuthRegistrationValidator)
      const logo = request.file('logo')

      // Handle logo upload
      const fileName = await this.handleLogoUpload(logo)

      // Calculate full name
      const fullName = `${data.firstName} ${data.lastName}`

      // Check if this is a disabled user reactivating (no currentOrganizationId)
      // OR if user was disabled (need to create new org)
      if (!user.currentOrganizationId || user.disabled) {
        // Create NEW organization for reactivating user
        const organization = await Organization.create({
          name: data.organizationName,
          email: user.email,
          logo: fileName,
        })

        // Attach user as Owner
        await organization.related('users').attach({
          [user.id]: { role: UserRole.Owner },
        })

        // Update user
        user.currentOrganizationId = organization.id
        user.disabled = false
      } else {
        // Update existing organization (normal flow for new users)
        const organization = await Organization.findOrFail(user.currentOrganizationId)
        organization.name = data.organizationName
        organization.logo = fileName
        await organization.save()
      }

      // Update user info
      user.firstName = data.firstName
      user.lastName = data.lastName
      user.fullName = fullName
      user.onboardingCompleted = true
      await user.save()

      return response.ok({
        message: 'Organization created successfully',
        user,
      })
    } catch (error) {
      return response.status(422).json({
        message: 'Validation failed',
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

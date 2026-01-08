import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import User from '#models/user'
import { updateProfileValidator } from '#validators/user'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import mail from '@adonisjs/mail/services/main'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { errors } from '@vinejs/vine'

export default class UsersController {
  public async me({ auth, response }: HttpContext) {
    const user = auth.user!

    // Charger les organisations du user avec leur role
    await user.load('organizations', (query) => {
      query.pivotColumns(['role'])
    })

    // Charger l'organisation courante si elle existe
    if (user.currentOrganizationId) {
      await user.load('currentOrganization')
    }

    const userResponse = {
      ...user.serialize(),
      organizations: user.organizations.map((org) => ({
        id: org.id,
        name: org.name,
        logo: org.logo ? `organization-logo/${org.logo}` : null,
        email: org.email,
        role: org.$extras.pivot_role,
        isOwner: org.$extras.pivot_role === 1,
        isCurrent: org.id === user.currentOrganizationId,
      })),
      currentOrganization: user.currentOrganization
        ? {
            id: user.currentOrganization.id,
            name: user.currentOrganization.name,
            logo: user.currentOrganization.logo
              ? `organization-logo/${user.currentOrganization.logo}`
              : null,
            email: user.currentOrganization.email,
          }
        : null,
    }

    return response.ok(userResponse)
  }

  public async updateProfile({ auth, request, response, i18n }: HttpContext) {
    try {
      const user = auth.user!
      const data = await request.validateUsing(updateProfileValidator, {
        meta: { userId: user.id },
      })
      const avatar = request.file('avatar')

      // Update firstName if provided
      if (data.firstName !== undefined) {
        user.firstName = data.firstName
      }

      // Update lastName if provided
      if (data.lastName !== undefined) {
        user.lastName = data.lastName
      }

      // Recalculate fullName if firstName or lastName changed
      if (data.firstName !== undefined || data.lastName !== undefined) {
        const firstName = data.firstName ?? user.firstName ?? ''
        const lastName = data.lastName ?? user.lastName ?? ''
        user.fullName = `${firstName} ${lastName}`.trim()
      }

      // Handle email change with verification
      if (data.email !== undefined && data.email !== user.email) {
        const newEmail = data.email
        // Generate email change token
        user.emailChangeToken = randomUUID()
        user.emailChangeExpiresAt = DateTime.now().plus({ minutes: 15 })
        user.pendingEmail = newEmail

        // Send verification email to new email address
        await mail.send((message) => {
          message
            .to(newEmail)
            .from('onboarding@resend.dev')
            .subject(i18n.t('emails.email_change.subject'))
            .htmlView('emails/verify_email_change', {
              token: user.emailChangeToken,
              locale: i18n.locale,
              i18n: i18n,
              frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
            })
        })
      }

      // Handle avatar removal (priority: new upload > removal)
      if (data.removeAvatar && !avatar) {
        // Only remove if no new avatar is being uploaded
        if (
          user.avatar &&
          !user.avatar.startsWith('http://') &&
          !user.avatar.startsWith('https://')
        ) {
          // Delete local file if it exists (not Google OAuth URL)
          const avatarPath = app.makePath('storage/users/avatars', user.avatar)
          try {
            await fs.unlink(avatarPath)
          } catch (error) {
            // File may not exist, ignore error
          }
        }
        user.avatar = null
      }

      // Handle avatar upload
      if (avatar) {
        const fileName = await this.handleAvatarUpload(avatar)
        if (fileName) {
          user.avatar = fileName
        }
      }

      await user.save()

      // Determine appropriate success message
      let message: string
      if (user.pendingEmail) {
        message = i18n.t('messages.user.email_change_verification_sent')
      } else if (data.removeAvatar && !avatar) {
        message = i18n.t('messages.user.avatar_removed')
      } else {
        message = i18n.t('messages.user.profile_updated')
      }

      return response.ok({
        message,
        user,
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

  private async handleAvatarUpload(avatar: MultipartFile): Promise<string | null> {
    const AVATAR_DIRECTORY = app.makePath('storage/users/avatars')

    if (avatar && avatar.tmpPath) {
      const avatarHash = await this.getFileHash(avatar.tmpPath)
      const existingAvatar = await this.findExistingFile(avatarHash, AVATAR_DIRECTORY)

      if (existingAvatar) {
        return existingAvatar
      } else {
        const fileName = `${cuid()}.${avatar?.extname}`
        await avatar?.move(AVATAR_DIRECTORY, {
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

  private async findExistingFile(hash: string, directory: string): Promise<string | null> {
    try {
      const files = await fs.readdir(directory)

      for (const file of files) {
        const filePath = join(directory, file)
        const fileHash = await this.getFileHash(filePath)
        if (fileHash === hash) {
          return file
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
      await fs.mkdir(directory, { recursive: true })
    }

    return null
  }

  public async getUserAvatar({ params, response }: HttpContext) {
    const { avatar } = params
    const avatarPath = app.makePath('storage/users/avatars', avatar)

    try {
      return response.download(avatarPath)
    } catch (error) {
      return response.notFound({ message: 'Avatar not found' })
    }
  }

  public async verifyEmailChange({ params, response, i18n }: HttpContext) {
    const { token } = params

    // Find user by email change token
    const user = await User.findBy('email_change_token', token)
    if (!user) {
      return response.notFound({ message: i18n.t('messages.user.email_change_token_invalid') })
    }

    // Check if token has expired
    if (user.emailChangeExpiresAt && user.emailChangeExpiresAt < DateTime.now()) {
      return response.unauthorized({ message: i18n.t('messages.user.email_change_token_expired') })
    }

    // Check if pending email is not already used by another user
    const existingUser = await User.query()
      .where('email', user.pendingEmail!)
      .whereNot('id', user.id)
      .first()

    if (existingUser) {
      return response.status(422).json({
        message: i18n.t('messages.user.email_already_in_use'),
      })
    }

    // Apply email change
    user.email = user.pendingEmail!
    user.pendingEmail = null
    user.emailChangeToken = null
    user.emailChangeExpiresAt = null
    await user.save()

    return response.ok({
      message: i18n.t('messages.user.email_changed_successfully'),
      user,
    })
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

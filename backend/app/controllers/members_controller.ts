import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Organization from '#models/organization'
import MemberPolicy from '#policies/member_policy'
import { updateMemberValidator, updateMemberRoleValidator } from '#validators/member'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { errors } from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import creditService from '#services/credit_service'

export default class MembersController {
  private readonly AVATAR_DIRECTORY = app.makePath('storage/users/avatars')

  /**
   * Update a member's profile (firstName, lastName, email, avatar)
   */
  public async updateMember({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!
    const { id } = params

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const targetUser = await User.find(id)
    if (!targetUser) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    // Check if target user belongs to the organization
    if (!(await targetUser.hasOrganization(authUser.currentOrganizationId))) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    // Check authorization
    if (
      await bouncer
        .with(MemberPolicy)
        .denies('manageMember', targetUser, authUser.currentOrganizationId)
    ) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const data = await request.validateUsing(updateMemberValidator, {
        meta: { targetUserId: targetUser.id },
      })
      const avatar = request.file('avatar')

      // Update firstName if provided
      if (data.firstName !== undefined) {
        targetUser.firstName = data.firstName
      }

      // Update lastName if provided
      if (data.lastName !== undefined) {
        targetUser.lastName = data.lastName
      }

      // Recalculate fullName if firstName or lastName changed
      if (data.firstName !== undefined || data.lastName !== undefined) {
        const firstName = data.firstName ?? targetUser.firstName ?? ''
        const lastName = data.lastName ?? targetUser.lastName ?? ''
        targetUser.fullName = `${firstName} ${lastName}`.trim()
      }

      // Update email if provided
      if (data.email !== undefined && data.email !== targetUser.email) {
        // Check uniqueness is handled by validator
        targetUser.email = data.email
      }

      // Handle avatar removal (priority: new upload > removal)
      if (data.removeAvatar && !avatar) {
        if (
          targetUser.avatar &&
          !targetUser.avatar.startsWith('http://') &&
          !targetUser.avatar.startsWith('https://')
        ) {
          const avatarPath = app.makePath('storage/users/avatars', targetUser.avatar)
          try {
            await fs.unlink(avatarPath)
          } catch (error) {
            // File may not exist, ignore error
          }
        }
        targetUser.avatar = null
      }

      // Handle avatar upload
      if (avatar) {
        const fileName = await this.handleAvatarUpload(avatar)
        if (fileName) {
          targetUser.avatar = fileName
        }
      }

      await targetUser.save()

      return response.ok({
        message: i18n.t('messages.member.updated'),
        member: {
          id: targetUser.id,
          fullName: targetUser.fullName,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          avatar: targetUser.avatar,
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const firstError = error.messages[0]

        if (firstError) {
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)
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
   * Update a member's role
   */
  public async updateMemberRole({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!
    const { id } = params

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const targetUser = await User.find(id)
    if (!targetUser) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    // Check if target user belongs to the organization
    if (!(await targetUser.hasOrganization(authUser.currentOrganizationId))) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    try {
      const data = await request.validateUsing(updateMemberRoleValidator)

      // Check authorization with the new role
      if (
        await bouncer
          .with(MemberPolicy)
          .denies('changeRole', targetUser, authUser.currentOrganizationId, data.role)
      ) {
        return response.status(403).json({
          message: i18n.t('messages.errors.unauthorized'),
        })
      }

      // Update the role in the pivot table
      await db
        .from('organization_user')
        .where('user_id', targetUser.id)
        .where('organization_id', authUser.currentOrganizationId)
        .update({ role: data.role })

      return response.ok({
        message: i18n.t('messages.member.role_updated'),
        member: {
          id: targetUser.id,
          role: data.role,
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const firstError = error.messages[0]

        if (firstError) {
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }
      }

      return response.status(500).json({
        message: i18n.t('messages.errors.server_error'),
        error: error.message,
      })
    }
  }

  /**
   * Delete a member from the organization
   */
  public async deleteMember({ params, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!
    const { id } = params

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const targetUser = await User.find(id)
    if (!targetUser) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    // Check if target user belongs to the organization
    if (!(await targetUser.hasOrganization(authUser.currentOrganizationId))) {
      return response.notFound({ message: i18n.t('messages.member.not_found') })
    }

    // Check authorization
    if (
      await bouncer
        .with(MemberPolicy)
        .denies('deleteMember', targetUser, authUser.currentOrganizationId)
    ) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const organization = await Organization.findOrFail(authUser.currentOrganizationId)

      // Clean up member credits before removal:
      // - Recover any remaining credits back to the organization pool
      // - Delete the UserCredit record (including auto-refill configuration)
      await creditService.cleanupMemberCredits(targetUser.id, organization.id, authUser.id)

      // Remove user from the organization (detach from pivot)
      await organization.related('users').detach([targetUser.id])

      // If this was the user's current organization, clear it
      if (targetUser.currentOrganizationId === authUser.currentOrganizationId) {
        // Try to set another organization as current, or null
        await targetUser.load('organizations')
        const otherOrg = targetUser.organizations[0]
        targetUser.currentOrganizationId = otherOrg?.id ?? null
      } else {
        // Load organizations to check if user has any left
        await targetUser.load('organizations')
      }

      // If user has no more organizations, disable their account
      if (targetUser.organizations.length === 0) {
        targetUser.disabled = true
        // Invalidate all access tokens for this user
        await db.from('auth_access_tokens').where('tokenable_id', targetUser.id).delete()
      }

      await targetUser.save()

      return response.ok({
        message: i18n.t('messages.member.deleted'),
      })
    } catch (error) {
      return response.status(500).json({
        message: i18n.t('messages.errors.member_delete_failed'),
        error: error.message,
      })
    }
  }

  private async handleAvatarUpload(avatar: MultipartFile): Promise<string | null> {
    if (avatar && avatar.tmpPath) {
      const avatarHash = await this.getFileHash(avatar.tmpPath)
      const existingAvatar = await this.findExistingFile(avatarHash, this.AVATAR_DIRECTORY)

      if (existingAvatar) {
        return existingAvatar
      } else {
        const fileName = `${cuid()}.${avatar?.extname}`
        await avatar?.move(this.AVATAR_DIRECTORY, {
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
}

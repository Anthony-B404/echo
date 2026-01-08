import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import InvitationPolicy from '#policies/invitation_policy'
import Invitation from '#models/invitation'
import Organization from '#models/organization'
import User from '#models/user'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import { createInvitationValidator, acceptInvitationValidator } from '#validators/invitation'
import mail from '@adonisjs/mail/services/main'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { errors } from '@vinejs/vine'

export default class InvitationsController {
  private readonly AVATAR_DIRECTORY = app.makePath('storage/users/avatars')

  /**
   * Crée une invitation pour rejoindre l'organisation courante
   * Seuls les Owners et Administrators peuvent inviter
   */
  public async createInvitation({ request, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user

    if (!authUser) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    if (await bouncer.with(InvitationPolicy).denies('createInvitation' as never, authUser!)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      // Valider avec le nouveau validator en passant organizationId dans les meta
      const payload = await request.validateUsing(createInvitationValidator, {
        meta: { organizationId: authUser.currentOrganizationId },
      })

      const organization = await Organization.findOrFail(authUser.currentOrganizationId)

      // Créer l'invitation
      const invitation = await Invitation.create({
        identifier: randomUUID(),
        email: payload.email,
        organizationId: authUser.currentOrganizationId,
        role: payload.role,
        expiresAt: DateTime.now().plus({ days: 7 }),
      })

      // Envoyer l'email d'invitation
      await mail.send((message) => {
        message
          .to(payload.email)
          .from('contact@dh-echo.cloud')
          .subject(i18n.t('emails.invitation.subject', { organization: organization.name }))
          .htmlView('emails/invitation', {
            identifier: invitation.identifier,
            organizationName: organization.name,
            organizationLogo: organization.logo
              ? `${process.env.APP_URL || 'http://localhost:3333'}/organization-logo/${organization.logo}`
              : 'https://placehold.co/100',
            expiresAt: invitation.expiresAt.toFormat('dd/MM/yyyy'),
            i18n: i18n,
            frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
          })
      })

      return response.status(201).json({
        message: i18n.t('messages.invitation.sent'),
        invitation,
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
        message: i18n.t('messages.errors.invitation_create_failed'),
        errors: error.message,
      })
    }
  }

  /**
   * Vérifie la validité d'une invitation et retourne les infos de l'organisation
   * Route publique - utilisée par le frontend avant l'acceptation
   */
  public async checkInvitation({ request, response, i18n }: HttpContext) {
    const { identifier } = request.params()

    const invitation = await Invitation.findBy('identifier', identifier)

    if (!invitation) {
      return response.status(404).json({
        message: i18n.t('messages.invitation.invalid'),
      })
    }

    // Vérifier l'expiration
    if (invitation.expiresAt < DateTime.now()) {
      return response.status(400).json({
        message: i18n.t('messages.invitation.expired'),
      })
    }

    const organization = await Organization.find(invitation.organizationId)

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findBy('email', invitation.email)
    const userExists = existingUser !== null

    return response.status(200).json({
      email: invitation.email,
      organizationName: organization?.name,
      organizationLogo: organization?.logo ? `organization-logo/${organization.logo}` : null,
      userExists,
    })
  }

  /**
   * Accepte une invitation
   * Workflow aligné avec completeRegistration : firstName, lastName, avatar optionnel
   * Si user existe : ajoute l'organisation
   * Si user nouveau : crée user + organisation
   * Retourne token API pour connexion automatique
   */
  public async acceptInvitation({ request, response, i18n }: HttpContext) {
    try {
      // Valider avec le nouveau validator
      const data = await request.validateUsing(acceptInvitationValidator)
      const avatar = request.file('avatar')

      // Trouver l'invitation
      const invitation = await Invitation.findBy('identifier', data.identifier)

      if (!invitation) {
        return response.status(404).json({
          message: i18n.t('messages.invitation.invalid'),
        })
      }

      // Vérifier l'expiration
      if (invitation.expiresAt < DateTime.now()) {
        return response.status(400).json({
          message: i18n.t('messages.invitation.expired'),
        })
      }

      const organization = await Organization.findOrFail(invitation.organizationId)
      const existingUser = await User.findBy('email', invitation.email)

      if (existingUser) {
        // ===== CAS 1 : USER EXISTE DÉJÀ =====

        // Vérifier si le user n'est pas déjà dans cette org
        const hasAccess = await existingUser.hasOrganization(invitation.organizationId)

        if (hasAccess) {
          return response.status(400).json({
            message: i18n.t('messages.invitation.already_member'),
          })
        }

        // Réactiver le user si désactivé (pas besoin de refaire l'onboarding)
        if (existingUser.disabled) {
          existingUser.disabled = false
        }

        // Créer la relation pivot avec le role de l'invitation
        await organization.related('users').attach({
          [existingUser.id]: { role: invitation.role },
        })

        // Si le user n'a pas d'organisation courante, définir celle-ci
        if (!existingUser.currentOrganizationId) {
          existingUser.currentOrganizationId = invitation.organizationId
        }

        await existingUser.save()

        // Supprimer l'invitation (acceptée)
        await invitation.delete()

        // Créer un token API pour connexion automatique
        const accessToken = await User.accessTokens.create(existingUser)

        return response.status(200).json({
          message: i18n.t('messages.invitation.accepted'),
          user: existingUser,
          token: accessToken.value!.release(),
          userExists: true,
        })
      } else {
        // ===== CAS 2 : NOUVEAU USER =====

        // Vérifier que firstName et lastName sont fournis pour un nouveau user
        if (!data.firstName || !data.lastName) {
          return response.status(422).json({
            message: i18n.t('messages.errors.user_validation_failed'),
            errors: 'firstName and lastName are required for new users',
          })
        }

        // Gérer l'avatar optionnel
        const avatarFileName = await this.handleAvatarUpload(avatar)

        // Calculer fullName
        const fullName = `${data.firstName} ${data.lastName}`

        // Créer le nouveau user
        const newUser = await User.create({
          email: invitation.email,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: fullName,
          avatar: avatarFileName,
          onboardingCompleted: true,
          currentOrganizationId: invitation.organizationId,
        })

        // Créer la relation pivot avec le role de l'invitation
        await organization.related('users').attach({
          [newUser.id]: { role: invitation.role },
        })

        // Supprimer l'invitation (acceptée)
        await invitation.delete()

        // Créer un token API pour connexion automatique
        const accessToken = await User.accessTokens.create(newUser)

        return response.status(200).json({
          message: i18n.t('messages.invitation.accepted'),
          user: newUser,
          token: accessToken.value!.release(),
          userExists: false,
        })
      }
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
        message: i18n.t('messages.errors.user_validation_failed'),
        errors: error.message || error.messages,
      })
    }
  }

  /**
   * Liste les invitations de l'organisation courante
   * Seuls les Owners et Administrators peuvent voir les invitations
   */
  public async listInvitations({ response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user

    if (!authUser) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    if (await bouncer.with(InvitationPolicy).denies('createInvitation' as never, authUser!)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const invitations = await Invitation.query()
        .where('organizationId', authUser.currentOrganizationId)
        .orderBy('createdAt', 'desc')

      return response.ok(invitations)
    } catch (error) {
      return response.status(500).json({
        message: i18n.t('messages.errors.server_error'),
        errors: error.message,
      })
    }
  }

  /**
   * Relance une invitation en mettant à jour la date d'expiration et en renvoyant l'email
   * Seuls les Owners et Administrators peuvent relancer des invitations
   */
  public async resendInvitation({ params, response, auth, bouncer, i18n }: HttpContext) {
    const { id } = params
    const authUser = auth.user

    if (!authUser) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    if (await bouncer.with(InvitationPolicy).denies('createInvitation' as never, authUser!)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const invitation = await Invitation.find(id)

      if (!invitation) {
        return response.notFound({ message: i18n.t('messages.invitation.invalid') })
      }

      // Vérifier que l'invitation appartient à l'organisation courante
      if (invitation.organizationId !== authUser.currentOrganizationId) {
        return response.status(403).json({
          message: i18n.t('messages.errors.unauthorized'),
        })
      }

      // Mettre à jour la date d'expiration
      invitation.expiresAt = DateTime.now().plus({ days: 7 })
      await invitation.save()

      // Récupérer l'organisation pour l'email
      const organization = await Organization.findOrFail(authUser.currentOrganizationId)

      // Renvoyer l'email d'invitation
      await mail.send((message) => {
        message
          .to(invitation.email)
          .from('contact@dh-echo.cloud')
          .subject(i18n.t('emails.invitation.subject', { organization: organization.name }))
          .htmlView('emails/invitation', {
            identifier: invitation.identifier,
            organizationName: organization.name,
            organizationLogo: organization.logo
              ? `${process.env.APP_URL || 'http://localhost:3333'}/organization-logo/${organization.logo}`
              : 'https://placehold.co/100',
            expiresAt: invitation.expiresAt.toFormat('dd/MM/yyyy'),
            i18n: i18n,
            frontendUrl: env.get('FRONTEND_URL', 'http://localhost:3000'),
          })
      })

      return response.ok({
        message: i18n.t('messages.invitation.resent'),
        invitation,
      })
    } catch (error) {
      return response.status(500).json({
        message: i18n.t('messages.errors.server_error'),
        errors: error.message,
      })
    }
  }

  /**
   * Supprime une invitation pendante
   */
  public async deleteInvitation({ params, response, i18n }: HttpContext) {
    const { id } = params

    const invitation = await Invitation.find(id)
    if (!invitation) {
      return response.notFound({ message: i18n.t('messages.invitation.invalid') })
    }
    try {
      await invitation.delete()
      return response.ok({ message: i18n.t('messages.invitation.deleted') })
    } catch (error) {
      return response.status(500).json({
        message: i18n.t('messages.errors.invitation_delete_failed'),
        errors: error.message,
      })
    }
  }

  /**
   * Gère l'upload d'avatar (déduplication par hash comme dans UsersController)
   */
  private async handleAvatarUpload(avatar: MultipartFile | null): Promise<string | null> {
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

  /**
   * Calcule le hash SHA256 d'un fichier
   */
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

  /**
   * Cherche un fichier existant par son hash
   */
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

import type { HttpContext } from '@adonisjs/core/http'
import { createOrganizationValidator, updateOrganizationValidator } from '#validators/organization'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import Organization from '#models/organization'
import { UserRole } from '#models/user'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import OrganizationPolicy from '#policies/organization_policy'
import { DateTime } from 'luxon'
import { errors } from '@vinejs/vine'
import defaultPromptsService from '#services/default_prompts_service'
export default class OrganizationsController {
  private readonly LOGO_DIRECTORY = app.makePath('storage/organizations/logos')

  /**
   * Lister toutes les organisations du user
   */
  public async listUserOrganizations({ response, auth }: HttpContext) {
    const authUser = auth.user!

    await authUser.load('organizations', (query) => {
      query.pivotColumns(['role'])
    })

    const organizations = authUser.organizations.map((org) => ({
      id: org.id,
      name: org.name,
      logo: org.logo ? `organization-logo/${org.logo}` : null,
      email: org.email,
      role: org.$extras.pivot_role,
      isOwner: org.$extras.pivot_role === UserRole.Owner,
      isCurrent: org.id === authUser.currentOrganizationId,
    }))

    return response.json(organizations)
  }

  /**
   * Obtenir l'organisation courante avec ses users
   */
  public async getOrganizationWithUsers({ response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const organization = await Organization.findOrFail(authUser.currentOrganizationId)

    if (await bouncer.with(OrganizationPolicy).denies('getOrganizationWithUsers', organization)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    await organization.load('users', (query) => {
      query.pivotColumns(['role']).wherePivot('role', '!=', 3)
    })

    await organization.load('invitations', (query) => {
      query.where('expires_at', '>', DateTime.now().toSQL())
    })

    const serializedOrganization = {
      ...organization.serialize(),
      logo: organization.logo ? `organization-logo/${organization.logo}` : null,
      users: organization.users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.$extras.pivot_role,
        isCurrentUser: user.id === authUser.id,
      })),
      invitations: organization.invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
      })),
    }

    return response.json(serializedOrganization)
  }

  /**
   * Obtenir la liste des membres de l'organisation courante
   */
  public async getMembers({ response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!

    if (!authUser.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const organization = await Organization.findOrFail(authUser.currentOrganizationId)

    if (await bouncer.with(OrganizationPolicy).denies('getMembers', organization)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    await organization.load('users', (query) => {
      query.pivotColumns(['role']).orderByRaw('pivot_role ASC')
    })

    const members = organization.users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.$extras.pivot_role,
      avatar: user.avatar,
      isCurrentUser: user.id === authUser.id,
    }))

    return response.json(members)
  }

  /**
   * Créer une nouvelle organisation
   */
  public async createOrganization({ request, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!

    if (await bouncer.with(OrganizationPolicy).denies('createOrganization', authUser)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const organizationData = JSON.parse(request.input('organization'))
      const logo = request.file('logo')

      const fileName = await this.handleLogoUpload(logo)
      organizationData.logo = fileName

      const organizationPayload = await createOrganizationValidator(authUser.id).validate(
        organizationData
      )
      const organization = await Organization.create(organizationPayload)

      // Créer la relation pivot avec role Owner
      await organization.related('users').attach({
        [authUser.id]: { role: 1 }, // UserRole.Owner
      })

      // Seed default prompts for the new organization
      await defaultPromptsService.seedForOrganization(organization.id)

      // Switch to the new organization
      authUser.currentOrganizationId = organization.id
      await authUser.save()

      return response.status(201).json({
        message: i18n.t('messages.organization.created'),
        organization: {
          id: organization.id,
          name: organization.name,
          logo: organization.logo ? `organization-logo/${organization.logo}` : null,
          email: organization.email,
        },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        // Extraire le premier message d'erreur et traduire le nom du champ
        const firstError = error.messages[0]

        if (firstError) {
          // Traduire le nom du champ (ex: "name" → "nom" en français)
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)

          // Injecter le nom traduit dans le message d'erreur
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }

        return response.status(422).json({
          message: i18n.t('messages.errors.validation_failed'),
          error: 'Validation failure',
        })
      }
      return this.handleError(response, error, i18n)
    }
  }

  /**
   * Changer l'organisation courante
   */
  public async switchOrganization({ params, response, auth, i18n }: HttpContext) {
    const authUser = auth.user!
    const { id } = params

    const hasAccess = await authUser.hasOrganization(Number(id))

    if (!hasAccess) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    authUser.currentOrganizationId = Number(id)
    await authUser.save()

    return response.json({
      message: i18n.t('messages.organization.switched'),
      currentOrganizationId: authUser.currentOrganizationId,
    })
  }

  public async getOrganizationLogo({ response, params }: HttpContext) {
    const logo = params.logo
    const filePath = join(this.LOGO_DIRECTORY, logo)
    return response.download(filePath)
  }

  public async updateOrganization({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    if (!user.currentOrganizationId) {
      return response.status(400).json({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    const organization = await Organization.findOrFail(user.currentOrganizationId)

    if (await bouncer.with(OrganizationPolicy).denies('updateOrganization', organization)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      const oldLogo = organization.logo

      const logo = request.file('logo')
      const fileName = await this.handleLogoUpload(logo)

      const inputData = {
        name: request.input('name', organization.name),
        email: request.input('email', organization.email),
        logo: fileName || oldLogo,
      }

      // Valider les données avec le validator d'update
      const validatedData = await updateOrganizationValidator(user.id, organization.id).validate(
        inputData
      )

      await organization.merge(validatedData).save()

      if (fileName && oldLogo && oldLogo !== fileName) {
        await this.deleteOldLogo(oldLogo)
      }

      return response.json({
        ...validatedData,
        logo: validatedData.logo ? `organization-logo/${validatedData.logo}` : null,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        // Extraire le premier message d'erreur et traduire le nom du champ
        const firstError = error.messages[0]

        if (firstError) {
          // Traduire le nom du champ (ex: "name" → "nom" en français)
          const translatedField = i18n.t(`validation.fields.${firstError.field}`, firstError.field)

          // Injecter le nom traduit dans le message d'erreur
          const translatedMessage = i18n.t(firstError.message, { field: translatedField })

          return response.status(422).json({
            message: translatedMessage,
            error: 'Validation failure',
          })
        }

        return response.status(422).json({
          message: i18n.t('messages.errors.validation_failed'),
          error: 'Validation failure',
        })
      }
      return this.handleError(response, error, i18n)
    }
  }

  /**
   * Supprimer une organisation (seulement si owner)
   */
  public async deleteOrganization({ params, response, auth, bouncer, i18n }: HttpContext) {
    const authUser = auth.user!
    const { id } = params

    const organization = await Organization.findOrFail(id)

    if (await bouncer.with(OrganizationPolicy).denies('deleteOrganization', organization)) {
      return response.status(403).json({
        message: i18n.t('messages.errors.unauthorized'),
      })
    }

    try {
      // Si c'est l'organisation courante, la retirer
      if (authUser.currentOrganizationId === organization.id) {
        authUser.currentOrganizationId = null
        await authUser.save()
      }

      // Supprimer le logo s'il existe
      if (organization.logo) {
        await this.deleteOldLogo(organization.logo)
      }

      // Supprimer l'organisation (cascade supprimera les pivots et invitations)
      await organization.delete()

      return response.json({
        message: i18n.t('messages.organization.deleted'),
      })
    } catch (error) {
      return this.handleError(response, error, i18n)
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
    const files = await fs.readdir(this.LOGO_DIRECTORY)

    for (const file of files) {
      const filePath = join(this.LOGO_DIRECTORY, file)
      const fileHash = await this.getFileHash(filePath)
      if (fileHash === hash) {
        return file
      }
    }

    return null
  }

  private async deleteOldLogo(oldLogo: string): Promise<void> {
    try {
      await fs.unlink(join(this.LOGO_DIRECTORY, oldLogo))
    } catch (error) {
      console.error(`Erreur lors de la suppression de l'ancien logo : ${error.message}`)
    }
  }

  private handleError(response: HttpContext['response'], error: any, i18n: HttpContext['i18n']) {
    console.error(error)
    return response.status(500).json({
      message: i18n.t('messages.errors.server_error'),
      error: error.message,
    })
  }
}

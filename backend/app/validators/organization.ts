import vine from '@vinejs/vine'

export const createOrganizationValidator = (userId: number) =>
  vine.compile(
    vine.object({
      name: vine.string().minLength(2).maxLength(255).unique(async (db, value) => {
        // Vérifier si l'utilisateur a déjà une organisation avec ce nom
        const existingOrg = await db
          .from('organization_user')
          .join('organizations', 'organizations.id', 'organization_user.organization_id')
          .where('organization_user.user_id', userId)
          .whereRaw('LOWER(organizations.name) = LOWER(?)', [value])
          .first()

        return !existingOrg
      }),
      logo: vine.string().optional(),
      email: vine
        .string()
        .email()
        .unique(async (db, value) => {
          // Vérifier si l'email est déjà utilisé par une autre organisation
          const existingOrg = await db
            .from('organizations')
            .where('email', value)
            .first()
          return !existingOrg
        }),
    })
  )

export const updateOrganizationValidator = (userId: number, organizationId: number) =>
  vine.compile(
    vine.object({
      name: vine.string().minLength(2).maxLength(255).unique(async (db, value) => {
        // Vérifier si l'utilisateur a déjà une AUTRE organisation avec ce nom
        // (exclure l'organisation actuelle pour permettre de garder le même nom)
        const existingOrg = await db
          .from('organization_user')
          .join('organizations', 'organizations.id', 'organization_user.organization_id')
          .where('organization_user.user_id', userId)
          .where('organizations.id', '!=', organizationId)
          .whereRaw('LOWER(organizations.name) = LOWER(?)', [value])
          .first()

        return !existingOrg
      }),
      logo: vine.string().optional(),
      email: vine
        .string()
        .email()
        .unique(async (db, value) => {
          // Vérifier si l'email est déjà utilisé par une AUTRE organisation
          const existingOrg = await db
            .from('organizations')
            .where('email', value)
            .where('id', '!=', organizationId)
            .first()
          return !existingOrg
        }),
    })
  )

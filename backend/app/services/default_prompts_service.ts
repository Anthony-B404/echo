import PromptCategory from '#models/prompt_category'
import Prompt from '#models/prompt'

/**
 * Default prompt categories with their prompts
 */
const DEFAULT_CATEGORIES = [
  {
    name: 'Résumé',
    description: 'Prompts pour résumer et synthétiser le contenu audio',
    color: '#3B82F6', // blue
    icon: 'i-heroicons-document-text',
    prompts: [
      {
        title: 'Résumé exécutif',
        content:
          'Fais un résumé exécutif de cette conversation en 3-5 points clés. Mets en avant les décisions prises et les actions à suivre.',
      },
      {
        title: 'Résumé détaillé',
        content:
          'Résume cette conversation de manière détaillée en conservant les informations importantes, les arguments avancés et les conclusions.',
      },
      {
        title: 'Points essentiels',
        content:
          'Extrais les points essentiels de cette conversation sous forme de liste à puces. Concentre-toi sur les informations les plus importantes.',
      },
      {
        title: 'Résumé en une phrase',
        content: "Résume l'essence de cette conversation en une seule phrase percutante.",
      },
    ],
  },
  {
    name: 'Analyse',
    description: 'Prompts pour analyser en profondeur le contenu',
    color: '#8B5CF6', // violet
    icon: 'i-heroicons-chart-bar',
    prompts: [
      {
        title: 'Analyse du sentiment',
        content:
          "Analyse le sentiment général de cette conversation. Identifie les moments de tension, d'accord, d'enthousiasme ou de frustration.",
      },
      {
        title: 'Analyse des arguments',
        content:
          'Analyse les différents arguments avancés dans cette conversation. Identifie les points forts, les faiblesses et les contre-arguments.',
      },
      {
        title: 'Analyse des participants',
        content:
          'Identifie les différents participants à cette conversation. Décris leurs rôles, leurs positions et leurs contributions principales.',
      },
      {
        title: 'Analyse SWOT',
        content:
          'Réalise une analyse SWOT (Forces, Faiblesses, Opportunités, Menaces) basée sur le contenu de cette conversation.',
      },
    ],
  },
  {
    name: 'Extraction',
    description: 'Prompts pour extraire des informations spécifiques',
    color: '#10B981', // green
    icon: 'i-heroicons-funnel',
    prompts: [
      {
        title: 'Actions à faire',
        content:
          'Extrais toutes les actions à faire (TODO) mentionnées dans cette conversation. Pour chaque action, indique si possible le responsable et la deadline.',
      },
      {
        title: 'Décisions prises',
        content:
          'Liste toutes les décisions prises durant cette conversation avec leur contexte et leurs implications.',
      },
      {
        title: 'Questions en suspens',
        content:
          'Identifie toutes les questions restées sans réponse ou les points nécessitant un suivi.',
      },
      {
        title: 'Chiffres et données',
        content:
          'Extrais tous les chiffres, dates, montants et données quantitatives mentionnés dans cette conversation.',
      },
      {
        title: 'Contacts et noms',
        content:
          'Liste tous les noms de personnes, entreprises et contacts mentionnés avec leur contexte.',
      },
    ],
  },
  {
    name: 'Rédaction',
    description: 'Prompts pour générer des documents structurés',
    color: '#F59E0B', // amber
    icon: 'i-heroicons-pencil-square',
    prompts: [
      {
        title: 'Compte-rendu de réunion',
        content:
          "Rédige un compte-rendu de réunion professionnel incluant : les participants, l'ordre du jour, les points discutés, les décisions prises et les actions à suivre.",
      },
      {
        title: 'Email de suivi',
        content:
          'Rédige un email de suivi professionnel reprenant les points clés de cette conversation et les prochaines étapes.',
      },
      {
        title: 'Rapport médical',
        content:
          'Structure cette dictée médicale en rapport professionnel avec : motif de consultation, anamnèse, examen clinique, diagnostic et plan de traitement.',
      },
      {
        title: 'Note juridique',
        content:
          "Transforme cette conversation en note juridique structurée avec les faits, les points de droit, l'analyse et les recommandations.",
      },
      {
        title: 'Fiche client',
        content:
          'Crée une fiche client à partir de cette conversation incluant : informations de contact, besoins exprimés, historique des échanges et prochaines étapes commerciales.',
      },
    ],
  },
]

/**
 * Service to seed default prompts for an organization
 */
class DefaultPromptsService {
  /**
   * Seed default categories and prompts for an organization
   */
  async seedForOrganization(organizationId: number): Promise<void> {
    let sortOrder = 0

    for (const categoryData of DEFAULT_CATEGORIES) {
      // Create category
      const category = await PromptCategory.create({
        organizationId,
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color,
        icon: categoryData.icon,
        isDefault: true,
        sortOrder: sortOrder++,
      })

      // Create prompts for this category
      let promptSortOrder = 0
      for (const promptData of categoryData.prompts) {
        await Prompt.create({
          organizationId,
          categoryId: category.id,
          title: promptData.title,
          content: promptData.content,
          isDefault: true,
          isFavorite: false,
          usageCount: 0,
          sortOrder: promptSortOrder++,
        })
      }
    }
  }

  /**
   * Check if organization already has default prompts seeded
   */
  async hasDefaultPrompts(organizationId: number): Promise<boolean> {
    const count = await Prompt.query()
      .where('organizationId', organizationId)
      .where('isDefault', true)
      .count('id as total')
      .first()

    return (count?.$extras.total || 0) > 0
  }

  /**
   * Seed default prompts only if they don't exist
   */
  async seedIfNeeded(organizationId: number): Promise<boolean> {
    const hasPrompts = await this.hasDefaultPrompts(organizationId)
    if (!hasPrompts) {
      await this.seedForOrganization(organizationId)
      return true
    }
    return false
  }
}

export default new DefaultPromptsService()

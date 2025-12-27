import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Organization from '#models/organization'
import defaultPromptsService from '#services/default_prompts_service'

export default class extends BaseSeeder {
  async run() {
    // Get all existing organizations
    const organizations = await Organization.all()

    console.log(`Found ${organizations.length} organizations to seed`)

    let seededCount = 0
    let skippedCount = 0

    for (const organization of organizations) {
      const wasSeeded = await defaultPromptsService.seedIfNeeded(organization.id)

      if (wasSeeded) {
        seededCount++
        console.log(
          `✓ Seeded prompts for organization: ${organization.name} (ID: ${organization.id})`
        )
      } else {
        skippedCount++
        console.log(
          `- Skipped organization: ${organization.name} (ID: ${organization.id}) - already has prompts`
        )
      }
    }

    console.log(`\nSeeding complete:`)
    console.log(`  - Seeded: ${seededCount} organizations`)
    console.log(`  - Skipped: ${skippedCount} organizations`)
  }
}

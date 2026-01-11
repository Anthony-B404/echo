import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Organization from '#models/organization'
import Prompt from '#models/prompt'
import PromptCategory from '#models/prompt_category'
import defaultPromptsService from '#services/default_prompts_service'

export default class extends BaseSeeder {
    async run() {
        // Get all existing organizations
        const organizations = await Organization.all()

        console.log(`Found ${organizations.length} organizations to update`)

        for (const organization of organizations) {
            console.log(`\nUpdating organization: ${organization.name} (ID: ${organization.id})`)

            // Delete all existing default prompts for this organization
            const deletedPrompts = await Prompt.query()
                .where('organizationId', organization.id)
                .where('isDefault', true)
                .delete()
            console.log(`  - Deleted ${deletedPrompts[0] || 0} default prompts`)

            // Delete all existing default categories for this organization
            const deletedCategories = await PromptCategory.query()
                .where('organizationId', organization.id)
                .where('isDefault', true)
                .delete()
            console.log(`  - Deleted ${deletedCategories[0] || 0} default categories`)

            // Re-seed with new prompts
            await defaultPromptsService.seedForOrganization(organization.id)
            console.log(`  ✓ Seeded new prompts and categories`)
        }

        console.log(`\n✅ Update complete for ${organizations.length} organizations`)
    }
}

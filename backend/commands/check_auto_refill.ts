import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CheckAutoRefill extends BaseCommand {
  static commandName = 'check:auto-refill'
  static description =
    'Check for auto-refills due tomorrow and notify owners if credits are insufficient'

  static options: CommandOptions = {
    startApp: true, // Required to access models and database
  }

  async run() {
    const { checkAutoRefillsForTomorrow } = await import('#jobs/auto_refill_check_job')

    this.logger.info('Checking auto-refills due tomorrow...')
    this.logger.info('')

    const result = await checkAutoRefillsForTomorrow()

    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Auto-Refill Check Results')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info(`Organizations checked: ${result.organizationsChecked}`)
    this.logger.warning(`Warnings sent: ${result.warnings}`)
    this.logger.info('')

    if (result.details.length > 0) {
      this.logger.info('Details:')
      for (const detail of result.details) {
        const status = detail.notificationSent
          ? this.colors.yellow('WARNING SENT')
          : this.colors.green('OK')

        this.logger.info(
          `  - ${detail.organizationName}: ${status}` +
            ` (${detail.usersAffected} users, needs ${detail.creditsNeeded} credits, has ${detail.creditsAvailable})`
        )
      }
    } else {
      this.logger.info('No auto-refills scheduled for tomorrow.')
    }

    this.logger.info('')
    this.logger.info('Note: Warnings are sent to organization owners when there are')
    this.logger.info('insufficient credits to complete scheduled auto-refills.')
  }
}

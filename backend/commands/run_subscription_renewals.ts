import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class RunSubscriptionRenewals extends BaseCommand {
  static commandName = 'subscription:renew'
  static description = 'Run subscription renewals and user auto-refills'

  static options: CommandOptions = {
    startApp: true, // Required to access models and database
  }

  async run() {
    const { processAllRenewals } = await import('#jobs/subscription_renewal_job')

    this.logger.info('Starting renewal process...')
    this.logger.info('')

    const result = await processAllRenewals()

    // Phase 1: Organization Renewals
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Phase 1: Organization Subscription Renewals')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info(`Processed: ${result.organizationRenewals.processed}`)
    this.logger.success(`Successful: ${result.organizationRenewals.successful}`)
    this.logger.warning(`Skipped: ${result.organizationRenewals.skipped}`)
    if (result.organizationRenewals.failed > 0) {
      this.logger.error(`Failed: ${result.organizationRenewals.failed}`)
    }

    if (result.organizationRenewals.details.length > 0) {
      this.logger.info('\nDetails:')
      for (const detail of result.organizationRenewals.details) {
        const status =
          detail.status === 'success'
            ? this.colors.green(detail.status)
            : detail.status === 'skipped'
              ? this.colors.yellow(detail.status)
              : this.colors.red(detail.status)

        this.logger.info(
          `  - ${detail.organizationName}: ${status}` +
            (detail.creditsTransferred ? ` (${detail.creditsTransferred} credits)` : '') +
            (detail.reason ? ` - ${detail.reason}` : '')
        )
      }
    } else {
      this.logger.info('No organization subscriptions due for renewal.')
    }

    // Phase 2: User Auto-Refills
    this.logger.info('')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Phase 2: User Auto-Refills')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info(`Processed: ${result.userAutoRefills.processed}`)
    this.logger.success(`Successful: ${result.userAutoRefills.successful}`)
    this.logger.warning(`Skipped: ${result.userAutoRefills.skipped}`)
    if (result.userAutoRefills.failed > 0) {
      this.logger.error(`Failed: ${result.userAutoRefills.failed}`)
    }

    if (result.userAutoRefills.details.length > 0) {
      this.logger.info('\nDetails:')
      for (const detail of result.userAutoRefills.details) {
        const status =
          detail.status === 'success'
            ? this.colors.green(detail.status)
            : detail.status === 'skipped'
              ? this.colors.yellow(detail.status)
              : this.colors.red(detail.status)

        this.logger.info(
          `  - ${detail.userName} (${detail.organizationName}): ${status}` +
            (detail.creditsTransferred ? ` (${detail.creditsTransferred} credits)` : '') +
            (detail.reason ? ` - ${detail.reason}` : '')
        )
      }
    } else {
      this.logger.info('No users due for auto-refill today.')
    }

    // Summary
    this.logger.info('')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Summary')
    this.logger.info('═══════════════════════════════════════════')
    const totalProcessed = result.organizationRenewals.processed + result.userAutoRefills.processed
    const totalSuccessful =
      result.organizationRenewals.successful + result.userAutoRefills.successful
    this.logger.info(`Total processed: ${totalProcessed}`)
    this.logger.success(`Total successful: ${totalSuccessful}`)
  }
}

import { BaseCommand, args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CleanupCreditRequests extends BaseCommand {
  static commandName = 'cleanup:credit-requests'
  static description = 'Clean up old credit requests (older than 90 days by default)'

  static options: CommandOptions = {
    startApp: true, // Required to access models and database
  }

  @args.string({ description: 'Number of days to keep requests', required: false })
  declare days?: string

  async run() {
    const { cleanupOldCreditRequests } = await import('#jobs/credit_request_cleanup_job')

    const daysToKeep = this.days ? Number.parseInt(this.days, 10) : 90

    if (Number.isNaN(daysToKeep) || daysToKeep < 1) {
      this.logger.error('Days must be a positive number')
      return
    }

    this.logger.info(`Starting credit requests cleanup (keeping requests from last ${daysToKeep} days)...`)
    this.logger.info('')

    const result = await cleanupOldCreditRequests(daysToKeep)

    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Credit Requests Cleanup Results')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.info(`Scanned: ${result.scanned} processed request(s)`)
    this.logger.success(`Deleted: ${result.deleted} old request(s)`)
    this.logger.info('')
    this.logger.info('Note: Pending requests are never deleted.')
  }
}

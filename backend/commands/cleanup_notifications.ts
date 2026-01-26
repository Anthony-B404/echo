import { BaseCommand, args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CleanupNotifications extends BaseCommand {
  static commandName = 'cleanup:notifications'
  static description = 'Clean up old read notifications (older than 30 days by default)'

  static options: CommandOptions = {
    startApp: true, // Required to access models and database
  }

  @args.string({ description: 'Number of days to keep read notifications', required: false })
  declare days?: string

  async run() {
    const { cleanupOldNotifications } = await import('#jobs/notification_cleanup_job')

    const daysToKeep = this.days ? Number.parseInt(this.days, 10) : 30

    if (Number.isNaN(daysToKeep) || daysToKeep < 1) {
      this.logger.error('Days must be a positive number')
      return
    }

    this.logger.info(
      `Starting notifications cleanup (keeping read notifications from last ${daysToKeep} days)...`
    )
    this.logger.info('')

    const result = await cleanupOldNotifications(daysToKeep)

    this.logger.info('═══════════════════════════════════════════')
    this.logger.info('Notifications Cleanup Results')
    this.logger.info('═══════════════════════════════════════════')
    this.logger.success(`Deleted: ${result.deleted} old read notification(s)`)
    this.logger.info('')
    this.logger.info('Note: Only read notifications are deleted. Unread notifications are kept.')
  }
}

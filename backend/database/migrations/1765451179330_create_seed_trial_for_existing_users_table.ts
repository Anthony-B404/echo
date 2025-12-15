import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Give existing users without subscription a trial starting now
    await this.db.rawQuery(`
      UPDATE users
      SET
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '14 days',
        trial_used = true
      WHERE onboarding_completed = true
        AND id NOT IN (SELECT user_id FROM subscriptions WHERE user_id IS NOT NULL)
    `)

    // Mark users with active subscription as having used trial
    await this.db.rawQuery(`
      UPDATE users
      SET trial_used = true
      WHERE id IN (SELECT user_id FROM subscriptions WHERE user_id IS NOT NULL)
    `)
  }

  async down() {
    // Reset trial fields for all users
    await this.db.rawQuery(`
      UPDATE users
      SET
        trial_started_at = NULL,
        trial_ends_at = NULL,
        trial_used = false
    `)
  }
}

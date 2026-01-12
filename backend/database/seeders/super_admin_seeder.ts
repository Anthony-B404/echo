import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import env from '#start/env'

export default class extends BaseSeeder {
  async run() {
    const superAdminEmail = env.get('SUPER_ADMIN_EMAIL')

    if (!superAdminEmail) {
      console.log('⚠️  SUPER_ADMIN_EMAIL not set in environment. Skipping Super Admin creation.')
      return
    }

    let user = await User.findBy('email', superAdminEmail)

    if (!user) {
      // Create the Super Admin user
      const superAdminName = env.get('SUPER_ADMIN_NAME') || 'Super Admin'
      const nameParts = superAdminName.trim().split(/\s+/)
      const firstName = nameParts[0] || 'Super'
      const lastName = nameParts.slice(1).join(' ') || 'Admin'

      user = await User.create({
        email: superAdminEmail,
        fullName: superAdminName,
        firstName,
        lastName,
        isSuperAdmin: true,
        onboardingCompleted: true,
        disabled: false,
        credits: 0, // Super Admin doesn't need credits
      })

      console.log(`✅ Super Admin user created: "${superAdminEmail}" (${firstName} ${lastName})`)
      console.log('   Use magic link authentication to log in for the first time.')
      return
    }

    if (user.isSuperAdmin) {
      console.log(`ℹ️  User "${superAdminEmail}" is already a Super Admin.`)
      return
    }

    user.isSuperAdmin = true
    await user.save()

    console.log(`✅ User "${superAdminEmail}" has been promoted to Super Admin.`)
  }
}

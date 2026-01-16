/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const OrganizationsController = () => import('#controllers/organizations_controller')
const InvitationsController = () => import('#controllers/invitations_controller')
const MembersController = () => import('#controllers/members_controller')
const ContactController = () => import('#controllers/contact_controller')
const AudioController = () => import('#controllers/audio_controller')
const AudiosController = () => import('#controllers/audios_controller')
const PromptsController = () => import('#controllers/prompts_controller')
const PromptCategoriesController = () => import('#controllers/prompt_categories_controller')
const CreditsController = () => import('#controllers/credits_controller')
const AudioSharesController = () => import('#controllers/audio_shares_controller')
const SharedAudioController = () => import('#controllers/shared_audio_controller')
const GdprController = () => import('#controllers/gdpr_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Health check endpoint for Docker and load balancers
router.get('/health', async ({ response }) => {
  return response.ok({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

// Public routes - Login flow
router.post('/login/request-magic-link', [AuthController, 'loginWithMagicLink'])

// Public route - Verify magic link (handles both registration and login)
router.get('/verify-magic-link/:token', [AuthController, 'verifyMagicLink'])

router.get('/organization-logo/:logo', [OrganizationsController, 'getOrganizationLogo'])
router.get('/user-avatar/:avatar', [UsersController, 'getUserAvatar'])

// Static logo for emails
router.get('/logo.png', async ({ response }) => {
  return response.download(app.publicPath('logo.png'))
})

// BIMI logo for email client avatars
router.get('/bimi-logo.svg', async ({ response }) => {
  response.header('Content-Type', 'image/svg+xml')
  return response.download(app.publicPath('bimi-logo.svg'))
})

router.get('/check-invitation/:identifier', [InvitationsController, 'checkInvitation'])
router.post('/accept-invitation', [InvitationsController, 'acceptInvitation'])

// Complete registration (after magic link verification)
router.post('/complete-registration', [AuthController, 'completeRegistration'])

// Email verification route
router.get('/verify-email-change/:token', [UsersController, 'verifyEmailChange'])

// Public routes for shared audios (no auth required)
router.get('/shared/:identifier', [SharedAudioController, 'show'])
router.get('/shared/:identifier/export', [SharedAudioController, 'export'])
router.get('/shared/:identifier/audio', [SharedAudioController, 'audio'])

// Protected routes - Always accessible (even with pending deletion)
router
  .group(() => {
    // Auth routes
    router.post('/logout', [AuthController, 'logout'])
    router.get('/check-token', [AuthController, 'checkToken'])

    // User info (needed for UI)
    router.get('/me', [UsersController, 'me'])

    // Organization info (needed for UI initialization)
    router.get('/organization', [OrganizationsController, 'getOrganizationWithUsers'])
    router.get('/organizations', [OrganizationsController, 'listUserOrganizations'])

    // GDPR routes - Always accessible for account management
    router.get('/gdpr/data-summary', [GdprController, 'dataSummary'])
    router.get('/gdpr/export', [GdprController, 'export'])
    router.get('/gdpr/orphan-organizations', [GdprController, 'orphanOrganizations'])
    router.post('/gdpr/request-deletion', [GdprController, 'requestDeletion'])
    router.post('/gdpr/cancel-deletion', [GdprController, 'cancelDeletion'])
    router.get('/gdpr/deletion-status', [GdprController, 'deletionStatus'])
  })
  .use(middleware.auth({ guards: ['api'] }))

// Protected routes - Restricted when pending deletion
router
  .group(() => {
    // User routes
    router.put('/profile', [UsersController, 'updateProfile'])

    // Organization routes (write operations only - read operations are always accessible)
    router.post('/organizations', [OrganizationsController, 'createOrganization'])
    router.post('/organizations/:id/switch', [OrganizationsController, 'switchOrganization'])
    router.put('/organization/update', [OrganizationsController, 'updateOrganization'])
    router.delete('/organizations/:id', [OrganizationsController, 'deleteOrganization'])
    router.get('/members', [OrganizationsController, 'getMembers'])

    // Member management routes
    router.put('/update-member/:id', [MembersController, 'updateMember'])
    router.put('/update-member-role/:id', [MembersController, 'updateMemberRole'])
    router.delete('/delete-member/:id', [MembersController, 'deleteMember'])

    // Invitation routes
    router.post('/invite-member', [InvitationsController, 'createInvitation'])
    router.get('/invitations', [InvitationsController, 'listInvitations'])
    router.post('/resend-invitation/:id', [InvitationsController, 'resendInvitation'])
    router.delete('/delete-invitation/:id', [InvitationsController, 'deleteInvitation'])

    // Audio analysis routes
    router.post('/audio/process', [AudioController, 'process'])
    router.get('/audio/status/:jobId', [AudioController, 'status'])

    // Audio CRUD routes
    router.get('/audios', [AudiosController, 'index'])
    router.get('/audios/:id', [AudiosController, 'show'])
    router.get('/audios/:id/file', [AudiosController, 'file'])
    router.put('/audios/:id', [AudiosController, 'update'])
    router.post('/audios/:id/export', [AudiosController, 'export'])
    router.delete('/audios/batch', [AudiosController, 'destroyMultiple'])
    router.delete('/audios/:id', [AudiosController, 'destroy'])

    // Audio share routes
    router.post('/audios/:id/share', [AudioSharesController, 'share'])
    router.get('/audios/:id/shares', [AudioSharesController, 'index'])
    router.delete('/shares/:id', [AudioSharesController, 'destroy'])

    // Prompt categories routes
    router.get('/prompt-categories', [PromptCategoriesController, 'index'])
    router.get('/prompt-categories/:id', [PromptCategoriesController, 'show'])
    router.post('/prompt-categories', [PromptCategoriesController, 'store'])
    router.put('/prompt-categories/:id', [PromptCategoriesController, 'update'])
    router.delete('/prompt-categories/:id', [PromptCategoriesController, 'destroy'])
    router.post('/prompt-categories/reorder', [PromptCategoriesController, 'reorder'])

    // Prompts routes
    router.get('/prompts', [PromptsController, 'index'])
    router.get('/prompts/:id', [PromptsController, 'show'])
    router.post('/prompts', [PromptsController, 'store'])
    router.put('/prompts/:id', [PromptsController, 'update'])
    router.delete('/prompts/batch', [PromptsController, 'destroyMultiple'])
    router.delete('/prompts/:id', [PromptsController, 'destroy'])
    router.post('/prompts/:id/favorite', [PromptsController, 'toggleFavorite'])
    router.post('/prompts/:id/use', [PromptsController, 'incrementUsage'])
    router.post('/prompts/reorder', [PromptsController, 'reorder'])

    // Credits routes
    router.get('/credits', [CreditsController, 'balance'])
    router.get('/credits/history', [CreditsController, 'history'])

    // Contact support route
    router.post('/contact', [ContactController, 'send'])
  })
  .use([middleware.auth({ guards: ['api'] }), middleware.pendingDeletion()])

// Admin controllers (lazy import)
const ResellersController = () => import('#controllers/admin/resellers_controller')
const ResellerCreditsController = () => import('#controllers/admin/reseller_credits_controller')
const AdminStatsController = () => import('#controllers/admin/admin_stats_controller')

// Super Admin routes - Reseller management
router
  .group(() => {
    // Global stats
    router.get('/stats', [AdminStatsController, 'index'])

    // Reseller CRUD
    router.get('/resellers', [ResellersController, 'index'])
    router.post('/resellers', [ResellersController, 'store'])
    router.get('/resellers/:id', [ResellersController, 'show'])
    router.put('/resellers/:id', [ResellersController, 'update'])
    router.delete('/resellers/:id', [ResellersController, 'destroy'])

    // Reseller credits management
    router.post('/resellers/:id/credits', [ResellerCreditsController, 'addCredits'])
    router.post('/resellers/:id/credits/remove', [ResellerCreditsController, 'removeCredits'])
    router.get('/resellers/:id/transactions', [ResellerCreditsController, 'transactions'])
  })
  .prefix('/admin')
  .use([middleware.auth({ guards: ['api'] }), middleware.superAdmin()])

// Reseller API controllers (lazy import)
const ResellerProfileController = () =>
  import('#controllers/reseller/reseller_profile_controller')
const ResellerApiCreditsController = () =>
  import('#controllers/reseller/reseller_credits_controller')
const ResellerOrganizationsController = () =>
  import('#controllers/reseller/reseller_organizations_controller')
const ResellerUsersController = () => import('#controllers/reseller/reseller_users_controller')

// Reseller API routes
router
  .group(() => {
    // Profile
    router.get('/profile', [ResellerProfileController, 'show'])

    // Credits
    router.get('/credits', [ResellerApiCreditsController, 'index'])

    // Organizations
    router.get('/organizations', [ResellerOrganizationsController, 'index'])
    router.post('/organizations', [ResellerOrganizationsController, 'store'])
    router.get('/organizations/:id', [ResellerOrganizationsController, 'show'])
    router.put('/organizations/:id', [ResellerOrganizationsController, 'update'])

    // Credit distribution
    router.post('/organizations/:id/credits', [ResellerOrganizationsController, 'distributeCredits'])

    // User management
    router.get('/organizations/:id/users', [ResellerUsersController, 'index'])
    router.post('/organizations/:id/users', [ResellerUsersController, 'store'])
    router.delete('/organizations/:id/users/:userId', [ResellerUsersController, 'destroy'])
  })
  .prefix('/reseller')
  .use([middleware.auth({ guards: ['api'] }), middleware.reseller()])

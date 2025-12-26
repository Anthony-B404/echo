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

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const OrganizationsController = () => import('#controllers/organizations_controller')
const InvitationsController = () => import('#controllers/invitations_controller')
const SocialAuthController = () => import('#controllers/social_auth_controller')
const MembersController = () => import('#controllers/members_controller')
const BillingController = () => import('#controllers/billing_controller')
const WebhooksController = () => import('#controllers/webhooks_controller')
const ContactController = () => import('#controllers/contact_controller')
const AudioController = () => import('#controllers/audio_controller')
const AudiosController = () => import('#controllers/audios_controller')
const PromptsController = () => import('#controllers/prompts_controller')
const PromptCategoriesController = () => import('#controllers/prompt_categories_controller')
const CreditsController = () => import('#controllers/credits_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Public routes - Registration flow
router.post('/register/request-magic-link', [AuthController, 'registerWithMagicLink'])
router.post('/register/complete', [AuthController, 'completeRegistration'])

// Public routes - Login flow
router.post('/login/request-magic-link', [AuthController, 'loginWithMagicLink'])

// Public route - Verify magic link (handles both registration and login)
router.get('/verify-magic-link/:token', [AuthController, 'verifyMagicLink'])

router.get('/organization-logo/:logo', [OrganizationsController, 'getOrganizationLogo'])
router.get('/user-avatar/:avatar', [UsersController, 'getUserAvatar'])

router.get('/check-invitation/:identifier', [InvitationsController, 'checkInvitation'])
router.post('/accept-invitation', [InvitationsController, 'acceptInvitation'])

// Email verification route
router.get('/verify-email-change/:token', [UsersController, 'verifyEmailChange'])

// OAuth routes
router.get('/auth/google/redirect', [SocialAuthController, 'googleRedirect'])
router.get('/auth/google/callback', [SocialAuthController, 'googleCallback'])

// Webhook routes (public - signature verified in controller)
router.post('/webhooks/lemonsqueezy', [WebhooksController, 'handleLemonSqueezy'])

// Protected routes WITHOUT trial guard (always accessible when authenticated)
router
  .group(() => {
    // Auth routes (must work even when trial expired)
    router.post('/logout', [AuthController, 'logout'])
    router.get('/check-token', [AuthController, 'checkToken'])

    // User routes (must work even when trial expired for UI display)
    router.get('/me', [UsersController, 'me'])

    // OAuth completion route (onboarding - trial not yet set)
    router.post('/oauth/complete-registration', [SocialAuthController, 'completeOAuthRegistration'])

    // Organization GET (needed for auth callback flow and UI display when trial expired)
    router.get('/organization', [OrganizationsController, 'getOrganizationWithUsers'])
    router.get('/organizations', [OrganizationsController, 'listUserOrganizations'])

    // Organization creation (must work when trial expired for members to create their own org)
    router.post('/organizations', [OrganizationsController, 'createOrganization'])

    // Organization switch (must work when current org is blocked to switch to accessible org)
    router.post('/organizations/:id/switch', [OrganizationsController, 'switchOrganization'])

    // List accessible organizations (for blocked modal to show switch options)
    router.get('/organizations/accessible', [OrganizationsController, 'listAccessibleOrganizations'])

    // Billing routes (must work even when trial expired for subscription)
    router.get('/billing/status', [BillingController, 'getSubscriptionStatus'])
    router.post('/billing/checkout', [BillingController, 'createCheckoutSession'])
    router.post('/billing/cancel', [BillingController, 'cancelSubscription'])
    router.post('/billing/reactivate', [BillingController, 'reactivateSubscription'])

    // Contact support route
    router.post('/contact', [ContactController, 'send'])
  })
  .use(middleware.auth({ guards: ['api'] }))

// Protected routes WITH trial guard (blocked when trial expired)
router
  .group(() => {
    // User routes
    router.put('/profile', [UsersController, 'updateProfile'])

    // Member management routes
    router.put('/update-member/:id', [MembersController, 'updateMember'])
    router.put('/update-member-role/:id', [MembersController, 'updateMemberRole'])
    router.delete('/delete-member/:id', [MembersController, 'deleteMember'])

    // Organization routes (PUT/DELETE actions blocked when trial expired)
    router.put('/organization/update', [OrganizationsController, 'updateOrganization'])
    router.delete('/organizations/:id', [OrganizationsController, 'deleteOrganization'])
    router.get('/members', [OrganizationsController, 'getMembers'])

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
  })
  .use(middleware.auth({ guards: ['api'] }))
  .use(middleware.trialGuard())

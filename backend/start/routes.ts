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

// Protected routes
router
  .group(() => {
    // Auth routes
    router.post('/logout', [AuthController, 'logout'])
    router.get('/check-token', [AuthController, 'checkToken'])

    // User routes
    router.get('/me', [UsersController, 'me'])
    router.put('/profile', [UsersController, 'updateProfile'])

    // Member management routes
    router.put('/update-member/:id', [MembersController, 'updateMember'])
    router.put('/update-member-role/:id', [MembersController, 'updateMemberRole'])
    router.delete('/delete-member/:id', [MembersController, 'deleteMember'])

    // OAuth completion route (requires authentication)
    router.post('/oauth/complete-registration', [SocialAuthController, 'completeOAuthRegistration'])

    // Organization routes
    router.get('/organizations', [OrganizationsController, 'listUserOrganizations'])
    router.post('/organizations', [OrganizationsController, 'createOrganization'])
    router.get('/organization', [OrganizationsController, 'getOrganizationWithUsers'])
    router.put('/organization/update', [OrganizationsController, 'updateOrganization'])
    router.post('/organizations/:id/switch', [OrganizationsController, 'switchOrganization'])
    router.delete('/organizations/:id', [OrganizationsController, 'deleteOrganization'])
    router.get('/members', [OrganizationsController, 'getMembers'])

    // Invitation routes
    router.post('/invite-member', [InvitationsController, 'createInvitation'])
    router.get('/invitations', [InvitationsController, 'listInvitations'])
    router.post('/resend-invitation/:id', [InvitationsController, 'resendInvitation'])
    router.delete('/delete-invitation/:id', [InvitationsController, 'deleteInvitation'])

    // Billing routes
    router.get('/billing/status', [BillingController, 'getSubscriptionStatus'])
    router.post('/billing/checkout', [BillingController, 'createCheckoutSession'])
  })
  .use(middleware.auth({ guards: ['api'] }))

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

const UsersController = () => import('#controllers/users_controller')
const OrganizationsController = () => import('#controllers/organizations_controller')
const InvitationsController = () => import('#controllers/invitations_controller')
const SocialAuthController = () => import('#controllers/social_auth_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Public routes - Registration flow
router.post('/register/request-magic-link', [UsersController, 'registerWithMagicLink'])
router.post('/register/complete', [UsersController, 'completeRegistration'])

// Public routes - Login flow
router.post('/login/request-magic-link', [UsersController, 'loginWithMagicLink'])

// Public route - Verify magic link (handles both registration and login)
router.get('/verify-magic-link/:token', [UsersController, 'verifyMagicLink'])

router.get('/organization-logo/:logo', [OrganizationsController, 'getOrganizationLogo'])

router.get('/check-invitation/:identifier', [InvitationsController, 'checkInvitation'])
router.post('/accept-invitation', [InvitationsController, 'acceptInvitation'])

// OAuth routes
router.get('/auth/google/redirect', [SocialAuthController, 'googleRedirect'])
router.get('/auth/google/callback', [SocialAuthController, 'googleCallback'])

// Protected routes
router
  .group(() => {
    // User routes
    router.post('/logout', [UsersController, 'logout'])
    router.get('/me', [UsersController, 'me'])
    router.get('/check-token', [UsersController, 'checkToken'])
    router.delete('/delete-member/:id', [UsersController, 'deleteMember'])

    // OAuth completion route (requires authentication)
    router.post('/oauth/complete-registration', [
      SocialAuthController,
      'completeOAuthRegistration',
    ])

    // Organization routes
    router.get('/organization', [OrganizationsController, 'getOrganizationWithUsers'])
    router.put('/organization/update', [OrganizationsController, 'updateOrganization'])

    // Invitation routes
    router.post('/invite-member', [InvitationsController, 'createInvitation'])
    router.delete('/delete-invitation/:id', [InvitationsController, 'deleteInvitation'])
  })
  .use(middleware.auth({ guards: ['api'] }))

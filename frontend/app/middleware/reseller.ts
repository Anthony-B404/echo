/**
 * Reseller middleware
 * Protects reseller routes - requires user.resellerId to be set
 * Redirects to dashboard if user is not a reseller admin
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, user } = useAuth()
  const localePath = useLocalePath()

  // First check authentication
  if (!isAuthenticated.value) {
    return navigateTo({
      path: localePath('/'),
      query: {
        redirect: to.fullPath,
      },
    })
  }

  // Then check reseller admin status (user must have resellerId)
  if (!user.value?.resellerId) {
    // Redirect to dashboard - user is authenticated but not a reseller admin
    return navigateTo(localePath('/dashboard'))
  }
})

/**
 * Auth middleware
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useAuth();
  const { $localePath } = useNuxtApp();

  // If user is not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo({
      path: $localePath("index"),
      query: {
        redirect: to.fullPath, // Save intended destination
      },
    });
  }
});

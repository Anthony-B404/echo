/**
 * Auth middleware
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 */
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth();
  const { $localePath } = useNuxtApp();

  // If user is not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo({
      path: $localePath("login"),
      query: {
        redirect: to.fullPath, // Save intended destination
      },
    });
  }
});

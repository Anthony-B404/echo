/**
 * Auth middleware
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 * Access blocking is handled by AccessBlockedModal in the layout
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useAuth();
  const { $localePath } = useNuxtApp();
  const trialStore = useTrialStore();

  // If user is not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo({
      path: $localePath("login"),
      query: {
        redirect: to.fullPath, // Save intended destination
      },
    });
  }

  // Fetch trial status if not loaded (needed for AccessBlockedModal in layout)
  if (!trialStore.loaded) {
    await trialStore.fetchTrialStatus();
  }
});

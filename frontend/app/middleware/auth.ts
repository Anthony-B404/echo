/**
 * Auth middleware
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 * Redirects superadmin to /admin if they try to access /dashboard
 * Redirects reseller admin to /reseller if they try to access /dashboard
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, user } = useAuth();
  const localePath = useLocalePath();

  // If user is not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo({
      path: localePath("/"),
      query: {
        redirect: to.fullPath, // Save intended destination
      },
    });
  }

  // SuperAdmin cannot access dashboard pages - redirect to admin
  if (user.value?.isSuperAdmin && to.path.includes("/dashboard")) {
    return navigateTo(localePath("/admin"));
  }

  // Reseller admin cannot access dashboard pages - redirect to reseller
  if (user.value?.resellerId && to.path.includes("/dashboard")) {
    return navigateTo(localePath("/reseller"));
  }
});

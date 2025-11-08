import { navigateTo, defineNuxtRouteMiddleware } from "#app";
import { useAuthStore } from "@/stores/authStore";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  // Liste des routes publiques
  const publicRoutes = [
    "/login",
    "/signup",
    "/waiting-verification",
    "/verify-email",
  ];

  if (authStore.isAuthenticated) {
    authStore.checkTokenValidity();

    // Vérification de l'email
    if (
      !authStore.isEmailVerified &&
      !to.path.startsWith("/verify-email/") &&
      !publicRoutes.includes(to.path) &&
      to.path !== "/waiting-verification"
    ) {
      return navigateTo("/waiting-verification");
    }
  }

  if (
    !authStore.isAuthenticated &&
    !publicRoutes.includes(to.path) &&
    !to.path.startsWith("/invitation/") &&
    !to.path.startsWith("/verify-email/")
  ) {
    return navigateTo("/login");
  }

  if (
    authStore.isAuthenticated &&
    (publicRoutes.includes(to.path) || to.path.startsWith("/invitation/")) &&
    authStore.isEmailVerified
  ) {
    return navigateTo("/");
  }
});

import { useAuthStore } from "~/stores/auth";

/**
 * Auth plugin
 * Initializes authentication state when the app starts
 */
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();

  // Initialize auth state (restore token and fetch user if valid)
  await authStore.init();
});

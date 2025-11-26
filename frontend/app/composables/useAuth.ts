import { useAuthStore } from "~/stores/auth";
import { storeToRefs } from "pinia";

/**
 * Authentication composable
 * Provides easy access to auth state and methods
 */
export const useAuth = () => {
  const authStore = useAuthStore();
  const { user, token, isAuthenticated, loading } = storeToRefs(authStore);

  /**
   * Get authorization headers for API requests
   */
  const getAuthHeaders = () => {
    if (!token.value) {
      return {};
    }

    return {
      Authorization: `Bearer ${token.value}`,
    };
  };

  /**
   * Make authenticated API request
   */
  const authenticatedFetch = async <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const config = useRuntimeConfig();
    const fullUrl = url.startsWith("http")
      ? url
      : `${config.public.apiUrl}${url}`;

    return await $fetch<T>(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeaders(),
      },
    });
  };

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated: computed(() => isAuthenticated.value),
    loading: computed(() => loading.value),

    // Methods
    login: authStore.login,
    logout: authStore.logout,
    fetchUser: authStore.fetchUser,
    checkAuth: authStore.checkAuth,
    setToken: authStore.setToken,

    // Helpers
    getAuthHeaders,
    authenticatedFetch,
  };
};

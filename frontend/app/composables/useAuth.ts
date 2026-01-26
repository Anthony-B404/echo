import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'

interface AuthFetchOptions {
  method?: HttpMethod
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: BodyInit | Record<string, any> | null
  headers?: Record<string, string>
  baseURL?: string
}

/**
 * Authentication composable
 * Provides easy access to auth state and methods
 */
export const useAuth = () => {
  const authStore = useAuthStore()
  const { user, token, isAuthenticated, loading } = storeToRefs(authStore)

  /**
   * Get authorization headers for API requests
   */
  const getAuthHeaders = (): Record<string, string> => {
    if (!token.value) {
      return {}
    }

    return {
      Authorization: `Bearer ${token.value}`
    }
  }

  /**
   * Make authenticated API request
   */
  const authenticatedFetch = async <T>(
    url: string,
    options: AuthFetchOptions = {}
  ): Promise<T> => {
    const api = useApi()

    const mergedOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeaders()
      }
    }

    return await api<T>(url, mergedOptions)
  }

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
    authenticatedFetch
  }
}

import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'
type FetchOptions = Omit<NitroFetchOptions<NitroFetchRequest>, 'method'> & {
  method?: HttpMethod
  baseURL?: string
}

/**
 * API Composable
 * Provides $fetch wrapper with automatic Accept-Language header
 * based on current i18n locale (reactive to locale changes)
 */
export const useApi = () => {
  const { $i18n } = useNuxtApp()
  const config = useRuntimeConfig()

  /**
   * Make API request with automatic Accept-Language header
   * @param url - API endpoint (relative or absolute)
   * @param options - Fetch options
   * @returns Promise with typed response
   */
  const apiFetch = async <T>(
    url: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    // Get current locale (reactive - always up to date)
    const locale = $i18n?.locale?.value || 'fr'

    // Construct full URL if needed
    const fullUrl = url.startsWith('http')
      ? url
      : `${options.baseURL || config.public.apiUrl}${url}`

    console.log('[useApi] options received:', options)
    console.log('[useApi] method:', options.method)

    const fetchOptions = {
      ...options,
      headers: {
        'Accept-Language': locale,
        ...options.headers
      }
    } as NitroFetchOptions<NitroFetchRequest>

    console.log('[useApi] fetchOptions:', fetchOptions)

    const result = await $fetch(fullUrl, fetchOptions)

    return result as T
  }

  return apiFetch
}

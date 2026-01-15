import type {
  ResellerProfile,
  ResellerStats,
  CreditsResponse,
  TransactionsFilters,
} from '~/types/reseller'
import { getErrorMessage } from '~/utils/errors'

/**
 * Reseller Profile composable
 * Provides access to current reseller's profile and credits (Reseller Admin only)
 */
export function useResellerProfile() {
  const { authenticatedFetch } = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch the current reseller's profile
   */
  async function fetchProfile(): Promise<ResellerProfile | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<ResellerProfile>('/reseller/profile')
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch profile')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch credits and transaction history for the current reseller
   */
  async function fetchCredits(
    filters: TransactionsFilters = {}
  ): Promise<CreditsResponse | null> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.type) params.set('type', filters.type)

      const query = params.toString()
      return await authenticatedFetch<CreditsResponse>(
        `/reseller/credits${query ? `?${query}` : ''}`
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch credits')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch dashboard stats for the reseller
   * This is a computed view combining profile data with organization stats
   */
  async function fetchStats(): Promise<ResellerStats | null> {
    loading.value = true
    error.value = null
    try {
      // Fetch profile and credits in parallel
      const [profile, creditsData] = await Promise.all([
        authenticatedFetch<ResellerProfile>('/reseller/profile'),
        authenticatedFetch<CreditsResponse>('/reseller/credits?limit=5'),
      ])

      // Calculate stats from the data
      // Note: The backend could provide a dedicated /reseller/stats endpoint
      // For now, we compute it from available data
      const recentTransactions = creditsData?.transactions?.data || []

      // Calculate distributed credits (negative amounts = distributions)
      const totalDistributed = recentTransactions
        .filter((t) => t.type === 'distribution')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)

      return {
        creditBalance: profile?.creditBalance || 0,
        organizationsCount: 0, // Will be populated from organizations list
        totalDistributedCredits: totalDistributed,
        totalConsumedCredits: 0, // Would need organization-level data
        recentOrganizations: [],
        recentTransactions,
      }
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch stats')
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,

    // Methods
    fetchProfile,
    fetchCredits,
    fetchStats,
  }
}

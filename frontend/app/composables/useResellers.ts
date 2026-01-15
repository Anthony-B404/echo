import type {
  Reseller,
  AdminStats,
  ResellersListResponse,
  TransactionsListResponse,
  CreateResellerPayload,
  CreateResellerResponse,
  UpdateResellerPayload,
  UpdateResellerResponse,
  AddCreditsPayload,
  AddCreditsResponse,
  ResellersFilters,
  TransactionsFilters,
} from '~/types/admin'
import { getErrorMessage } from '~/utils/errors'

/**
 * Resellers composable
 * Provides CRUD operations for managing resellers (Super Admin only)
 */
export function useResellers() {
  const { authenticatedFetch } = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch admin dashboard stats
   */
  async function fetchStats(): Promise<AdminStats | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<AdminStats>('/admin/stats')
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch stats')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch resellers list with pagination and filters
   */
  async function fetchResellers(
    filters: ResellersFilters = {}
  ): Promise<ResellersListResponse | null> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.search) params.set('search', filters.search)
      if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

      const query = params.toString()
      return await authenticatedFetch<ResellersListResponse>(
        `/admin/resellers${query ? `?${query}` : ''}`
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch resellers')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single reseller by ID
   */
  async function fetchReseller(id: number): Promise<Reseller | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<Reseller>(`/admin/resellers/${id}`)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch reseller')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new reseller
   */
  async function createReseller(
    payload: CreateResellerPayload
  ): Promise<CreateResellerResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<CreateResellerResponse>('/admin/resellers', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to create reseller')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing reseller
   */
  async function updateReseller(
    id: number,
    payload: UpdateResellerPayload
  ): Promise<UpdateResellerResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<UpdateResellerResponse>(`/admin/resellers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update reseller')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Deactivate a reseller (soft delete)
   */
  async function deactivateReseller(id: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await authenticatedFetch(`/admin/resellers/${id}`, { method: 'DELETE' })
      return true
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to deactivate reseller')
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Add credits to a reseller's pool
   */
  async function addCredits(
    resellerId: number,
    payload: AddCreditsPayload
  ): Promise<AddCreditsResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<AddCreditsResponse>(
        `/admin/resellers/${resellerId}/credits`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to add credits')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove credits from a reseller's pool
   */
  async function removeCredits(
    resellerId: number,
    payload: AddCreditsPayload
  ): Promise<AddCreditsResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<AddCreditsResponse>(
        `/admin/resellers/${resellerId}/credits/remove`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to remove credits')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch transaction history for a reseller
   */
  async function fetchTransactions(
    resellerId: number,
    filters: TransactionsFilters = {}
  ): Promise<TransactionsListResponse | null> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.type) params.set('type', filters.type)

      const query = params.toString()
      return await authenticatedFetch<TransactionsListResponse>(
        `/admin/resellers/${resellerId}/transactions${query ? `?${query}` : ''}`
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch transactions')
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
    fetchStats,
    fetchResellers,
    fetchReseller,
    createReseller,
    updateReseller,
    deactivateReseller,
    addCredits,
    removeCredits,
    fetchTransactions,
  }
}

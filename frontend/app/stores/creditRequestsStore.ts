import { defineStore } from 'pinia'
import type {
  CreditRequest,
  CreditRequestsResponse,
  CreateCreditRequestPayload,
  RejectCreditRequestPayload,
  CreateCreditRequestResponse,
  ProcessCreditRequestResponse,
  PendingCountResponse,
} from '~/types/creditRequest'
import type { ApiError } from '~/types'

export const useCreditRequestsStore = defineStore('creditRequests', () => {
  const { authenticatedFetch } = useAuth()

  // State
  const myRequests = ref<CreditRequest[]>([])
  const pendingRequests = ref<CreditRequest[]>([])
  const pendingCount = ref<number>(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Reseller state
  const resellerPendingRequests = ref<CreditRequest[]>([])
  const resellerPendingCount = ref<number>(0)

  // Pagination state
  const myRequestsMeta = ref<{
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  } | null>(null)

  // Computed
  const hasPendingRequests = computed(() => pendingCount.value > 0)
  const hasResellerPendingRequests = computed(() => resellerPendingCount.value > 0)

  /**
   * Fetch current user's credit requests
   */
  async function fetchMyRequests(
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<CreditRequestsResponse | null> {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (status && status !== 'all') {
        params.set('status', status)
      }

      const response = (await authenticatedFetch(
        `/credit-requests?${params}`,
      )) as CreditRequestsResponse

      myRequests.value = response.data
      myRequestsMeta.value = response.meta
      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to fetch credit requests'
      console.error('Error fetching credit requests:', e)
      return null
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Fetch pending requests for owner to review
   */
  async function fetchPendingRequests(): Promise<CreditRequest[] | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch('/credit-requests/pending')) as {
        data: CreditRequest[]
      }
      pendingRequests.value = response.data
      pendingCount.value = response.data.length
      return response.data
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to fetch pending requests'
      console.error('Error fetching pending requests:', e)
      return null
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Fetch pending request count for badge
   */
  async function fetchPendingCount(): Promise<number> {
    try {
      const response = (await authenticatedFetch(
        '/credit-requests/pending-count',
      )) as PendingCountResponse
      pendingCount.value = response.count
      return response.count
    }
    catch (e: unknown) {
      console.error('Error fetching pending count:', e)
      return 0
    }
  }

  /**
   * Create a credit request (member to owner)
   */
  async function createRequest(
    payload: CreateCreditRequestPayload,
  ): Promise<CreateCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch('/credit-requests', {
        method: 'POST',
        body: payload,
      })) as CreateCreditRequestResponse

      // Add to myRequests at the beginning
      myRequests.value.unshift(response.request)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to create credit request'
      console.error('Error creating credit request:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Create a credit request from owner to reseller
   */
  async function createRequestToReseller(
    payload: CreateCreditRequestPayload,
  ): Promise<CreateCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch('/credit-requests/to-reseller', {
        method: 'POST',
        body: payload,
      })) as CreateCreditRequestResponse

      // Add to myRequests at the beginning
      myRequests.value.unshift(response.request)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to create credit request'
      console.error('Error creating credit request to reseller:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Approve a credit request (owner only)
   */
  async function approveRequest(
    requestId: number,
  ): Promise<ProcessCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(`/credit-requests/${requestId}/approve`, {
        method: 'POST',
      })) as ProcessCreditRequestResponse

      // Remove from pending requests
      pendingRequests.value = pendingRequests.value.filter((r) => r.id !== requestId)
      pendingCount.value = Math.max(0, pendingCount.value - 1)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to approve credit request'
      console.error('Error approving credit request:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Reject a credit request (owner only)
   */
  async function rejectRequest(
    requestId: number,
    payload?: RejectCreditRequestPayload,
  ): Promise<ProcessCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(`/credit-requests/${requestId}/reject`, {
        method: 'POST',
        body: payload || {},
      })) as ProcessCreditRequestResponse

      // Remove from pending requests
      pendingRequests.value = pendingRequests.value.filter((r) => r.id !== requestId)
      pendingCount.value = Math.max(0, pendingCount.value - 1)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to reject credit request'
      console.error('Error rejecting credit request:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  // ========================================
  // Reseller methods
  // ========================================

  /**
   * Fetch pending requests for reseller to review (owner_to_reseller type)
   */
  async function fetchResellerPendingRequests(): Promise<CreditRequest[] | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch('/reseller/credit-requests/pending')) as {
        data: CreditRequest[]
      }
      resellerPendingRequests.value = response.data
      resellerPendingCount.value = response.data.length
      return response.data
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to fetch reseller pending requests'
      console.error('Error fetching reseller pending requests:', e)
      return null
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Fetch reseller pending request count for badge
   */
  async function fetchResellerPendingCount(): Promise<number> {
    try {
      const response = (await authenticatedFetch(
        '/reseller/credit-requests/pending-count',
      )) as PendingCountResponse
      resellerPendingCount.value = response.count
      return response.count
    }
    catch (e: unknown) {
      console.error('Error fetching reseller pending count:', e)
      return 0
    }
  }

  /**
   * Approve a credit request (reseller only)
   */
  async function approveResellerRequest(
    requestId: number,
  ): Promise<ProcessCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(`/reseller/credit-requests/${requestId}/approve`, {
        method: 'POST',
      })) as ProcessCreditRequestResponse

      // Remove from reseller pending requests
      resellerPendingRequests.value = resellerPendingRequests.value.filter((r) => r.id !== requestId)
      resellerPendingCount.value = Math.max(0, resellerPendingCount.value - 1)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to approve credit request'
      console.error('Error approving reseller credit request:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Reject a credit request (reseller only)
   */
  async function rejectResellerRequest(
    requestId: number,
    payload?: RejectCreditRequestPayload,
  ): Promise<ProcessCreditRequestResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(`/reseller/credit-requests/${requestId}/reject`, {
        method: 'POST',
        body: payload || {},
      })) as ProcessCreditRequestResponse

      // Remove from reseller pending requests
      resellerPendingRequests.value = resellerPendingRequests.value.filter((r) => r.id !== requestId)
      resellerPendingCount.value = Math.max(0, resellerPendingCount.value - 1)

      return response
    }
    catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.message || 'Failed to reject credit request'
      console.error('Error rejecting reseller credit request:', e)
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset() {
    myRequests.value = []
    pendingRequests.value = []
    pendingCount.value = 0
    resellerPendingRequests.value = []
    resellerPendingCount.value = 0
    error.value = null
    myRequestsMeta.value = null
  }

  return {
    // State
    myRequests,
    pendingRequests,
    pendingCount,
    loading,
    error,
    myRequestsMeta,

    // Reseller state
    resellerPendingRequests,
    resellerPendingCount,

    // Computed
    hasPendingRequests,
    hasResellerPendingRequests,

    // Actions
    fetchMyRequests,
    fetchPendingRequests,
    fetchPendingCount,
    createRequest,
    createRequestToReseller,
    approveRequest,
    rejectRequest,

    // Reseller actions
    fetchResellerPendingRequests,
    fetchResellerPendingCount,
    approveResellerRequest,
    rejectResellerRequest,

    reset,
  }
})

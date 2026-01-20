import type {
  ResellerOrganization,
  OrganizationUser,
  OrganizationsListResponse,
  UsersListResponse,
  CreateOrganizationPayload,
  CreateOrganizationResponse,
  UpdateOrganizationPayload,
  UpdateOrganizationResponse,
  DistributeCreditsPayload,
  DistributeCreditsResponse,
  AddUserPayload,
  AddUserResponse,
  OrganizationsFilters,
  UsersFilters,
  SuspendOrganizationPayload,
  OrganizationStatusResponse,
} from '~/types/reseller'
import { getErrorMessage } from '~/utils/errors'

/**
 * Reseller Organizations composable
 * Provides CRUD operations for managing organizations (Reseller Admin only)
 */
export function useResellerOrganizations() {
  const { authenticatedFetch } = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)

  // ==========================================================================
  // ORGANIZATIONS CRUD
  // ==========================================================================

  /**
   * Fetch organizations list with pagination and filters
   */
  async function fetchOrganizations(
    filters: OrganizationsFilters = {}
  ): Promise<OrganizationsListResponse | null> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.search) params.set('search', filters.search)
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

      const query = params.toString()
      return await authenticatedFetch<OrganizationsListResponse>(
        `/reseller/organizations${query ? `?${query}` : ''}`
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch organizations')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single organization by ID with users
   */
  async function fetchOrganization(id: number): Promise<ResellerOrganization | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<ResellerOrganization>(`/reseller/organizations/${id}`)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch organization')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new organization with owner user
   */
  async function createOrganization(
    payload: CreateOrganizationPayload
  ): Promise<CreateOrganizationResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<CreateOrganizationResponse>(
        '/reseller/organizations',
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to create organization')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing organization
   */
  async function updateOrganization(
    id: number,
    payload: UpdateOrganizationPayload
  ): Promise<UpdateOrganizationResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<UpdateOrganizationResponse>(
        `/reseller/organizations/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update organization')
      throw e
    } finally {
      loading.value = false
    }
  }

  // ==========================================================================
  // CREDITS DISTRIBUTION
  // ==========================================================================

  /**
   * Distribute credits from reseller pool to an organization
   */
  async function distributeCredits(
    organizationId: number,
    payload: DistributeCreditsPayload
  ): Promise<DistributeCreditsResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<DistributeCreditsResponse>(
        `/reseller/organizations/${organizationId}/credits`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to distribute credits')
      throw e
    } finally {
      loading.value = false
    }
  }

  // ==========================================================================
  // USERS MANAGEMENT
  // ==========================================================================

  /**
   * Fetch users list for an organization
   */
  async function fetchUsers(
    organizationId: number,
    filters: UsersFilters = {}
  ): Promise<UsersListResponse | null> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))

      const query = params.toString()
      return await authenticatedFetch<UsersListResponse>(
        `/reseller/organizations/${organizationId}/users${query ? `?${query}` : ''}`
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to fetch users')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a user to an organization (create new or link existing)
   */
  async function addUser(
    organizationId: number,
    payload: AddUserPayload
  ): Promise<AddUserResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<AddUserResponse>(
        `/reseller/organizations/${organizationId}/users`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to add user')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove a user from an organization
   */
  async function removeUser(organizationId: number, userId: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await authenticatedFetch(`/reseller/organizations/${organizationId}/users/${userId}`, {
        method: 'DELETE',
      })
      return true
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to remove user')
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Resend invitation to a pending user
   */
  async function resendInvitation(
    organizationId: number,
    userId: number
  ): Promise<{ message: string; lastInvitationSentAt: string } | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<{ message: string; lastInvitationSentAt: string }>(
        `/reseller/organizations/${organizationId}/users/${userId}/resend-invitation`,
        {
          method: 'POST',
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to resend invitation')
      throw e
    } finally {
      loading.value = false
    }
  }

  // ==========================================================================
  // ORGANIZATION STATUS MANAGEMENT
  // ==========================================================================

  /**
   * Suspend an organization
   */
  async function suspendOrganization(
    organizationId: number,
    payload?: SuspendOrganizationPayload
  ): Promise<OrganizationStatusResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<OrganizationStatusResponse>(
        `/reseller/organizations/${organizationId}/suspend`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(payload) : undefined,
          headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to suspend organization')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Restore a suspended organization
   */
  async function restoreOrganization(
    organizationId: number
  ): Promise<OrganizationStatusResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<OrganizationStatusResponse>(
        `/reseller/organizations/${organizationId}/restore`,
        {
          method: 'POST',
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to restore organization')
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete an organization (soft delete with 30-day purge)
   */
  async function deleteOrganization(
    organizationId: number
  ): Promise<OrganizationStatusResponse | null> {
    loading.value = true
    error.value = null
    try {
      return await authenticatedFetch<OrganizationStatusResponse>(
        `/reseller/organizations/${organizationId}`,
        {
          method: 'DELETE',
        }
      )
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to delete organization')
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,

    // Organizations
    fetchOrganizations,
    fetchOrganization,
    createOrganization,
    updateOrganization,

    // Organization Status
    suspendOrganization,
    restoreOrganization,
    deleteOrganization,

    // Credits
    distributeCredits,

    // Users
    fetchUsers,
    addUser,
    removeUser,
    resendInvitation,
  }
}

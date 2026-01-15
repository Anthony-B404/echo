import type { PaginationMeta } from './admin'

/**
 * Types for the Reseller Frontend (Phase 6)
 * These types are used by reseller admins to manage their organizations and users
 */

// =============================================================================
// ROLE CONSTANTS
// =============================================================================

/**
 * User role constants to avoid magic numbers throughout the codebase
 */
export const USER_ROLES = {
  OWNER: 1,
  ADMINISTRATOR: 2,
  MEMBER: 3,
} as const

export type UserRoleValue = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

export interface ResellerOrganization {
  id: number
  name: string
  email: string
  logo: string | null
  credits: number
  resellerId: number
  createdAt: string
  updatedAt: string
  usersCount?: number
  users?: OrganizationUser[]
}

export interface OrganizationUser {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  role: 1 | 2 | 3 // Owner = 1, Administrator = 2, Member = 3
  createdAt: string
  onboardingCompleted: boolean
}

// =============================================================================
// RESELLER PROFILE TYPES
// =============================================================================

export interface ResellerProfile {
  id: number
  name: string
  email: string
  phone: string | null
  company: string
  siret: string | null
  address: string | null
  creditBalance: number
  isActive: boolean
  createdAt: string
}

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

export type ResellerTransactionType = 'purchase' | 'distribution' | 'adjustment'

export interface ResellerTransaction {
  id: number
  resellerId: number
  amount: number
  type: ResellerTransactionType
  targetOrganizationId: number | null
  description: string | null
  performedByUserId: number
  createdAt: string
  targetOrganization?: {
    id: number
    name: string
  }
  performedBy?: {
    id: number
    email: string
    firstName: string | null
    lastName: string | null
  }
}

// =============================================================================
// PAYLOAD TYPES (for API requests)
// =============================================================================

export interface CreateOrganizationPayload {
  name: string
  email: string
  ownerEmail: string
  ownerFirstName: string
  ownerLastName: string
  initialCredits?: number
}

export interface UpdateOrganizationPayload {
  name?: string
  email?: string
}

export interface DistributeCreditsPayload {
  amount: number
  description?: string
}

export interface AddUserPayload {
  email: string
  firstName: string
  lastName: string
  role: 2 | 3 // Only Administrator or Member can be assigned via API
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface OrganizationsFilters {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'name' | 'credits' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface UsersFilters {
  page?: number
  limit?: number
}

export interface TransactionsFilters {
  page?: number
  limit?: number
  type?: ResellerTransactionType
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface OrganizationsListResponse {
  data: ResellerOrganization[]
  meta: PaginationMeta
}

export interface UsersListResponse {
  data: OrganizationUser[]
  meta: PaginationMeta
}

export interface CreditsResponse {
  creditBalance: number
  transactions: {
    data: ResellerTransaction[]
    meta: PaginationMeta
  }
}

export interface CreateOrganizationResponse {
  message: string
  organization: ResellerOrganization
}

export interface UpdateOrganizationResponse {
  message: string
  organization: ResellerOrganization
}

export interface DistributeCreditsResponse {
  message: string
  resellerBalance: number
  organizationCredits: number
}

export interface AddUserResponse {
  message: string
  user: OrganizationUser
}

// =============================================================================
// STATS TYPES (for dashboard)
// =============================================================================

export interface ResellerStats {
  creditBalance: number
  organizationsCount: number
  totalDistributedCredits: number
  totalConsumedCredits: number
  recentOrganizations: Pick<
    ResellerOrganization,
    'id' | 'name' | 'credits' | 'createdAt'
  >[]
  recentTransactions: ResellerTransaction[]
}

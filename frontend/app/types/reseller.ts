import type { PaginationMeta } from './admin'

/**
 * Types for the Reseller Frontend (Phase 6)
 * These types are used by reseller admins to manage their organizations and users
 */

// =============================================================================
// ORGANIZATION STATUS
// =============================================================================

export type OrganizationStatus = 'active' | 'suspended' | 'deleted'

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

export type RenewalType = 'first_of_month' | 'anniversary'

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
  // Status fields
  status: OrganizationStatus
  suspendedAt: string | null
  suspensionReason: string | null
  deletedAt: string | null
  // Subscription fields
  subscriptionEnabled?: boolean
  monthlyCreditsTarget?: number | null
  renewalType?: RenewalType | null
  renewalDay?: number | null
  subscriptionCreatedAt?: string | null
  subscriptionPausedAt?: string | null
  lastRenewalAt?: string | null
  nextRenewalAt?: string | null
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
  lastInvitationSentAt: string | null
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

export type ResellerTransactionType = 'purchase' | 'distribution' | 'adjustment' | 'subscription_renewal'

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
  // Subscription configuration (optional)
  subscriptionEnabled?: boolean
  monthlyCreditsTarget?: number
  renewalType?: RenewalType
  renewalDay?: number
}

export interface UpdateOrganizationPayload {
  name?: string
  email?: string
}

export interface DistributeCreditsPayload {
  amount: number
  description?: string
}

export interface SuspendOrganizationPayload {
  reason?: string
}

export interface OrganizationStatusResponse {
  message: string
  organization: ResellerOrganization
  daysUntilPurge?: number // For delete response only
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

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

export interface SubscriptionStatus {
  subscriptionEnabled: boolean
  monthlyCreditsTarget: number | null
  renewalType: RenewalType | null
  renewalDay: number | null
  subscriptionCreatedAt: string | null
  subscriptionPausedAt: string | null
  lastRenewalAt: string | null
  nextRenewalAt: string | null
  isActive: boolean
  creditsNeededForRenewal: number
  currentCredits: number
}

export interface ConfigureSubscriptionPayload {
  enabled: boolean
  monthlyCreditsTarget?: number | null
  renewalType?: RenewalType | null
  renewalDay?: number | null
}

export interface SubscriptionResponse {
  message: string
  subscription: SubscriptionStatus
}

export interface UpcomingRenewal {
  id: number
  name: string
  nextRenewalAt: string | null
  currentCredits: number
  monthlyCreditsTarget: number | null
  creditsNeeded: number
}

export interface UpcomingRenewalsSummary {
  count: number
  totalCreditsNeeded: number
  resellerBalance: number
  hasSufficientCredits: boolean
  shortfall: number
}

export interface UpcomingRenewalsResponse {
  renewals: UpcomingRenewal[]
  summary: UpcomingRenewalsSummary
}

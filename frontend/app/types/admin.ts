/**
 * Admin/Reseller system types
 */

export enum ResellerTransactionType {
  Purchase = 'purchase',
  Distribution = 'distribution',
  Adjustment = 'adjustment',
}

export interface Reseller {
  id: number
  name: string
  email: string
  phone: string | null
  company: string
  siret: string | null
  address: string | null
  creditBalance: number
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string | null
  // Aggregated counts
  organizationsCount?: number
  adminUsersCount?: number
  // Preloaded relations (detail view)
  organizations?: ResellerOrganization[]
  adminUsers?: ResellerAdminUser[]
}

export interface ResellerOrganization {
  id: number
  name: string
  email: string
  credits: number
  createdAt: string
}

export interface ResellerAdminUser {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  createdAt: string
}

export interface ResellerTransaction {
  id: number
  resellerId: number
  amount: number
  type: ResellerTransactionType
  targetOrganizationId: number | null
  description: string | null
  performedByUserId: number
  createdAt: string
  // Preloaded relations
  performedBy?: {
    id: number
    email: string
    firstName: string | null
    lastName: string | null
  }
  targetOrganization?: {
    id: number
    name: string
  }
  reseller?: {
    id: number
    name: string
    company: string
  }
}

// API Response types
export interface AdminStats {
  resellers: {
    total: number
    active: number
  }
  organizations: {
    managedByResellers: number
  }
  credits: {
    totalInPools: number
    distributedThisMonth: number
    purchasedThisMonth: number
  }
  topResellers: Pick<Reseller, 'id' | 'name' | 'company' | 'creditBalance'>[]
  recentTransactions: ResellerTransaction[]
}

export interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

export interface ResellersListResponse {
  meta: PaginationMeta
  data: Reseller[]
}

export interface TransactionsListResponse {
  reseller: Pick<Reseller, 'id' | 'name' | 'creditBalance'>
  transactions: {
    meta: PaginationMeta
    data: ResellerTransaction[]
  }
}

export interface CreateResellerResponse {
  message: string
  reseller: Reseller
}

export interface UpdateResellerResponse {
  message: string
  reseller: Reseller
}

export interface AddCreditsResponse {
  message: string
  transaction: ResellerTransaction
  newBalance: number
}

// Form payloads
export interface CreateResellerPayload {
  name: string
  email: string
  phone?: string
  company: string
  siret?: string
  address?: string
  notes?: string
  initialCredits?: number
}

export interface UpdateResellerPayload {
  name?: string
  email?: string
  phone?: string | null
  company?: string
  siret?: string | null
  address?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface AddCreditsPayload {
  amount: number
  description?: string
}

// Filter types
export interface ResellersFilters {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
  sortBy?: 'name' | 'company' | 'creditBalance' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface TransactionsFilters {
  page?: number
  limit?: number
  type?: ResellerTransactionType
}

/**
 * VineJS validation error structure
 */
export interface ValidationError {
  field: string
  rule: string
  message: string
}

/**
 * API Error response shape
 */
export interface ApiErrorResponse {
  message?: string
  errors?: ValidationError[]
  code?: string
}

/**
 * Fetch error with data property
 */
export interface FetchError {
  data?: ApiErrorResponse
  status?: number
  statusText?: string
}

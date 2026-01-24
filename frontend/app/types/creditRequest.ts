export type CreditRequestType = 'member_to_owner' | 'owner_to_reseller'
export type CreditRequestStatus = 'pending' | 'approved' | 'rejected'

export interface CreditRequest {
  id: number
  type: CreditRequestType
  requesterId: number
  organizationId: number
  resellerId: number | null
  amount: number
  justification: string | null
  status: CreditRequestStatus
  processedByUserId: number | null
  rejectionReason: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string | null
  requester?: {
    id: number
    fullName: string | null
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
  }
  organization?: {
    id: number
    name: string
  }
  processedBy?: {
    id: number
    fullName: string | null
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

export interface CreditRequestsResponse {
  data: CreditRequest[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

export interface CreateCreditRequestPayload {
  amount: number
  justification?: string
}

export interface RejectCreditRequestPayload {
  reason?: string
}

export interface CreateCreditRequestResponse {
  message: string
  request: CreditRequest
}

export interface ProcessCreditRequestResponse {
  message: string
  request: CreditRequest
  creditsDistributed?: number
}

export interface PendingCountResponse {
  count: number
}

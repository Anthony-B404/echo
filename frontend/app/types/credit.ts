export interface CreditTransaction {
    id: number
    userId: number | null
    amount: number
    balanceAfter: number
    type: 'usage' | 'purchase' | 'bonus' | 'refund'
    description: string | null
    audioId: number | null
    createdAt: string
    audio?: {
        id: number
        title: string
        fileName: string
    }
    user?: {
        id: number
        fullName: string | null
        firstName: string | null
        lastName: string | null
        email: string
    }
}

export interface CreditsBalanceResponse {
    credits: number
}

export interface CreditsHistoryResponse {
    data: CreditTransaction[]
    meta: {
        total: number
        perPage: number
        currentPage: number
        lastPage: number
    }
}

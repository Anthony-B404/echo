export interface User {
  id: number
  fullName: string | null
  email: string
  role: number
  isOwner: boolean
  isCurrentUser?: boolean
}

export interface Invitation {
  id: number
  email: string
}

export interface Organization {
  id: number
  name: string
  logo: string | null
  email: string
  users?: User[]
  invitations?: Invitation[]
}

export interface OrganizationState {
  organization: Organization | null
  loading: boolean
  error: string | null
}

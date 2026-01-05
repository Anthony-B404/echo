import type { UserRole } from './auth'

export interface User {
  id: number
  fullName: string | null
  email: string
  role: UserRole
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

export interface UserOrganization {
  id: number
  name: string
  email: string
  logo: string | null
  role: UserRole
  isOwner: boolean
  isCurrent: boolean
}

export interface OrganizationState {
  organization: Organization | null
  organizations: UserOrganization[]
  loading: boolean
  error: string | null
}

import type { AvatarProps } from "@nuxt/ui";
import type { UserRole } from './auth'

export type UserStatus = "subscribed" | "unsubscribed" | "bounced";
export type SaleStatus = "paid" | "failed" | "refunded";

// API error response type for catch blocks
export interface ApiError {
  data?: {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
  };
  message?: string;
  statusCode?: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: AvatarProps;
  status: UserStatus;
  location: string;
}

export interface Mail {
  id: number;
  unread?: boolean;
  from: User;
  subject: string;
  body: string;
  date: string;
}

export interface Member {
  id: number;
  fullName: string | null;
  email: string;
  role: UserRole;
  avatar: string | null;
  isCurrentUser: boolean;
}

export interface Invitation {
  id: number;
  identifier: string;
  email: string;
  organizationId: number;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stat {
  title: string;
  icon: string;
  value: number | string;
  variation: number;
  formatter?: (value: number) => string;
}

export interface Sale {
  id: string;
  date: string;
  status: SaleStatus;
  email: string;
  amount: number;
}

// Legacy notification interface (for reference)
export interface LegacyNotification {
  id: number;
  unread?: boolean;
  sender: User;
  body: string;
  date: string;
}

// Notification types matching backend enum
export type NotificationType =
  | 'credit_request'
  | 'owner_credit_request'
  | 'low_credits'
  | 'insufficient_refill'
  | 'reseller_distribution'
  | 'credits_received';

// Notification data stored in JSON field
export interface NotificationData {
  organizationId?: number;
  organizationName?: string;
  requestId?: number;
  requesterId?: number;
  requesterName?: string;
  amount?: number;
  justification?: string;
  balance?: number;
  threshold?: number;
  link?: string;
}

// Main notification interface matching backend model
export interface Notification {
  id: number;
  userId: number;
  organizationId: number;
  type: NotificationType;
  title: string;
  message: string | null;
  data: NotificationData | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export type Period = "daily" | "weekly" | "monthly";

export interface Range {
  start: Date;
  end: Date;
}

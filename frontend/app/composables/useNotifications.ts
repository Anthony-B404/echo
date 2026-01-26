import { createSharedComposable, useIntervalFn } from '@vueuse/core'
import type { Notification, NotificationType } from '~/types'

export interface NotificationPaginationResult {
  notifications: Notification[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

interface ApiError {
  data?: { message?: string }
  message?: string
}

const _useNotifications = () => {
  const { authenticatedFetch } = useAuth()
  const localePath = useLocalePath()
  const config = useRuntimeConfig()

  // State
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const isLoading = ref(false)
  const hasMore = ref(false)
  const currentPage = ref(1)
  const total = ref(0)
  const error = ref<string | null>(null)

  // Computed
  const hasError = computed(() => error.value !== null)

  // Polling interval (configurable via runtime config, default 60 seconds)
  const POLLING_INTERVAL = (config.public.notificationPollingInterval as number) || 60 * 1000

  /**
   * Fetch unread count from API
   */
  async function fetchUnreadCount(): Promise<void> {
    try {
      const response = await authenticatedFetch<{ count: number }>(
        '/notifications/unread-count'
      )
      unreadCount.value = response.count
    } catch {
      // Silent fail - polling will retry
    }
  }

  /**
   * Fetch notifications from API
   */
  async function fetchNotifications(
    page: number = 1,
    limit: number = 20
  ): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const response = await authenticatedFetch<NotificationPaginationResult>(
        `/notifications?page=${page}&limit=${limit}`
      )
      if (page === 1) {
        notifications.value = response.notifications
      } else {
        notifications.value = [...notifications.value, ...response.notifications]
      }
      currentPage.value = response.pagination.page
      total.value = response.pagination.total
      hasMore.value = response.pagination.hasMore
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError?.data?.message || apiError?.message || 'Failed to fetch notifications'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load more notifications
   */
  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    await fetchNotifications(currentPage.value + 1)
  }

  /**
   * Mark a notification as read
   */
  async function markAsRead(notificationId: number): Promise<void> {
    try {
      await authenticatedFetch(`/notifications/${notificationId}/read`, {
        method: 'POST',
      })
      // Update local state
      const notification = notifications.value.find((n) => n.id === notificationId)
      if (notification && !notification.isRead) {
        notification.isRead = true
        notification.readAt = new Date().toISOString()
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch {
      // Silent fail - state will sync on next fetch
    }
  }

  /**
   * Mark all notifications as read
   */
  async function markAllAsRead(): Promise<void> {
    try {
      await authenticatedFetch('/notifications/read-all', {
        method: 'POST',
      })
      // Update local state
      notifications.value.forEach((n) => {
        n.isRead = true
        n.readAt = new Date().toISOString()
      })
      unreadCount.value = 0
    } catch {
      // Silent fail - state will sync on next fetch
    }
  }

  /**
   * Get icon for notification type
   */
  function getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      credit_request: 'i-heroicons-banknotes',
      owner_credit_request: 'i-heroicons-building-office',
      low_credits: 'i-heroicons-exclamation-triangle',
      insufficient_refill: 'i-heroicons-arrow-path',
      reseller_distribution: 'i-heroicons-gift',
      credits_received: 'i-heroicons-plus-circle',
    }
    return icons[type] || 'i-heroicons-bell'
  }

  /**
   * Get icon color for notification type
   */
  function getNotificationColor(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      credit_request: 'text-blue-500',
      owner_credit_request: 'text-purple-500',
      low_credits: 'text-amber-500',
      insufficient_refill: 'text-orange-500',
      reseller_distribution: 'text-green-500',
      credits_received: 'text-green-500',
    }
    return colors[type] || 'text-gray-500'
  }

  /**
   * Get navigation link for notification
   */
  function getNotificationLink(notification: Notification): string | null {
    // If notification has a specific link in data, use it
    if (notification.data?.link) {
      return localePath(notification.data.link)
    }

    // Default navigation based on type
    const links: Record<NotificationType, string> = {
      credit_request: '/dashboard/credits?tab=pendingRequests',
      owner_credit_request: '/reseller/credits?tab=requests',
      low_credits: '/dashboard/credits',
      insufficient_refill: '/dashboard/credits',
      reseller_distribution: '/dashboard/credits',
      credits_received: '/dashboard/credits?tab=myRequests',
    }
    return localePath(links[notification.type] || '/dashboard')
  }

  /**
   * Refresh notifications and count
   */
  async function refresh(): Promise<void> {
    await Promise.all([fetchUnreadCount(), fetchNotifications(1)])
  }

  // Start polling for unread count when composable is used
  const { pause, resume, isActive } = useIntervalFn(
    fetchUnreadCount,
    POLLING_INTERVAL,
    { immediate: false, immediateCallback: false }
  )

  // Start polling when mounted and authenticated
  onMounted(async () => {
    const authStore = useAuthStore()
    if (authStore.isAuthenticated) {
      await fetchUnreadCount()
      resume()
    }
  })

  // Stop polling when unmounted
  onUnmounted(() => {
    pause()
  })

  // Watch for auth changes to start/stop polling
  const authStore = useAuthStore()
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) {
        fetchUnreadCount()
        resume()
      } else {
        pause()
        notifications.value = []
        unreadCount.value = 0
      }
    }
  )

  return {
    // State
    notifications: readonly(notifications),
    unreadCount: readonly(unreadCount),
    isLoading: readonly(isLoading),
    hasMore: readonly(hasMore),
    total: readonly(total),
    error: readonly(error),
    hasError: readonly(hasError),
    isPolling: isActive,

    // Actions
    fetchUnreadCount,
    fetchNotifications,
    loadMore,
    markAsRead,
    markAllAsRead,
    refresh,

    // Helpers
    getNotificationIcon,
    getNotificationColor,
    getNotificationLink,

    // Polling control
    pausePolling: pause,
    resumePolling: resume,
  }
}

export const useNotifications = createSharedComposable(_useNotifications)

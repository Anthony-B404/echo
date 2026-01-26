<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'

const { t } = useI18n()
const { isNotificationsSlideoverOpen } = useDashboard()
const router = useRouter()

const {
  notifications,
  unreadCount,
  isLoading,
  hasMore,
  error,
  hasError,
  fetchNotifications,
  loadMore,
  markAsRead,
  markAllAsRead,
  refresh,
  getNotificationIcon,
  getNotificationColor,
  getNotificationLink,
} = useNotifications()

// Fetch notifications when slideover opens
watch(isNotificationsSlideoverOpen, async (isOpen) => {
  if (isOpen) {
    await fetchNotifications()
  }
}, { immediate: true })

// Handle notification click
async function handleNotificationClick(notification: typeof notifications.value[0]) {
  // Mark as read if not already
  if (!notification.isRead) {
    await markAsRead(notification.id)
  }

  // Navigate to the appropriate page
  const link = getNotificationLink(notification)
  if (link) {
    isNotificationsSlideoverOpen.value = false
    router.push(link)
  }
}

// Handle mark all as read
async function handleMarkAllAsRead() {
  await markAllAsRead()
}
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    :title="t('components.notifications.title')"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <h2 class="text-lg font-semibold">
          {{ t('components.notifications.title') }}
        </h2>
        <UButton
          v-if="unreadCount > 0"
          variant="ghost"
          size="sm"
          @click="handleMarkAllAsRead"
        >
          {{ t('components.notifications.markAllRead') }}
        </UButton>
      </div>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="isLoading && notifications.length === 0" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
      </div>

      <!-- Error state -->
      <div
        v-else-if="hasError"
        class="flex flex-col items-center justify-center py-8"
      >
        <UAlert
          :title="t('components.notifications.errorTitle')"
          :description="error || t('components.notifications.errorDescription')"
          color="error"
          icon="i-heroicons-exclamation-triangle"
        />
        <UButton
          class="mt-4"
          variant="soft"
          icon="i-heroicons-arrow-path"
          @click="refresh"
        >
          {{ t('components.notifications.retry') }}
        </UButton>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="notifications.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon name="i-heroicons-bell-slash" class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p class="text-muted text-sm">
          {{ t('components.notifications.empty') }}
        </p>
      </div>

      <!-- Notification list -->
      <template v-else>
        <div class="space-y-1">
          <button
            v-for="notification in notifications"
            :key="notification.id"
            class="hover:bg-elevated/50 relative -mx-3 flex w-full items-start gap-3 rounded-md px-3 py-3 text-left first:-mt-3 transition-colors"
            :class="{ 'bg-primary-50/50 dark:bg-primary-900/10': !notification.isRead }"
            @click="handleNotificationClick(notification)"
          >
            <!-- Icon with unread indicator -->
            <div class="relative flex-shrink-0">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
              >
                <UIcon
                  :name="getNotificationIcon(notification.type)"
                  :class="['h-5 w-5', getNotificationColor(notification.type)]"
                />
              </div>
              <!-- Unread dot -->
              <span
                v-if="!notification.isRead"
                class="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary-500 ring-2 ring-white dark:ring-gray-900"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="text-highlighted font-medium text-sm">
                  {{ notification.title }}
                </p>
                <time
                  :datetime="notification.createdAt"
                  class="text-muted text-xs flex-shrink-0"
                  v-text="formatTimeAgo(new Date(notification.createdAt))"
                />
              </div>

              <p v-if="notification.message" class="text-dimmed text-sm mt-0.5 line-clamp-2">
                {{ notification.message }}
              </p>
            </div>
          </button>
        </div>

        <!-- Load more button -->
        <div v-if="hasMore" class="mt-4 flex justify-center">
          <UButton
            variant="ghost"
            size="sm"
            :loading="isLoading"
            @click="loadMore"
          >
            {{ t('components.notifications.loadMore') }}
          </UButton>
        </div>
      </template>
    </template>
  </USlideover>
</template>

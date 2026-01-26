<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user, logout } = useAuth()
const colorMode = useColorMode()

// Notifications
const { isNotificationsSlideoverOpen } = useDashboard()
const { unreadCount } = useNotifications()

// Sidebar collapsed state (persisted in localStorage)
const collapsed = useCookie<boolean>('reseller-sidebar-collapsed', {
  default: () => false
})

// Navigation items for the sidebar
const navigationItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('reseller.navigation.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/reseller'),
    active: route.path === localePath('/reseller')
  },
  {
    label: t('reseller.navigation.organizations'),
    icon: 'i-lucide-building-2',
    to: localePath('/reseller/organizations'),
    active: route.path.startsWith(localePath('/reseller/organizations'))
  },
  {
    label: t('reseller.navigation.credits'),
    icon: 'i-lucide-coins',
    to: localePath('/reseller/credits'),
    active: route.path === localePath('/reseller/credits')
  },
  {
    label: t('reseller.navigation.profile'),
    icon: 'i-lucide-user',
    to: localePath('/reseller/profile'),
    active: route.path === localePath('/reseller/profile')
  }
])

// User menu items for the footer dropdown
const userMenuItems = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: user.value?.email || '',
      slot: 'account',
      disabled: true
    }
  ],
  [
    {
      label: t('components.user.appearance'),
      icon: 'i-lucide-sun-moon',
      children: [
        {
          label: t('components.user.light'),
          icon: 'i-lucide-sun',
          type: 'checkbox',
          checked: colorMode.preference === 'light',
          onSelect (e: Event) {
            e.preventDefault()
            colorMode.preference = 'light'
          }
        },
        {
          label: t('components.user.dark'),
          icon: 'i-lucide-moon',
          type: 'checkbox',
          checked: colorMode.preference === 'dark',
          onSelect (e: Event) {
            e.preventDefault()
            colorMode.preference = 'dark'
          }
        },
        {
          label: t('components.user.system'),
          icon: 'i-lucide-monitor',
          type: 'checkbox',
          checked: colorMode.preference === 'system',
          onSelect (e: Event) {
            e.preventDefault()
            colorMode.preference = 'system'
          }
        }
      ]
    }
  ],
  [
    {
      label: t('common.buttons.logout'),
      icon: 'i-lucide-log-out',
      onSelect: handleLogout
    }
  ]
])

async function handleLogout () {
  await logout()
  navigateTo(localePath('/'))
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      v-model:collapsed="collapsed"
      collapsible
      resizable
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed: isCollapsed }">
        <div
          class="flex w-full items-center py-3"
          :class="isCollapsed ? 'justify-center' : 'justify-between pr-1 pl-2'"
        >
          <div class="flex items-center gap-2">
            <img src="/favicon.svg" alt="DH-Echo" class="h-8 w-8 shrink-0">
            <span
              v-if="!isCollapsed"
              class="text-lg font-semibold text-slate-800 dark:text-white"
            >
              DH-Echo
            </span>
          </div>
          <!-- Expanded: Bell + Collapse button -->
          <div v-if="!isCollapsed" class="flex items-center gap-1">
            <UButton
              icon="i-heroicons-bell"
              color="neutral"
              variant="ghost"
              size="sm"
              class="relative"
              @click="isNotificationsSlideoverOpen = true"
            >
              <span
                v-if="unreadCount > 0"
                class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white"
              >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            </UButton>
            <UDashboardSidebarCollapse />
          </div>
        </div>
      </template>

      <template #default="{ collapsed: isCollapsed }">
        <div class="flex h-full flex-col">
          <UNavigationMenu
            :collapsed="isCollapsed"
            :items="navigationItems"
            orientation="vertical"
          />
          <!-- Collapsed: Bell + Collapse button at bottom -->
          <div v-if="isCollapsed" class="mx-auto mt-auto mb-4 flex flex-col items-center gap-2">
            <UButton
              icon="i-heroicons-bell"
              color="neutral"
              variant="ghost"
              size="sm"
              class="relative"
              @click="isNotificationsSlideoverOpen = true"
            >
              <span
                v-if="unreadCount > 0"
                class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white"
              >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            </UButton>
            <UDashboardSidebarCollapse />
          </div>
        </div>
      </template>

      <template #footer="{ collapsed: isCollapsed }">
        <UDropdownMenu :items="userMenuItems">
          <UButton
            color="neutral"
            variant="ghost"
            class="w-full justify-start"
            :class="{ 'justify-center': isCollapsed }"
          >
            <UAvatar
              :src="user?.avatar || undefined"
              :alt="user?.fullName || user?.email || undefined"
              size="sm"
            />
            <span v-if="!isCollapsed" class="truncate">
              {{ user?.fullName || user?.email }}
            </span>
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <div class="mx-auto h-full w-full max-w-7xl overflow-y-auto">
        <slot />
      </div>
    </UDashboardPanel>
  </UDashboardGroup>

  <!-- Notifications Slideover -->
  <NotificationsSlideover />
</template>

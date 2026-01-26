<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { canAccessOrganization, canManageMembers } = useSettingsPermissions()
const creditsStore = useCreditsStore()
const { credits } = storeToRefs(creditsStore)
const { fetchBalance } = creditsStore


const organizationStore = useOrganizationStore()
const { organizations } = storeToRefs(organizationStore)

const { isNotificationsSlideoverOpen } = useDashboard()
const { unreadCount } = useNotifications()

const hasSingleOrganization = computed(() => organizations.value.length <= 1)

const open = ref(false)
const contactModalOpen = ref(false)

// Fetch credits and organizations on mount
onMounted(async () => {
  fetchBalance()
  // Always fetch organizations to ensure role is available for permissions
  if (organizations.value.length === 0) {
    await organizationStore.fetchUserOrganizations()
  }
})

// 1. Navigation principale (Gauche Desktop / Haut Mobile)
const mainLinks = computed<NavigationMenuItem[][]>(() => {
  return [
    [
      {
        label: t('layouts.default.navigation.workshop'),
        icon: 'i-lucide-house',
        to: localePath('/dashboard'),
        onSelect: () => {
          open.value = false
        }
      },
      {
        label: t('layouts.default.navigation.library'),
        icon: 'i-lucide-library',
        to: localePath('/dashboard/library'),
        onSelect: () => {
          open.value = false
        }
      },
      {
        label: t('layouts.default.navigation.prompts'),
        icon: 'i-lucide-bookmark',
        to: localePath('/dashboard/prompts'),
        onSelect: () => {
          open.value = false
        }
      }
    ]
  ]
})

// 2. Items des paramètres pour le menu mobile
const settingsItems = computed(() => {
  const items: DropdownMenuItem[] = [
    {
      label: t('pages.dashboard.settings.navigation.general'),
      to: localePath('/dashboard/settings'),
      icon: 'i-lucide-sliders',
      onSelect: () => {
        open.value = false
      }
    }
  ]

  if (canAccessOrganization.value) {
    items.push({
      label: t('pages.dashboard.settings.navigation.organization'),
      to: localePath('/dashboard/settings/organization'),
      icon: 'i-lucide-building',
      onSelect: () => {
        open.value = false
      }
    })
  }

  if (canManageMembers.value) {
    items.push({
      label: t('pages.dashboard.settings.navigation.members'),
      to: localePath('/dashboard/settings/members'),
      icon: 'i-lucide-users',
      onSelect: () => {
        open.value = false
      }
    })
  }

  items.push({
    label: t('pages.dashboard.settings.navigation.security'),
    to: localePath('/dashboard/settings/security'),
    icon: 'i-lucide-shield',
    onSelect: () => {
      open.value = false
    }
  })

  return [items]
})

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted' || cookie.value === 'declined') {
    return
  }

  toast.add({
    title: t('layouts.default.cookies.title'),
    duration: 0,
    close: false,
    actions: [
      {
        label: t('layouts.default.cookies.accept'),
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          cookie.value = 'accepted'
        }
      },
      {
        label: t('layouts.default.cookies.optOut'),
        color: 'neutral',
        variant: 'ghost',
        onClick: () => {
          cookie.value = 'declined'
        }
      },
      {
        label: t('layouts.default.cookies.learnMore'),
        color: 'neutral',
        variant: 'link',
        to: localePath('/cookies-policy')
      }
    ]
  })
})
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
    <!-- Background Blobs -->
    <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <!-- Top Left Blob -->
      <div
        class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full opacity-20 blur-3xl bg-gradient-to-br from-indigo-400 to-blue-500 animate-pulse"
        style="animation-duration: 8s;"
      />
      <!-- Bottom Right Blob -->
      <div
        class="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full opacity-15 blur-3xl bg-gradient-to-tl from-indigo-500 to-purple-500 animate-pulse"
        style="animation-duration: 12s;"
      />
    </div>

    <!-- Top Navigation Bar -->
    <header class="relative z-50 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-[auto_1fr_auto] items-center h-16">
          <!-- Left: Logo -->
          <div class="flex items-center">
            <NuxtLink v-if="hasSingleOrganization" :to="localePath('/dashboard')" class="group flex items-center gap-2">
              <img src="/favicon.svg" alt="DH-Echo" class="w-8 h-8">
              <span class="text-lg font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                DH-Echo
              </span>
            </NuxtLink>
            <TeamsMenu v-else />
          </div>

          <!-- Center: Navigation -->
          <nav class="hidden md:flex justify-center">
            <UNavigationMenu
              :items="mainLinks[0]"
              orientation="horizontal"
              class="border-none"
            />
          </nav>

          <!-- Right: Actions -->
          <div class="hidden md:flex items-center gap-3">
            <!-- Notifications Bell -->
            <UButton
              icon="i-heroicons-bell"
              color="neutral"
              variant="ghost"
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

            <!-- Credits Badge -->
            <NuxtLink :to="localePath('/dashboard/credits')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              <UIcon name="i-lucide-coins" class="w-4 h-4 text-indigo-500" />
              <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ credits }}</span>
            </NuxtLink>

            <UserMenu :collapsed="true" />
          </div>

          <!-- Mobile menu button (Hamburger) -->
          <div class="flex md:hidden justify-end">
            <UButton icon="i-lucide-menu" color="neutral" variant="ghost" @click="open = true" />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="relative z-10 w-full max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <AppFooter />

    <!-- Global Components -->
    <ContactSupportModal v-model:open="contactModalOpen" />
    <NotificationsSlideover />

    <!-- Mobile Slideover -->
    <USlideover v-model:open="open" title="Menu">
      <template #body>
        <div class="flex flex-col gap-4 h-full">
          <NuxtLink v-if="hasSingleOrganization" :to="localePath('/dashboard')" class="group flex items-center gap-2 px-2">
            <img src="/favicon.svg" alt="DH-Echo" class="w-8 h-8">
            <span class="text-lg font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              DH-Echo
            </span>
          </NuxtLink>
          <TeamsMenu v-else />

          <div class="space-y-4">
            <div class="font-semibold text-sm text-gray-500 px-2">
              {{ t("layouts.default.navigation.workshop") }}
            </div>
            <UNavigationMenu :items="mainLinks[0]" orientation="vertical" />
          </div>

          <USeparator />

          <div class="space-y-4">
            <div class="font-semibold text-sm text-gray-500 px-2">
              {{ t("layouts.default.navigation.settings") }}
            </div>
            <!-- Reusing settingsItems logic for mobile nav -->
            <UNavigationMenu
              :items="settingsItems[0] as any"
              orientation="vertical"
            />
          </div>

          <USeparator />

          <!-- Mobile Notifications Button -->
          <button
            class="flex items-center gap-3 px-2 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            @click="open = false; isNotificationsSlideoverOpen = true"
          >
            <div class="relative">
              <UIcon name="i-heroicons-bell" class="w-5 h-5 text-gray-500" />
              <span
                v-if="unreadCount > 0"
                class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white"
              >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            </div>
            <span class="text-sm font-medium">{{ t('components.notifications.title') }}</span>
          </button>

          <div class="mt-auto">
            <UserMenu />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

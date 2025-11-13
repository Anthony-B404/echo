<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();

const links = computed(() => [
  [
    {
      label: t('pages.dashboard.settings.navigation.general'),
      icon: "i-lucide-user",
      to: localePath('/dashboard/settings'),
      exact: true,
    },
    {
      label: t('pages.dashboard.settings.navigation.members'),
      icon: "i-lucide-users",
      to: localePath('/dashboard/settings/members'),
    },
    {
      label: t('pages.dashboard.settings.navigation.notifications'),
      icon: "i-lucide-bell",
      to: localePath('/dashboard/settings/notifications'),
    },
    {
      label: t('pages.dashboard.settings.navigation.security'),
      icon: "i-lucide-shield",
      to: localePath('/dashboard/settings/security'),
    },
  ],
  [
    {
      label: t('components.user.documentation'),
      icon: "i-lucide-book-open",
      to: "https://ui.nuxt.com/docs/getting-started/installation/nuxt",
      target: "_blank",
    },
  ],
] satisfies NavigationMenuItem[][]);
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar :title="t('pages.dashboard.settings.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div
        class="mx-auto flex w-full flex-col gap-4 sm:gap-6 lg:max-w-2xl lg:gap-12"
      >
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>

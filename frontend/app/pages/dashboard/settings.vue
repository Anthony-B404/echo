<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

definePageMeta({
  middleware: "auth",
});

const { t } = useI18n();
const localePath = useLocalePath();
const { canAccessOrganization } = useSettingsPermissions();

const links = computed(() => {
  const mainLinks: NavigationMenuItem[] = [
    {
      label: t("pages.dashboard.settings.navigation.general"),
      icon: "i-lucide-user",
      to: localePath("/dashboard/settings"),
      exact: true,
    },
  ];

  // Organization - Owner only
  if (canAccessOrganization.value) {
    mainLinks.push({
      label: t("pages.dashboard.settings.navigation.organization"),
      icon: "i-lucide-building",
      to: localePath("/dashboard/settings/organization"),
    });
  }

  // Members - All roles can view
  mainLinks.push({
    label: t("pages.dashboard.settings.navigation.members"),
    icon: "i-lucide-users",
    to: localePath("/dashboard/settings/members"),
  });

  // Notifications - All roles
  mainLinks.push({
    label: t("pages.dashboard.settings.navigation.notifications"),
    icon: "i-lucide-bell",
    to: localePath("/dashboard/settings/notifications"),
  });

  // Security - All roles
  mainLinks.push({
    label: t("pages.dashboard.settings.navigation.security"),
    icon: "i-lucide-shield",
    to: localePath("/dashboard/settings/security"),
  });

  return [mainLinks] satisfies NavigationMenuItem[][];
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
         <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-settings-2" class="text-primary-500" />
            {{ t('pages.dashboard.settings.title') }}
         </h1>
      </div>
      
      <!-- Navigation Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
         <UNavigationMenu 
            :items="links as any" 
            orientation="horizontal"
            class="pb-0"
            :ui="{ 
                list: 'gap-4',
                link: 'pb-3 rounded-none border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-700 hover:bg-transparent px-2 data-[active=true]:border-primary-500 data-[active=true]:text-primary-500 data-[active=true]:font-semibold text-gray-500 dark:text-gray-400'
            }"
         />
      </div>
    </div>

    <!-- Content -->
    <div class="mt-8 max-w-4xl">
      <NuxtPage />
    </div>
  </div>
</template>

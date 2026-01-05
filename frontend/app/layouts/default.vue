<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const toast = useToast();
const { canAccessOrganization } = useSettingsPermissions();
const creditsStore = useCreditsStore();
const { credits } = storeToRefs(creditsStore);
const { fetchBalance } = creditsStore;

const open = ref(false);
const contactModalOpen = ref(false);

// Fetch credits on mount
onMounted(() => {
  fetchBalance();
});

// 1. Navigation principale (Gauche Desktop / Haut Mobile)
const mainLinks = computed<NavigationMenuItem[][]>(() => {
  return [
    [
      {
        label: t("layouts.default.navigation.workshop"),
        icon: "i-lucide-house",
        to: localePath("/dashboard"),
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.library"),
        icon: "i-lucide-library",
        to: localePath("/dashboard/library"),
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.prompts"),
        icon: "i-lucide-bookmark",
        to: localePath("/dashboard/prompts"),
        onSelect: () => {
          open.value = false;
        },
      },
    ],
  ];
});

// 2. Items des paramètres (Contenu du Dropdown Droite / Bas Mobile)
const settingsItems = computed(() => {
  const items: DropdownMenuItem[] = [
    {
      label: t("pages.dashboard.settings.navigation.general"),
      to: localePath("/dashboard/settings"),
      icon: "i-lucide-sliders",
      onSelect: () => {
        open.value = false;
      },
    },
  ];

  if (canAccessOrganization.value) {
    items.push({
      label: t("pages.dashboard.settings.navigation.organization"),
      to: localePath("/dashboard/settings/organization"),
      icon: "i-lucide-building",
      onSelect: () => {
        open.value = false;
      },
    });
  }

  items.push({
    label: t("pages.dashboard.settings.navigation.members"),
    to: localePath("/dashboard/settings/members"),
    icon: "i-lucide-users",
    onSelect: () => {
      open.value = false;
    },
  });

  items.push({
    label: t("pages.dashboard.settings.navigation.notifications"),
    to: localePath("/dashboard/settings/notifications"),
    icon: "i-lucide-bell",
    onSelect: () => {
      open.value = false;
    },
  });

  items.push({
    label: t("pages.dashboard.settings.navigation.security"),
    to: localePath("/dashboard/settings/security"),
    icon: "i-lucide-shield",
    onSelect: () => {
      open.value = false;
    },
  });

  return [items];
});

onMounted(async () => {
  const cookie = useCookie("cookie-consent");
  if (cookie.value === "accepted") {
    return;
  }

  toast.add({
    title: t("layouts.default.cookies.title"),
    duration: 0,
    close: false,
    actions: [
      {
        label: t("layouts.default.cookies.accept"),
        color: "neutral",
        variant: "outline",
        onClick: () => {
          cookie.value = "accepted";
        },
      },
      {
        label: t("layouts.default.cookies.optOut"),
        color: "neutral",
        variant: "ghost",
      },
    ],
  });
});
</script>

<template>
  <div class="relative min-h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
    <!-- Background Blobs -->
    <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <!-- Top Left Blob -->
      <div
        class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full opacity-20 blur-3xl bg-gradient-to-br from-indigo-400 to-blue-500 animate-pulse"
        style="animation-duration: 8s;"
      ></div>
      <!-- Bottom Right Blob -->
      <div
        class="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full opacity-15 blur-3xl bg-gradient-to-tl from-indigo-500 to-purple-500 animate-pulse"
        style="animation-duration: 12s;"
      ></div>
    </div>

    <!-- Top Navigation Bar -->
    <header class="relative z-50 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-[auto_1fr_auto] items-center h-16">
          <!-- Left: Logo -->
          <div class="flex items-center">
            <TeamsMenu />
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
            <!-- Credits Badge -->
            <NuxtLink :to="localePath('/dashboard/credits')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              <UIcon name="i-lucide-coins" class="w-4 h-4 text-indigo-500" />
              <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ credits }}</span>
            </NuxtLink>

            <!-- Settings Dropdown (Icon Only) -->
            <UDropdownMenu
              :items="settingsItems"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-settings"
                color="neutral"
                variant="ghost"
                class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              />
            </UDropdownMenu>

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
    <main class="relative z-10 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <slot />
    </main>

    <!-- Global Components -->
    <ContactSupportModal v-model:open="contactModalOpen" />

    <!-- Mobile Slideover -->
    <USlideover v-model:open="open" title="Menu">
      <template #body>
        <div class="flex flex-col gap-4 h-full">
           <TeamsMenu />

           <div class="space-y-4">
             <div class="font-semibold text-sm text-gray-500 px-2">{{ t("layouts.default.navigation.workshop") }}</div>
             <UNavigationMenu :items="mainLinks[0]" orientation="vertical" />
           </div>

           <USeparator />

           <div class="space-y-4">
             <div class="font-semibold text-sm text-gray-500 px-2">{{ t("layouts.default.navigation.settings") }}</div>
              <!-- Reusing settingsItems logic for mobile nav -->
              <UNavigationMenu
                :items="settingsItems[0] as any"
                orientation="vertical"
              />
           </div>

           <div class="mt-auto">
              <UserMenu />
           </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

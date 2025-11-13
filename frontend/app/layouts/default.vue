<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const toast = useToast();

const open = ref(false);

const links = computed(() => [
  [
    {
      label: t('layouts.default.navigation.home'),
      icon: "i-lucide-house",
      to: localePath('/dashboard'),
      onSelect: () => {
        open.value = false;
      },
    },
    {
      label: t('layouts.default.navigation.inbox'),
      icon: "i-lucide-inbox",
      to: localePath('/dashboard/inbox'),
      badge: "4",
      onSelect: () => {
        open.value = false;
      },
    },
    {
      label: t('layouts.default.navigation.customers'),
      icon: "i-lucide-users",
      to: localePath('/dashboard/customers'),
      onSelect: () => {
        open.value = false;
      },
    },
    {
      label: t('layouts.default.navigation.settings'),
      to: localePath('/dashboard/settings'),
      icon: "i-lucide-settings",
      defaultOpen: true,
      type: "trigger",
      children: [
        {
          label: t('pages.dashboard.settings.navigation.general'),
          to: localePath('/dashboard/settings'),
          exact: true,
          onSelect: () => {
            open.value = false;
          },
        },
        {
          label: t('pages.dashboard.settings.navigation.members'),
          to: localePath('/dashboard/settings/members'),
          onSelect: () => {
            open.value = false;
          },
        },
        {
          label: t('pages.dashboard.settings.navigation.notifications'),
          to: localePath('/dashboard/settings/notifications'),
          onSelect: () => {
            open.value = false;
          },
        },
        {
          label: t('pages.dashboard.settings.navigation.security'),
          to: localePath('/dashboard/settings/security'),
          onSelect: () => {
            open.value = false;
          },
        },
      ],
    },
  ],
  [
    {
      label: t('layouts.default.navigation.feedback'),
      icon: "i-lucide-message-circle",
      to: "https://github.com/nuxt-ui-templates/dashboard",
      target: "_blank",
    },
    {
      label: t('layouts.default.navigation.helpSupport'),
      icon: "i-lucide-info",
      to: "https://github.com/nuxt-ui-templates/dashboard",
      target: "_blank",
    },
  ],
] satisfies NavigationMenuItem[][]);

const groups = computed(() => [
  {
    id: "links",
    label: t('layouts.default.search.goTo'),
    items: links.value.flat(),
  },
  {
    id: "code",
    label: t('layouts.default.search.code'),
    items: [
      {
        id: "source",
        label: t('layouts.default.search.viewPageSource'),
        icon: "i-simple-icons-github",
        to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === "/" ? "/index" : route.path}.vue`,
        target: "_blank",
      },
    ],
  },
]);

onMounted(async () => {
  const cookie = useCookie("cookie-consent");
  if (cookie.value === "accepted") {
    return;
  }

  toast.add({
    title: t('layouts.default.cookies.title'),
    duration: 0,
    close: false,
    actions: [
      {
        label: t('layouts.default.cookies.accept'),
        color: "neutral",
        variant: "outline",
        onClick: () => {
          cookie.value = "accepted";
        },
      },
      {
        label: t('layouts.default.cookies.optOut'),
        color: "neutral",
        variant: "ghost",
      },
    ],
  });
});
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          class="ring-default bg-transparent"
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const toast = useToast();
const trialStore = useTrialStore();
const { canAccessOrganization, canAccessBilling } = useSettingsPermissions();

const open = ref(false);
const contactModalOpen = ref(false);

const links = computed(() => {
  // Build settings children based on permissions
  const settingsChildren: NavigationMenuItem[] = [
    {
      label: t("pages.dashboard.settings.navigation.general"),
      to: localePath("/dashboard/settings"),
      exact: true,
      onSelect: () => {
        open.value = false;
      },
    },
  ];

  // Organization - Owner only
  if (canAccessOrganization.value) {
    settingsChildren.push({
      label: t("pages.dashboard.settings.navigation.organization"),
      to: localePath("/dashboard/settings/organization"),
      onSelect: () => {
        open.value = false;
      },
    });
  }

  // Members - All roles can view
  settingsChildren.push({
    label: t("pages.dashboard.settings.navigation.members"),
    to: localePath("/dashboard/settings/members"),
    onSelect: () => {
      open.value = false;
    },
  });

  // Notifications - All roles
  settingsChildren.push({
    label: t("pages.dashboard.settings.navigation.notifications"),
    to: localePath("/dashboard/settings/notifications"),
    onSelect: () => {
      open.value = false;
    },
  });

  // Security - All roles
  settingsChildren.push({
    label: t("pages.dashboard.settings.navigation.security"),
    to: localePath("/dashboard/settings/security"),
    onSelect: () => {
      open.value = false;
    },
  });

  // Billing - Owner only
  if (canAccessBilling.value) {
    settingsChildren.push({
      label: t("pages.dashboard.settings.navigation.billing"),
      to: localePath("/dashboard/settings/billing"),
      onSelect: () => {
        open.value = false;
      },
    });
  }

  return [
    [
      {
        label: t("layouts.default.navigation.home"),
        icon: "i-lucide-house",
        to: localePath("/dashboard"),
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.inbox"),
        icon: "i-lucide-inbox",
        to: localePath("/dashboard/inbox"),
        badge: "4",
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.customers"),
        icon: "i-lucide-users",
        to: localePath("/dashboard/customers"),
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.analyze"),
        icon: "i-lucide-audio-lines",
        to: localePath("/dashboard/analyze"),
        onSelect: () => {
          open.value = false;
        },
      },
      {
        label: t("layouts.default.navigation.settings"),
        to: localePath("/dashboard/settings"),
        icon: "i-lucide-settings",
        defaultOpen: true,
        type: "trigger",
        children: settingsChildren,
      },
    ],
    [
      {
        label: t("layouts.default.navigation.feedback"),
        icon: "i-lucide-message-circle",
        to: "https://github.com/nuxt-ui-templates/dashboard",
        target: "_blank",
      },
      {
        label: t("layouts.default.navigation.helpSupport"),
        icon: "i-lucide-info",
        onSelect: () => {
          contactModalOpen.value = true;
        },
      },
    ],
  ] satisfies NavigationMenuItem[][];
});

const groups = computed(() => [
  {
    id: "links",
    label: t("layouts.default.search.goTo"),
    items: links.value.flat(),
  },
  {
    id: "code",
    label: t("layouts.default.search.code"),
    items: [
      {
        id: "source",
        label: t("layouts.default.search.viewPageSource"),
        icon: "i-simple-icons-github",
        to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === "/" ? "/index" : route.path}.vue`,
        target: "_blank",
      },
    ],
  },
]);

onMounted(async () => {
  // Fetch trial status if not already loaded
  if (!trialStore.loaded) {
    await trialStore.fetchTrialStatus();
  }

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

        <!-- Bottom section: Trial banner + feedback/help links -->
        <div class="mt-auto">
          <!-- Trial Banner (only show when on trial and not collapsed) -->
          <BillingTrialBanner
            v-if="trialStore.isOnTrial && !collapsed"
            :days-remaining="trialStore.trialDaysRemaining"
            :trial-ends-at="trialStore.trialEndsAt"
          />

          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[1]"
            orientation="vertical"
            tooltip
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />

    <!-- Access blocked modal (shows when trial expired or subscription ended) -->
    <BillingAccessBlockedModal v-if="trialStore.loaded && !trialStore.hasAccess" />

    <!-- Contact support modal -->
    <ContactSupportModal v-model:open="contactModalOpen" />
  </UDashboardGroup>
</template>

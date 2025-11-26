<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

const { t } = useI18n();
const { user: authUser, logout } = useAuth();

defineProps<{
  collapsed?: boolean;
}>();

const colorMode = useColorMode();
const appConfig = useAppConfig();

const colors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];
const neutrals = ["slate", "gray", "zinc", "neutral", "stone"];

const user = computed(() => ({
  name: authUser.value?.fullName || authUser.value?.email || "User",
  avatar: {
    src: authUser.value?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.value?.fullName || authUser.value?.email || "U")}`,
    alt: authUser.value?.fullName || authUser.value?.email || "User",
  },
}));

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      type: "label",
      label: user.value.name,
      avatar: user.value.avatar,
    },
  ],
  [
    {
      label: t('components.user.profile'),
      icon: "i-lucide-user",
    },
    {
      label: t('components.user.billing'),
      icon: "i-lucide-credit-card",
    },
    {
      label: t('components.user.settings'),
      icon: "i-lucide-settings",
      to: "/settings",
    },
  ],
  [
    {
      label: t('components.user.theme'),
      icon: "i-lucide-palette",
      children: [
        {
          label: t('components.user.primary'),
          slot: "chip",
          chip: appConfig.ui.colors.primary,
          content: {
            align: "center",
            collisionPadding: 16,
          },
          children: colors.map((color) => ({
            label: color,
            chip: color,
            slot: "chip",
            checked: appConfig.ui.colors.primary === color,
            type: "checkbox",
            onSelect: (e) => {
              e.preventDefault();

              appConfig.ui.colors.primary = color;
            },
          })),
        },
        {
          label: t('components.user.neutral'),
          slot: "chip",
          chip:
            appConfig.ui.colors.neutral === "neutral"
              ? "old-neutral"
              : appConfig.ui.colors.neutral,
          content: {
            align: "end",
            collisionPadding: 16,
          },
          children: neutrals.map((color) => ({
            label: color,
            chip: color === "neutral" ? "old-neutral" : color,
            slot: "chip",
            type: "checkbox",
            checked: appConfig.ui.colors.neutral === color,
            onSelect: (e) => {
              e.preventDefault();

              appConfig.ui.colors.neutral = color;
            },
          })),
        },
      ],
    },
    {
      label: t('components.user.appearance'),
      icon: "i-lucide-sun-moon",
      children: [
        {
          label: t('components.user.light'),
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.value === "light",
          onSelect(e: Event) {
            e.preventDefault();

            colorMode.preference = "light";
          },
        },
        {
          label: t('components.user.dark'),
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.value === "dark",
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.preference = "dark";
            }
          },
          onSelect(e: Event) {
            e.preventDefault();
          },
        },
      ],
    },
  ],
  [
    {
      label: t('components.user.templates'),
      icon: "i-lucide-layout-template",
      children: [
        {
          label: "Starter",
          to: "https://starter-template.nuxt.dev/",
        },
        {
          label: "Landing",
          to: "https://landing-template.nuxt.dev/",
        },
        {
          label: "Docs",
          to: "https://docs-template.nuxt.dev/",
        },
        {
          label: "SaaS",
          to: "https://saas-template.nuxt.dev/",
        },
        {
          label: "Dashboard",
          to: "https://dashboard-template.nuxt.dev/",
          color: "primary",
          checked: true,
          type: "checkbox",
        },
        {
          label: "Chat",
          to: "https://chat-template.nuxt.dev/",
        },
        {
          label: "Portfolio",
          to: "https://portfolio-template.nuxt.dev/",
        },
        {
          label: "Changelog",
          to: "https://changelog-template.nuxt.dev/",
        },
      ],
    },
  ],
  [
    {
      label: t('components.user.documentation'),
      icon: "i-lucide-book-open",
      to: "https://ui.nuxt.com/docs/getting-started/installation/nuxt",
      target: "_blank",
    },
    {
      label: t('components.user.githubRepository'),
      icon: "i-simple-icons-github",
      to: "https://github.com/nuxt-ui-templates/dashboard",
      target: "_blank",
    },
    {
      label: t('components.user.logOut'),
      icon: "i-lucide-log-out",
      onSelect: async () => {
        await logout();
      },
    },
  ],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{
      content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)',
    }"
  >
    <UButton
      v-bind="{
        ...user,
        label: collapsed ? undefined : user?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down',
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed',
      }"
    />

    <template #chip-leading="{ item }">
      <div class="inline-flex size-5 shrink-0 items-center justify-center">
        <span
          class="ring-bg size-2 rounded-full bg-(--chip-light) ring dark:bg-(--chip-dark)"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`,
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>

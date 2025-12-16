<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { en, fr } from "@nuxt/ui/locale";

const { t, locale, setLocale } = useI18n();
const localePath = useLocalePath();
const { user: authUser, logout } = useAuth();
const { getAvatarUrl } = useAvatarUrl();

defineProps<{
  collapsed?: boolean;
}>();

const colorMode = useColorMode();
const appConfig = useAppConfig();
const themeStore = useThemeStore();

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

// Tailwind color palette values for chip display
const colorPalette: Record<string, { light: string; dark: string }> = {
  red: { light: "#ef4444", dark: "#f87171" },
  orange: { light: "#f97316", dark: "#fb923c" },
  amber: { light: "#f59e0b", dark: "#fbbf24" },
  yellow: { light: "#eab308", dark: "#facc15" },
  lime: { light: "#84cc16", dark: "#a3e635" },
  green: { light: "#22c55e", dark: "#4ade80" },
  emerald: { light: "#10b981", dark: "#34d399" },
  teal: { light: "#14b8a6", dark: "#2dd4bf" },
  cyan: { light: "#06b6d4", dark: "#22d3ee" },
  sky: { light: "#0ea5e9", dark: "#38bdf8" },
  blue: { light: "#3b82f6", dark: "#60a5fa" },
  indigo: { light: "#6366f1", dark: "#818cf8" },
  violet: { light: "#8b5cf6", dark: "#a78bfa" },
  purple: { light: "#a855f7", dark: "#c084fc" },
  fuchsia: { light: "#d946ef", dark: "#e879f9" },
  pink: { light: "#ec4899", dark: "#f472b6" },
  rose: { light: "#f43f5e", dark: "#fb7185" },
  slate: { light: "#64748b", dark: "#94a3b8" },
  gray: { light: "#6b7280", dark: "#9ca3af" },
  zinc: { light: "#71717a", dark: "#a1a1aa" },
  "old-neutral": { light: "#737373", dark: "#a3a3a3" },
  stone: { light: "#78716c", dark: "#a8a29e" },
};

const getChipColor = (colorName: string, mode: "light" | "dark") => {
  return colorPalette[colorName]?.[mode] || "#888888";
};

const user = computed(() => ({
  name: authUser.value?.fullName || authUser.value?.email || "User",
  avatar: {
    src: getAvatarUrl(authUser.value?.avatar),
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
      label: t("components.user.profile"),
      icon: "i-lucide-user",
    },
    {
      label: t("components.user.billing"),
      icon: "i-lucide-credit-card",
      to: localePath("/dashboard/settings/billing"),
    },
    {
      label: t("components.user.settings"),
      icon: "i-lucide-settings",
      to: localePath("/dashboard/settings"),
    },
  ],
  [
    {
      label: t("components.user.theme"),
      icon: "i-lucide-palette",
      children: [
        {
          label: t("components.user.primary"),
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
              themeStore.setPrimaryColor(color);
            },
          })),
        },
        {
          label: t("components.user.neutral"),
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
              themeStore.setNeutralColor(color);
            },
          })),
        },
      ],
    },
    {
      label: t("components.user.appearance"),
      icon: "i-lucide-sun-moon",
      children: [
        {
          label: t("components.user.light"),
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.preference === "light",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "light";
          },
        },
        {
          label: t("components.user.dark"),
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.preference === "dark",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "dark";
          },
        },
        {
          label: t("components.user.system"),
          icon: "i-lucide-monitor",
          type: "checkbox",
          checked: colorMode.preference === "system",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "system";
          },
        },
      ],
    },
  ],
  [
    {
      label: t("footer.language.label"),
      icon: "i-lucide-languages",
      children: [
        {
          label: "Français",
          type: "checkbox",
          checked: locale.value === "fr",
          onSelect(e: Event) {
            e.preventDefault();
            setLocale("fr");
          },
        },
        {
          label: "English",
          type: "checkbox",
          checked: locale.value === "en",
          onSelect(e: Event) {
            e.preventDefault();
            setLocale("en");
          },
        },
      ],
    },
  ],
  [
    {
      label: t("components.user.documentation"),
      icon: "i-lucide-book-open",
      to: "https://ui.nuxt.com/docs/getting-started/installation/nuxt",
      target: "_blank",
    },
    {
      label: t("components.user.githubRepository"),
      icon: "i-simple-icons-github",
      to: "https://github.com/nuxt-ui-templates/dashboard",
      target: "_blank",
    },
    {
      label: t("components.user.logOut"),
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
          class="size-2 rounded-full ring ring-white/20 dark:ring-black/20"
          :style="{
            backgroundColor: getChipColor((item as any).chip, colorMode.value === 'dark' ? 'dark' : 'light'),
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>

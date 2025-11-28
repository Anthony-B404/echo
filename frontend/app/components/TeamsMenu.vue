<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useOrganizationStore } from "~/stores/organization";
import { storeToRefs } from "pinia";

const { t } = useI18n();
const config = useRuntimeConfig();

defineProps<{
  collapsed?: boolean;
}>();

// Récupérer l'organisation depuis le store
const organizationStore = useOrganizationStore();
const { organization, loading } = storeToRefs(organizationStore);

// Calculer l'URL du logo
const logoUrl = computed(() => {
  if (!organization.value?.logo) {
    return null;
  }
  return `${config.public.apiUrl}/${organization.value.logo}`;
});

// Créer l'objet team à partir de l'organisation
const currentTeam = computed(() => {
  if (!organization.value) {
    return {
      label: t("components.teams.loading"),
      avatar: undefined,
    };
  }

  return {
    label: organization.value.name,
    avatar: logoUrl.value
      ? {
          src: logoUrl.value,
          alt: organization.value.name,
        }
      : undefined,
  };
});

const items = computed<DropdownMenuItem[][]>(() => {
  return [
    [currentTeam.value],
    [
      {
        label: t("components.teams.createTeam"),
        icon: "i-lucide-circle-plus",
      },
      {
        label: t("components.teams.manageTeams"),
        icon: "i-lucide-cog",
      },
    ],
  ];
});
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{
      content: collapsed ? 'w-40' : 'w-(--reka-dropdown-menu-trigger-width)',
    }"
  >
    <UButton
      v-bind="{
        ...currentTeam,
        label: collapsed ? undefined : currentTeam?.label,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down',
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      :disabled="loading"
      class="data-[state=open]:bg-elevated"
      :class="[!collapsed && 'py-2']"
      :ui="{
        trailingIcon: 'text-dimmed',
      }"
    />
  </UDropdownMenu>
</template>

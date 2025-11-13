<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Member } from "~/types";

const { t } = useI18n();

defineProps<{
  members: Member[];
}>();

const items = computed(() => [
  {
    label: t('components.settings.members.editMember'),
    onSelect: () => console.log("Edit member"),
  },
  {
    label: t('components.settings.members.removeMember'),
    color: "error" as const,
    onSelect: () => console.log("Remove member"),
  },
] satisfies DropdownMenuItem[]);
</script>

<template>
  <ul role="list" class="divide-default divide-y">
    <li
      v-for="(member, index) in members"
      :key="index"
      class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
    >
      <div class="flex min-w-0 items-center gap-3">
        <UAvatar v-bind="member.avatar" size="md" />

        <div class="min-w-0 text-sm">
          <p class="text-highlighted truncate font-medium">
            {{ member.name }}
          </p>
          <p class="text-muted truncate">
            {{ member.username }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <USelect
          :model-value="member.role"
          :items="[
            { label: t('common.roles.member'), value: 'member' },
            { label: t('common.roles.owner'), value: 'owner' }
          ]"
          color="neutral"
          :ui="{ value: 'capitalize', itemLabel: 'label' }"
        />

        <UDropdownMenu :items="items" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
          />
        </UDropdownMenu>
      </div>
    </li>
  </ul>
</template>

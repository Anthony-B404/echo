<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Member } from "~/types";
import { UserRole } from "~/types/auth";

const { t } = useI18n();
const { getRoleOptions } = useRoles();

defineProps<{
  members: Member[];
}>();

const items = computed(
  () =>
    [
      {
        label: t("components.settings.members.editMember"),
        onSelect: () => console.log("Edit member"),
      },
      {
        label: t("components.settings.members.removeMember"),
        color: "error" as const,
        onSelect: () => console.log("Remove member"),
      },
    ] satisfies DropdownMenuItem[],
);

/**
 * Get role options for a member
 * Owners cannot change roles, so we filter them out
 */
const getMemberRoleOptions = (member: Member) => {
  if (member.role === UserRole.Owner) {
    return getRoleOptions().filter((option) => option.value === UserRole.Owner);
  }
  return getRoleOptions().filter((option) => option.value !== UserRole.Owner);
};

const handleRoleChange = (member: Member, newRole: UserRole) => {
  // TODO: Implement role change API call
  console.log("Role change requested:", member.id, newRole);
};
</script>

<template>
  <ul role="list" class="divide-default divide-y">
    <li
      v-for="member in members"
      :key="member.id"
      class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
    >
      <div class="flex min-w-0 items-center gap-3">
        <UAvatar
          :src="member.avatar || undefined"
          :alt="member.fullName || member.email"
          size="md"
        />

        <div class="min-w-0 text-sm">
          <p class="text-highlighted truncate font-medium">
            {{ member.fullName || member.email }}
          </p>
          <p class="text-muted truncate">
            {{ member.email }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <USelect
          :model-value="member.role"
          :items="getMemberRoleOptions(member)"
          :disabled="member.role === UserRole.Owner"
          color="neutral"
          :ui="{ itemLabel: 'label' }"
          @update:model-value="(newRole) => handleRoleChange(member, newRole)"
        />

        <UDropdownMenu
          v-if="!member.isCurrentUser"
          :items="items"
          :content="{ align: 'end' }"
        >
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

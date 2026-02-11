<script setup lang="ts">
import type { Invitation } from '~/types'
import type { UserRole } from '~/types/auth'

const { t } = useI18n()
const { getRoleOptions } = useRoles()

defineProps<{
  invitations: Invitation[];
}>()

const emit = defineEmits<{
  resend: [id: number];
  delete: [id: number];
}>()

/**
 * Get role label for invitation
 */
const getRoleLabel = (role: UserRole) => {
  const roleOption = getRoleOptions().find(option => option.value === role)
  return roleOption?.label || ''
}

/**
 * Format date to readable string
 */
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const handleResend = (id: number) => {
  emit('resend', id)
}

const handleDelete = (id: number) => {
  emit('delete', id)
}
</script>

<template>
  <div v-if="invitations.length === 0" class="px-4 py-8 text-center">
    <p class="text-muted">
      {{ t("components.settings.invitations.noInvitations") }}
    </p>
  </div>

  <ul v-else role="list" class="divide-default divide-y">
    <li
      v-for="invitation in invitations"
      :key="invitation.id"
      class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <UIcon name="i-lucide-mail" class="text-primary w-5 h-5" />
          </div>

          <div class="min-w-0 text-sm flex-1">
            <p class="text-highlighted truncate font-medium">
              {{ invitation.email }}
            </p>
            <div class="text-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>{{ getRoleLabel(invitation.role) }}</span>
              <span>
                {{ t("components.settings.invitations.sentOn") }}:
                {{ formatDate(invitation.createdAt) }}
              </span>
              <span>
                {{ t("components.settings.invitations.expiresOn") }}:
                {{ formatDate(invitation.expiresAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <UButton
          icon="i-lucide-send"
          color="neutral"
          variant="outline"
          size="sm"
          class="sm:hidden"
          @click="handleResend(invitation.id)"
        />
        <UButton
          :label="t('components.settings.invitations.resend')"
          icon="i-lucide-send"
          color="neutral"
          variant="outline"
          size="sm"
          class="hidden sm:inline-flex"
          @click="handleResend(invitation.id)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          size="sm"
          class="sm:hidden"
          @click="handleDelete(invitation.id)"
        />
        <UButton
          :label="t('components.settings.invitations.delete')"
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          size="sm"
          class="hidden sm:inline-flex"
          @click="handleDelete(invitation.id)"
        />
      </div>
    </li>
  </ul>
</template>

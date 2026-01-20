<script setup lang="ts">
import type { OrganizationUser } from '~/types/reseller'
import { USER_ROLES } from '~/types/reseller'
import type { TableColumn } from '@nuxt/ui'

defineProps<{
  users: OrganizationUser[]
  loading?: boolean
}>()

const emit = defineEmits<{
  delete: [user: OrganizationUser]
  resend: [user: OrganizationUser]
}>()

const { t } = useI18n()
const { formatDate } = useFormatters()

const columns: TableColumn<OrganizationUser>[] = [
  {
    accessorKey: 'fullName',
    header: t('reseller.users.table.name'),
  },
  {
    accessorKey: 'email',
    header: t('reseller.users.table.email'),
  },
  {
    accessorKey: 'role',
    header: t('reseller.users.table.role'),
  },
  {
    accessorKey: 'createdAt',
    header: t('reseller.users.table.createdAt'),
  },
  {
    accessorKey: 'actions',
    header: '',
  },
]

// Badge color type for Nuxt UI
type BadgeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

// Role configuration - single source of truth for labels and colors
const roleConfig: Record<number, { label: string; color: BadgeColor }> = {
  [USER_ROLES.OWNER]: {
    label: t('reseller.users.roles.owner'),
    color: 'primary',
  },
  [USER_ROLES.ADMINISTRATOR]: {
    label: t('reseller.users.roles.administrator'),
    color: 'info',
  },
  [USER_ROLES.MEMBER]: {
    label: t('reseller.users.roles.member'),
    color: 'neutral',
  },
}

function getRoleLabel(role: number) {
  return roleConfig[role]?.label || '-'
}

function getRoleColor(role: number): BadgeColor {
  return roleConfig[role]?.color || 'neutral'
}

/**
 * Check if a pending user can receive a new invitation (5 minute cooldown)
 */
function canResendInvitation(user: OrganizationUser): boolean {
  if (user.onboardingCompleted) return false
  if (!user.lastInvitationSentAt) return true

  const cooldownMs = 5 * 60 * 1000 // 5 minutes
  const lastSent = new Date(user.lastInvitationSentAt).getTime()
  return Date.now() >= lastSent + cooldownMs
}

/**
 * Get remaining cooldown seconds for resend
 */
function getResendCooldownSeconds(user: OrganizationUser): number {
  if (!user.lastInvitationSentAt) return 0

  const cooldownMs = 5 * 60 * 1000 // 5 minutes
  const lastSent = new Date(user.lastInvitationSentAt).getTime()
  const remaining = Math.max(0, (lastSent + cooldownMs - Date.now()) / 1000)
  return Math.ceil(remaining)
}

/**
 * Format cooldown seconds to readable string
 */
function formatCooldown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

function getRowActions(user: OrganizationUser) {
  const actions = []

  // Add resend invitation action for pending users (including owners)
  if (!user.onboardingCompleted) {
    const canResend = canResendInvitation(user)
    const cooldownSeconds = getResendCooldownSeconds(user)

    actions.push({
      label: canResend
        ? t('reseller.users.actions.resendInvitation')
        : t('reseller.users.actions.resendCooldown', { time: formatCooldown(cooldownSeconds) }),
      icon: 'i-lucide-mail',
      disabled: !canResend,
      onSelect: () => emit('resend', user),
    })
  }

  // Cannot delete owner - show info message only
  if (user.role === USER_ROLES.OWNER) {
    if (actions.length === 0) {
      // Only show this message if no other actions are available
      actions.push({
        label: t('reseller.users.actions.cannotDeleteOwner'),
        icon: 'i-lucide-info',
        disabled: true,
      })
    }
    return actions
  }

  // Delete action (for non-owners only)
  actions.push({
    label: t('common.buttons.delete'),
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => emit('delete', user),
  })

  return actions
}
</script>

<template>
  <UTable :data="users" :columns="columns" :loading="loading">
    <template #fullName-cell="{ row }">
      <div>
        <p class="font-medium text-gray-900 dark:text-white">
          {{ row.original.fullName || `${row.original.firstName} ${row.original.lastName}` }}
        </p>
        <UTooltip
          v-if="!row.original.onboardingCompleted"
          :text="row.original.lastInvitationSentAt
            ? t('reseller.users.lastInvitationSent', { date: formatDate(row.original.lastInvitationSentAt) })
            : t('reseller.users.pendingInvitation')"
        >
          <p class="text-xs text-orange-500 cursor-help">
            {{ t('reseller.users.pendingInvitation') }}
          </p>
        </UTooltip>
      </div>
    </template>

    <template #role-cell="{ row }">
      <UBadge :color="getRoleColor(row.original.role)" variant="subtle">
        {{ getRoleLabel(row.original.role) }}
      </UBadge>
    </template>

    <template #createdAt-cell="{ row }">
      {{ formatDate(row.original.createdAt) }}
    </template>

    <template #actions-cell="{ row }">
      <UDropdownMenu :items="getRowActions(row.original)">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-more-horizontal"
          :aria-label="t('common.buttons.actions')"
        />
      </UDropdownMenu>
    </template>
  </UTable>
</template>

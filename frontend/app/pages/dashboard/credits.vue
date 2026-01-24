<script setup lang="ts">
import type { UserCreditBalance } from '~/types/credit'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status'],
})

const { t, locale } = useI18n()

useSeoMeta({
  title: t('seo.credits.title'),
  description: t('seo.credits.description'),
})
const localePath = useLocalePath()
const creditsStore = useCreditsStore()
const creditRequestsStore = useCreditRequestsStore()
const { isOwner } = useSettingsPermissions()
const {
  canChangeMode,
  canConfigureGlobalAutoRefill,
  showMemberManagement,
  showAllTransactions,
  showPersonalBalance,
  showOrganizationPool,
} = useCreditsPermissions()
const {
  canRequestCredits,
  canRequestFromReseller,
  canProcessRequests,
} = useCreditRequestsPermissions()

const {
  credits,
  creditMode,
  organizationCredits,
  transactions,
  memberCredits,
  loading,
  isIndividualMode,
} = storeToRefs(creditsStore)

// URL query handling for tab
const route = useRoute()

// UI state - initialize from query param or default to 'history'
const activeTab = ref((route.query.tab as string) || 'history')
const distributeModalOpen = ref(false)
const recoverModalOpen = ref(false)
const autoRefillModalOpen = ref(false)
const historyModalOpen = ref(false)
const requestCreditsModalOpen = ref(false)
const requestType = ref<'member_to_owner' | 'owner_to_reseller'>('member_to_owner')
const selectedMember = ref<UserCreditBalance | null>(null)

// Load data on mount
onMounted(async () => {
  await creditsStore.fetchBalance()

  // Load member credits if in individual mode and has permission
  if (showMemberManagement.value) {
    await creditsStore.fetchMemberCredits()
  }

  await creditsStore.fetchHistory(1, 20)

  // Load pending requests count for owner
  if (canProcessRequests.value) {
    await creditRequestsStore.fetchPendingCount()
  }
})

// Watch for mode changes to load member credits
watch(
  [isIndividualMode, showMemberManagement],
  async ([isIndividual, canManage]) => {
    if (isIndividual && canManage) {
      await creditsStore.fetchMemberCredits()
    }
  },
)

// Tabs configuration
const tabs = computed(() => {
  const items = [
    {
      value: 'history',
      label: t('pages.dashboard.credits.tabs.history'),
      icon: 'i-lucide-history',
    },
  ]

  // Tab My Requests (Member in individual mode)
  if (canRequestCredits.value) {
    items.push({
      value: 'myRequests',
      label: t('pages.dashboard.credits.requests.myRequests'),
      icon: 'i-lucide-file-text',
    })
  }

  // Tab Pending Requests (Owner only)
  if (canProcessRequests.value) {
    const pendingLabel = creditRequestsStore.pendingCount > 0
      ? `${t('pages.dashboard.credits.requests.pendingRequests')} (${creditRequestsStore.pendingCount})`
      : t('pages.dashboard.credits.requests.pendingRequests')
    items.push({
      value: 'pendingRequests',
      label: pendingLabel,
      icon: 'i-lucide-inbox',
    })
  }

  // Tab Configuration (Owner only)
  if (canChangeMode.value) {
    items.push({
      value: 'configuration',
      label: t('pages.dashboard.credits.tabs.configuration'),
      icon: 'i-lucide-settings',
    })
  }

  // Tab Members (Owner/Admin, individual mode)
  if (showMemberManagement.value) {
    items.push({
      value: 'members',
      label: t('pages.dashboard.credits.tabs.members'),
      icon: 'i-lucide-users',
    })
  }

  return items
})

// Modal handlers
function openDistributeModal(member: UserCreditBalance) {
  selectedMember.value = member
  distributeModalOpen.value = true
}

function openRecoverModal(member: UserCreditBalance) {
  selectedMember.value = member
  recoverModalOpen.value = true
}

function openAutoRefillModal(member: UserCreditBalance) {
  selectedMember.value = member
  autoRefillModalOpen.value = true
}

function openHistoryModal(member: UserCreditBalance) {
  selectedMember.value = member
  historyModalOpen.value = true
}

function openRequestCreditsModal(type: 'member_to_owner' | 'owner_to_reseller' = 'member_to_owner') {
  requestType.value = type
  requestCreditsModalOpen.value = true
}

async function handleRequestSuccess() {
  // Refresh pending count for owner
  if (canProcessRequests.value) {
    await creditRequestsStore.fetchPendingCount()
  }
}

async function handleModeChange() {
  // Reload all data after mode change
  await creditsStore.fetchBalance()
  if (showMemberManagement.value) {
    await creditsStore.fetchMemberCredits()
  }
  await creditsStore.fetchHistory(1, 20)
}

async function handleCreditsChange() {
  // Reload member credits and balance after distribution/recovery
  await creditsStore.fetchBalance()
  await creditsStore.fetchMemberCredits()
  await creditsStore.fetchHistory(1, 20)
}

// Transaction display helpers
function getTransactionIcon(type: string) {
  switch (type) {
    case 'usage':
      return 'i-lucide-activity'
    case 'purchase':
      return 'i-lucide-credit-card'
    case 'bonus':
      return 'i-lucide-sparkles'
    case 'refund':
      return 'i-lucide-refresh-cw'
    case 'distribution':
      return 'i-lucide-plus-circle'
    case 'recovery':
      return 'i-lucide-minus-circle'
    case 'refill':
      return 'i-lucide-refresh-cw'
    default:
      return 'i-lucide-circle'
  }
}

function getTransactionColor(type: string) {
  switch (type) {
    case 'usage':
    case 'recovery':
      return 'text-slate-500 dark:text-slate-400'
    case 'purchase':
    case 'bonus':
    case 'refund':
    case 'distribution':
    case 'refill':
      return 'text-indigo-500 dark:text-indigo-400'
    default:
      return 'text-gray-500'
  }
}

function getTransactionBg(type: string) {
  switch (type) {
    case 'usage':
    case 'recovery':
      return 'bg-slate-100 dark:bg-slate-800'
    case 'purchase':
    case 'bonus':
    case 'refund':
    case 'distribution':
    case 'refill':
      return 'bg-indigo-50 dark:bg-indigo-900/30'
    default:
      return 'bg-gray-100 dark:bg-gray-800'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getUserDisplayName(tx: (typeof transactions.value)[0]) {
  if (!tx.user) return null
  if (tx.user.fullName) return tx.user.fullName
  if (tx.user.firstName || tx.user.lastName) {
    return [tx.user.firstName, tx.user.lastName].filter(Boolean).join(' ')
  }
  return tx.user.email
}

function getPerformedByName(tx: (typeof transactions.value)[0]) {
  if (!tx.performedBy) return null
  return tx.performedBy.fullName || tx.performedBy.email
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ t('pages.dashboard.credits.title') }}
          </h1>
          <p class="mt-1 text-gray-500 dark:text-gray-400">
            {{ t('pages.dashboard.credits.subtitle') }}
          </p>
        </div>
        <CreditsCreditModeBadge :mode="creditMode" />
      </div>
      <div class="flex items-center gap-2">
        <!-- Request Credits Button (Member in individual mode) -->
        <UButton
          v-if="canRequestCredits"
          color="primary"
          icon="i-lucide-hand-coins"
          @click="openRequestCreditsModal('member_to_owner')"
        >
          {{ t('pages.dashboard.credits.requests.requestCredits') }}
        </UButton>
        <!-- Request from Reseller Button (Owner only) -->
        <UButton
          v-if="canRequestFromReseller"
          color="primary"
          variant="outline"
          icon="i-lucide-hand-coins"
          @click="openRequestCreditsModal('owner_to_reseller')"
        >
          {{ t('pages.dashboard.credits.requests.requestFromReseller') }}
        </UButton>
        <UButton
          :to="localePath('/dashboard')"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
        >
          {{ t('pages.dashboard.library.backToWorkshop') }}
        </UButton>
      </div>
    </div>

    <!-- Balance Cards -->
    <div class="grid gap-4 md:grid-cols-2">
      <!-- Organization Pool -->
      <UCard
        v-if="showOrganizationPool"
        class="relative overflow-hidden border-none bg-gray-50/50 dark:bg-slate-800/50"
      >
        <div class="relative z-10 flex items-center gap-5">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white text-indigo-500 shadow-sm dark:border-gray-800 dark:bg-slate-900"
          >
            <UIcon name="i-lucide-building" class="h-8 w-8" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.credits.organization_pool') }}
            </p>
            <div class="mt-0.5 flex items-baseline gap-2">
              <span
                class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white"
              >
                {{ organizationCredits }}
              </span>
              <span class="text-lg font-medium text-gray-500 dark:text-gray-400">
                {{ t('pages.dashboard.credits.creditsUnit') }}
              </span>
            </div>
          </div>
        </div>
        <!-- Decorative background element -->
        <div
          class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] dark:opacity-[0.05]"
        >
          <UIcon name="i-lucide-building" class="h-48 w-48 -rotate-12" />
        </div>
      </UCard>

      <!-- Personal Balance (Individual mode, non-owner) -->
      <UCard
        v-if="showPersonalBalance"
        class="relative overflow-hidden border-none bg-gray-50/50 dark:bg-slate-800/50"
      >
        <div class="relative z-10 flex items-center gap-5">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white text-emerald-500 shadow-sm dark:border-gray-800 dark:bg-slate-900"
          >
            <UIcon name="i-lucide-coins" class="h-8 w-8" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.credits.my_balance') }}
            </p>
            <div class="mt-0.5 flex items-baseline gap-2">
              <span
                class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white"
              >
                {{ credits }}
              </span>
              <span class="text-lg font-medium text-gray-500 dark:text-gray-400">
                {{ t('pages.dashboard.credits.creditsUnit') }}
              </span>
            </div>
            <p
              class="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
            >
              <UIcon name="i-lucide-info" class="h-3 w-3" />
              {{ t('pages.dashboard.credits.creditInfo') }}
            </p>
          </div>
        </div>
        <!-- Decorative background element -->
        <div
          class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] dark:opacity-[0.05]"
        >
          <UIcon name="i-lucide-coins" class="h-48 w-48 -rotate-12" />
        </div>
      </UCard>

      <!-- Shared Mode Balance (show for all users in shared mode) -->
      <UCard
        v-if="!isIndividualMode && !isOwner"
        class="relative overflow-hidden border-none bg-gray-50/50 dark:bg-slate-800/50"
      >
        <div class="relative z-10 flex items-center gap-5">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white text-indigo-500 shadow-sm dark:border-gray-800 dark:bg-slate-900"
          >
            <UIcon name="i-lucide-coins" class="h-8 w-8" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.credits.balance') }}
            </p>
            <div class="mt-0.5 flex items-baseline gap-2">
              <span
                class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white"
              >
                {{ credits }}
              </span>
              <span class="text-lg font-medium text-gray-500 dark:text-gray-400">
                {{ t('pages.dashboard.credits.creditsUnit') }}
              </span>
            </div>
            <p
              class="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
            >
              <UIcon name="i-lucide-info" class="h-3 w-3" />
              {{ t('pages.dashboard.credits.creditInfo') }}
            </p>
          </div>
        </div>
        <!-- Decorative background element -->
        <div
          class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] dark:opacity-[0.05]"
        >
          <UIcon name="i-lucide-coins" class="h-48 w-48 -rotate-12" />
        </div>
      </UCard>
    </div>

    <!-- Tabs: History | Members Management -->
    <UTabs v-model="activeTab" :items="tabs">
      <template #content="{ item }">
        <!-- History Tab -->
        <UCard v-if="item.value === 'history'" class="mt-4">
          <!-- Loading -->
          <div v-if="loading" class="py-8 text-center">
            <UIcon
              name="i-lucide-loader-2"
              class="mx-auto h-8 w-8 animate-spin text-primary-500"
            />
          </div>

          <!-- Transactions List -->
          <div
            v-else-if="transactions.length > 0"
            class="divide-y divide-gray-100 dark:divide-gray-800"
          >
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="group -mx-2 flex items-center justify-between rounded-lg px-2 py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
            >
              <div class="flex items-center gap-4">
                <div
                  :class="[
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
                    getTransactionBg(tx.type),
                  ]"
                >
                  <UIcon
                    :name="getTransactionIcon(tx.type)"
                    :class="['h-5 w-5', getTransactionColor(tx.type)]"
                  />
                </div>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ t(`pages.dashboard.credits.transactionTypes.${tx.type}`) }}
                  </p>
                  <p
                    class="line-clamp-1 max-w-md text-sm text-gray-500 dark:text-gray-400"
                  >
                    {{ tx.description || '-' }}
                  </p>
                  <p
                    v-if="showAllTransactions && getUserDisplayName(tx)"
                    class="mt-0.5 text-xs text-gray-400 dark:text-gray-500"
                  >
                    {{ t('pages.dashboard.credits.usedBy', { name: getUserDisplayName(tx) }) }}
                  </p>
                  <p
                    v-if="getPerformedByName(tx)"
                    class="mt-0.5 text-xs text-gray-400 dark:text-gray-500"
                  >
                    {{ t('pages.dashboard.credits.performedBy', { name: getPerformedByName(tx) }) }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p
                  :class="[
                    'text-lg font-bold',
                    tx.amount > 0
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-300',
                  ]"
                >
                  {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
                </p>
                <p
                  class="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500"
                >
                  {{ formatDate(tx.createdAt) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="py-12 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <UIcon name="i-lucide-receipt" class="h-8 w-8 text-gray-400" />
            </div>
            <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              {{ t('pages.dashboard.credits.noTransactions') }}
            </h3>
            <p class="text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.credits.noTransactionsDescription') }}
            </p>
          </div>
        </UCard>

        <!-- My Requests Tab (Member in individual mode) -->
        <UCard v-else-if="item.value === 'myRequests'" class="mt-4">
          <CreditsMyRequestsList />
        </UCard>

        <!-- Pending Requests Tab (Owner only) -->
        <UCard v-else-if="item.value === 'pendingRequests'" class="mt-4">
          <CreditsPendingRequestsList />
        </UCard>

        <!-- Configuration Tab (Owner only) -->
        <div v-else-if="item.value === 'configuration'" class="mt-4 space-y-4">
          <!-- Credit Mode Selector -->
          <CreditsCreditModeSelector
            :current-mode="creditMode"
            @update:mode="handleModeChange"
          />

          <!-- Global Auto-Refill Settings (individual mode only) -->
          <CreditsGlobalAutoRefillCard
            v-if="canConfigureGlobalAutoRefill && isIndividualMode"
            @success="handleCreditsChange"
          />
        </div>

        <!-- Members Tab -->
        <UCard v-else-if="item.value === 'members' && showMemberManagement" class="mt-4">
          <CreditsMemberCreditsTable
            :members="memberCredits"
            @distribute="openDistributeModal"
            @recover="openRecoverModal"
            @configure-refill="openAutoRefillModal"
            @view-history="openHistoryModal"
          />
        </UCard>
      </template>
    </UTabs>

    <!-- Modals -->
    <CreditsRequestCreditsModal
      v-model:open="requestCreditsModalOpen"
      :current-balance="credits"
      :type="requestType"
      @success="handleRequestSuccess"
    />

    <CreditsDistributeCreditsModal
      v-model:open="distributeModalOpen"
      :member="selectedMember"
      :organization-credits="organizationCredits"
      @success="handleCreditsChange"
    />

    <CreditsRecoverCreditsModal
      v-model:open="recoverModalOpen"
      :member="selectedMember"
      @success="handleCreditsChange"
    />

    <CreditsAutoRefillConfigModal
      v-model:open="autoRefillModalOpen"
      :member="selectedMember"
      @success="handleCreditsChange"
    />

    <CreditsMemberHistoryModal
      v-model:open="historyModalOpen"
      :member="selectedMember"
    />
  </div>
</template>

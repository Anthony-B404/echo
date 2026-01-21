<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const { t, locale } = useI18n()

useSeoMeta({
  title: t('seo.credits.title'),
  description: t('seo.credits.description')
})
const localePath = useLocalePath()
const creditsStore = useCreditsStore()
const { credits, transactions, loading } = storeToRefs(creditsStore)
const { fetchBalance, fetchHistory } = creditsStore

onMounted(async () => {
  await Promise.all([fetchBalance(), fetchHistory()])
})

function getTransactionIcon (type: string) {
  switch (type) {
    case 'usage':
      return 'i-lucide-activity'
    case 'purchase':
      return 'i-lucide-credit-card'
    case 'bonus':
      return 'i-lucide-sparkles'
    case 'refund':
      return 'i-lucide-refresh-cw'
    default:
      return 'i-lucide-circle'
  }
}

function getTransactionColor (type: string) {
  switch (type) {
    case 'usage':
      return 'text-slate-500 dark:text-slate-400'
    case 'purchase':
    case 'bonus':
    case 'refund':
      return 'text-indigo-500 dark:text-indigo-400'
    default:
      return 'text-gray-500'
  }
} function getTransactionBg (type: string) {
  switch (type) {
    case 'usage':
      return 'bg-slate-100 dark:bg-slate-800'
    case 'purchase':
    case 'bonus':
    case 'refund':
      return 'bg-indigo-50 dark:bg-indigo-900/30'
    default:
      return 'bg-gray-100 dark:bg-gray-800'
  }
}

function formatDate (dateString: string) {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getUserDisplayName (tx: typeof transactions.value[0]) {
  if (!tx.user) return null
  if (tx.user.fullName) return tx.user.fullName
  if (tx.user.firstName || tx.user.lastName) {
    return [tx.user.firstName, tx.user.lastName].filter(Boolean).join(' ')
  }
  return tx.user.email
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ t('pages.dashboard.credits.title') }}
        </h1>
        <p class="mt-1 text-gray-500 dark:text-gray-400">
          {{ t('pages.dashboard.credits.subtitle') }}
        </p>
      </div>
      <UButton
        :to="localePath('/dashboard')"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
      >
        {{ t('pages.dashboard.library.backToWorkshop') }}
      </UButton>
    </div>

    <!-- Balance Card -->
    <UCard class="relative overflow-hidden border-none bg-gray-50/50 dark:bg-slate-800/50">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div class="flex items-center gap-5">
          <div class="flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-gray-800 text-indigo-500">
            <UIcon name="i-lucide-coins" class="w-8 h-8" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.credits.balance') }}
            </p>
            <div class="flex items-baseline gap-2 mt-0.5">
              <span class="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{{ credits }}</span>
              <span class="text-lg font-medium text-gray-500 dark:text-gray-400">{{ t('pages.dashboard.credits.creditsUnit') }}</span>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <UIcon name="i-lucide-info" class="w-3 h-3" />
              {{ t('pages.dashboard.credits.creditInfo') }}
            </p>
          </div>
        </div>
      </div>
      <!-- Decorative background element -->
      <div class="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        <UIcon name="i-lucide-coins" class="w-48 h-48 -rotate-12" />
      </div>
    </UCard>

    <!-- Transaction History -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('pages.dashboard.credits.history') }}
        </h2>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="py-8 text-center">
        <UIcon name="i-lucide-loader-2" class="mx-auto h-8 w-8 animate-spin text-primary-500" />
      </div>

      <!-- Transactions List -->
      <div v-else-if="transactions.length > 0" class="divide-y divide-gray-100 dark:divide-gray-800">
        <div
          v-for="tx in transactions"
          :key="tx.id"
          class="flex items-center justify-between py-4 group hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors px-2 -mx-2 rounded-lg"
        >
          <div class="flex items-center gap-4">
            <div
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-xl transition-transform group-hover:scale-110 duration-200',
                getTransactionBg(tx.type)
              ]"
            >
              <UIcon
                :name="getTransactionIcon(tx.type)"
                :class="['w-5 h-5', getTransactionColor(tx.type)]"
              />
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{ t(`pages.dashboard.credits.transactionTypes.${tx.type}`) }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 max-w-md">
                {{ tx.description || '-' }}
              </p>
              <p v-if="getUserDisplayName(tx)" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ t('pages.dashboard.credits.usedBy', { name: getUserDisplayName(tx) }) }}
              </p>
            </div>
          </div>
          <div class="text-right">
            <p
              :class="[
                'font-bold text-lg',
                tx.amount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
              ]"
            >
              {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
            </p>
            <p class="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">
              {{ formatDate(tx.createdAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="py-12 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
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
  </div>
</template>

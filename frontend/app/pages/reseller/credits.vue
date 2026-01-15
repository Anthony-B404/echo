<script setup lang="ts">
import type { ResellerTransaction, TransactionsFilters, ResellerTransactionType } from '~/types/reseller'

definePageMeta({
  layout: 'reseller',
  middleware: ['auth', 'reseller'],
})

const { t } = useI18n()
const localePath = useLocalePath()

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: t('reseller.navigation.dashboard'), icon: 'i-lucide-home', to: localePath('/reseller') },
  { label: t('reseller.navigation.credits'), icon: 'i-lucide-coins' },
])

useSeoMeta({
  title: t('reseller.credits.title'),
})

// Composables
const { fetchCredits, loading, error } = useResellerProfile()

// State
const creditBalance = ref(0)
const transactions = ref<ResellerTransaction[]>([])
const pagination = ref({
  total: 0,
  perPage: 20,
  currentPage: 1,
  lastPage: 1,
})

// Filters
const typeFilter = ref<ResellerTransactionType | undefined>(undefined)

// Load data
onMounted(async () => {
  await loadCredits()
})

async function loadCredits(page = 1) {
  const filters: TransactionsFilters = {
    page,
    limit: pagination.value.perPage,
    type: typeFilter.value,
  }

  const response = await fetchCredits(filters)
  if (response) {
    creditBalance.value = response.creditBalance
    transactions.value = response.transactions.data
    pagination.value = {
      total: response.transactions.meta.total,
      perPage: response.transactions.meta.perPage,
      currentPage: response.transactions.meta.currentPage,
      lastPage: response.transactions.meta.lastPage,
    }
  }
}

// Watch filters
watch(typeFilter, () => loadCredits(1))

function handlePageChange(page: number) {
  loadCredits(page)
}

// Filter options
const typeOptions = [
  { label: t('reseller.credits.filters.all'), value: undefined },
  { label: t('reseller.transactions.types.purchase'), value: 'purchase' },
  { label: t('reseller.transactions.types.distribution'), value: 'distribution' },
  { label: t('reseller.transactions.types.adjustment'), value: 'adjustment' },
]
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('reseller.credits.title') }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ t('reseller.credits.subtitle') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading && transactions.length === 0" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Error -->
    <UAlert v-else-if="error" color="error" :title="t('common.error')">
      {{ error }}
    </UAlert>

    <!-- Content -->
    <template v-else>
      <!-- Balance card -->
      <UCard>
        <div class="text-center py-8">
          <div class="text-5xl font-bold text-primary-500 mb-2">
            {{ creditBalance.toLocaleString() }}
          </div>
          <div class="text-lg text-gray-500">{{ t('reseller.credits.availableCredits') }}</div>
          <p class="mt-4 text-sm text-gray-400">
            {{ t('reseller.credits.purchaseInfo') }}
          </p>
        </div>
      </UCard>

      <!-- Transactions -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ t('reseller.credits.transactionHistory') }}</h2>
            <USelect
              v-model="typeFilter"
              :items="typeOptions"
              value-key="value"
              :placeholder="t('reseller.credits.filters.type')"
              class="w-40"
            />
          </div>
        </template>

        <ResellerTransactionHistory
          :transactions="transactions"
          :loading="loading"
          show-organization
        />

        <!-- Pagination -->
        <div
          v-if="pagination.lastPage > 1"
          class="flex justify-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-4"
        >
          <UPagination
            :default-page="pagination.currentPage"
            :total="pagination.total"
            :items-per-page="pagination.perPage"
            @update:page="handlePageChange"
          />
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CreditRequestStatus } from '~/types/creditRequest'

const { t, locale } = useI18n()

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
const creditRequestsStore = useCreditRequestsStore()

const loading = ref(false)
const statusFilter = ref<string>('all')

// Fetch my requests on mount
onMounted(async () => {
  loading.value = true
  try {
    await creditRequestsStore.fetchMyRequests(1, 50, statusFilter.value !== 'all' ? statusFilter.value : undefined)
  }
  finally {
    loading.value = false
  }
})

// Refetch when filter changes
watch(statusFilter, async (newStatus) => {
  loading.value = true
  try {
    await creditRequestsStore.fetchMyRequests(1, 50, newStatus !== 'all' ? newStatus : undefined)
  }
  finally {
    loading.value = false
  }
})

const statusOptions = [
  { value: 'all', label: t('reseller.credits.filters.all') },
  { value: 'pending', label: t('pages.dashboard.credits.requests.status.pending') },
  { value: 'approved', label: t('pages.dashboard.credits.requests.status.approved') },
  { value: 'rejected', label: t('pages.dashboard.credits.requests.status.rejected') },
]

function getStatusColor(status: CreditRequestStatus): 'warning' | 'success' | 'error' {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    default:
      return 'warning'
  }
}

function getProcessedByName(request: { processedBy?: { fullName?: string | null, firstName?: string | null, lastName?: string | null, email: string } | null }): string {
  if (!request.processedBy) return ''
  if (request.processedBy.fullName) {
    return request.processedBy.fullName
  }
  if (request.processedBy.firstName || request.processedBy.lastName) {
    return `${request.processedBy.firstName ?? ''} ${request.processedBy.lastName ?? ''}`.trim()
  }
  return request.processedBy.email
}
</script>

<template>
  <div class="space-y-4">
    <!-- Filter -->
    <div class="flex justify-end">
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        class="w-40"
      />
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-gray-400" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="creditRequestsStore.myRequests.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
    >
      <UIcon name="i-lucide-file-text" class="mx-auto size-12 text-gray-400" />
      <h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ t('pages.dashboard.credits.requests.noRequests') }}
      </h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ t('pages.dashboard.credits.requests.noRequestsDescription') }}
      </p>
    </div>

    <!-- Requests list -->
    <div v-else class="space-y-3">
      <div
        v-for="request in creditRequestsStore.myRequests"
        :key="request.id"
        class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <span class="text-lg font-semibold">
                {{ request.amount }} {{ t('common.credits') }}
              </span>
              <UBadge :color="getStatusColor(request.status)" variant="subtle">
                {{ t(`pages.dashboard.credits.requests.status.${request.status}`) }}
              </UBadge>
            </div>

            <p class="mt-1 text-xs text-gray-500">
              {{ t(`pages.dashboard.credits.requests.type.${request.type}`) }}
              · {{ formatDate(request.createdAt) }}
            </p>

            <!-- Justification -->
            <p
              v-if="request.justification"
              class="mt-2 text-sm text-gray-600 dark:text-gray-400"
            >
              {{ request.justification }}
            </p>

            <!-- Processed info -->
            <div v-if="request.status !== 'pending' && request.processedAt" class="mt-3 text-sm">
              <p class="text-gray-500">
                {{ t('pages.dashboard.credits.requests.columns.processedBy') }}:
                <span class="text-gray-700 dark:text-gray-300">{{ getProcessedByName(request) }}</span>
                · {{ formatDate(request.processedAt!) }}
              </p>

              <!-- Rejection reason -->
              <p v-if="request.status === 'rejected' && request.rejectionReason" class="mt-1">
                <span class="text-gray-500">{{ t('pages.dashboard.credits.requests.columns.rejectionReason') }}:</span>
                <span class="ml-1 text-error-600 dark:text-error-400">{{ request.rejectionReason }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

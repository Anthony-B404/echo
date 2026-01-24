<script setup lang="ts">
import type { CreditRequest } from '~/types/creditRequest'

const { t, locale } = useI18n()
const toast = useToast()
const creditRequestsStore = useCreditRequestsStore()
const creditsStore = useCreditsStore()

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const loading = ref(false)
const approvingId = ref<number | null>(null)
const rejectModalOpen = ref(false)
const selectedRequest = ref<CreditRequest | null>(null)

// Fetch pending requests on mount
onMounted(async () => {
  loading.value = true
  try {
    await creditRequestsStore.fetchPendingRequests()
  }
  finally {
    loading.value = false
  }
})

function getRequesterName(request: CreditRequest): string {
  if (!request.requester) return ''
  if (request.requester.fullName) {
    return request.requester.fullName
  }
  if (request.requester.firstName || request.requester.lastName) {
    return `${request.requester.firstName ?? ''} ${request.requester.lastName ?? ''}`.trim()
  }
  return request.requester.email
}

async function approveRequest(request: CreditRequest) {
  approvingId.value = request.id
  try {
    await creditRequestsStore.approveRequest(request.id)

    toast.add({
      title: t('common.messages.success'),
      description: t('pages.dashboard.credits.requests.approve.success', { amount: request.amount }),
      color: 'success',
    })

    // Refresh credits balance
    await creditsStore.fetchBalance()
  }
  catch {
    toast.add({
      title: t('common.error'),
      description: t('pages.dashboard.credits.requests.approve.error'),
      color: 'error',
    })
  }
  finally {
    approvingId.value = null
  }
}

function openRejectModal(request: CreditRequest) {
  selectedRequest.value = request
  rejectModalOpen.value = true
}

async function onRejectSuccess() {
  // Refresh credits balance
  await creditsStore.fetchBalance()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-gray-400" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="creditRequestsStore.pendingRequests.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
    >
      <UIcon name="i-lucide-inbox" class="mx-auto size-12 text-gray-400" />
      <h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ t('pages.dashboard.credits.requests.noPendingRequests') }}
      </h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ t('pages.dashboard.credits.requests.noPendingRequestsDescription') }}
      </p>
    </div>

    <!-- Requests list -->
    <div v-else class="space-y-3">
      <div
        v-for="request in creditRequestsStore.pendingRequests"
        :key="request.id"
        class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      >
        <div class="flex items-start gap-4">
          <!-- Requester info -->
          <UAvatar
            :src="request.requester?.avatar || undefined"
            :alt="getRequesterName(request)"
            size="md"
          />

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ getRequesterName(request) }}</p>
                <p class="text-sm text-gray-500">{{ request.requester?.email }}</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {{ request.amount }} {{ t('common.credits') }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatDate(request.createdAt) }}
                </p>
              </div>
            </div>

            <!-- Justification -->
            <p
              v-if="request.justification"
              class="mt-2 text-sm text-gray-600 dark:text-gray-400"
            >
              {{ request.justification }}
            </p>
            <p v-else class="mt-2 text-sm italic text-gray-400">
              {{ t('pages.dashboard.credits.requests.noJustification') }}
            </p>

            <!-- Actions -->
            <div class="mt-3 flex gap-2">
              <UButton
                color="primary"
                size="sm"
                :loading="approvingId === request.id"
                :disabled="approvingId !== null"
                @click="approveRequest(request)"
              >
                <UIcon name="i-lucide-check" class="size-4" />
                {{ t('pages.dashboard.credits.requests.approve.confirm') }}
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                :disabled="approvingId !== null"
                @click="openRejectModal(request)"
              >
                <UIcon name="i-lucide-x" class="size-4" />
                {{ t('pages.dashboard.credits.requests.reject.confirm') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject modal -->
    <CreditsRejectRequestModal
      v-model:open="rejectModalOpen"
      :request="selectedRequest"
      @success="onRejectSuccess"
    />
  </div>
</template>

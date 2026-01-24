<script setup lang="ts">
import type { CreditRequest } from '~/types/creditRequest'

const { t, locale } = useI18n()
const toast = useToast()
const creditRequestsStore = useCreditRequestsStore()
const { fetchCredits } = useResellerProfile()

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
const rejectReason = ref('')

// Fetch pending requests on mount
onMounted(async () => {
  loading.value = true
  try {
    await creditRequestsStore.fetchResellerPendingRequests()
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

function getOrganizationName(request: CreditRequest): string {
  return request.organization?.name || '-'
}

async function approveRequest(request: CreditRequest) {
  approvingId.value = request.id
  try {
    await creditRequestsStore.approveResellerRequest(request.id)

    toast.add({
      title: t('common.messages.success'),
      description: t('reseller.creditRequests.approve.success'),
      color: 'success',
    })

    // Refresh credits balance
    await fetchCredits()
  }
  catch (e: unknown) {
    const error = e as { data?: { code?: string } }
    if (error?.data?.code === 'INSUFFICIENT_RESELLER_CREDITS') {
      toast.add({
        title: t('common.error'),
        description: t('reseller.creditRequests.approve.insufficientCredits'),
        color: 'error',
      })
    }
    else {
      toast.add({
        title: t('common.error'),
        description: t('reseller.creditRequests.approve.error'),
        color: 'error',
      })
    }
  }
  finally {
    approvingId.value = null
  }
}

function openRejectModal(request: CreditRequest) {
  selectedRequest.value = request
  rejectModalOpen.value = true
}

async function handleReject(reason?: string) {
  if (!selectedRequest.value) return

  try {
    await creditRequestsStore.rejectResellerRequest(selectedRequest.value.id, { reason })

    toast.add({
      title: t('common.messages.success'),
      description: t('reseller.creditRequests.reject.success'),
      color: 'success',
    })

    rejectModalOpen.value = false
    selectedRequest.value = null
  }
  catch {
    toast.add({
      title: t('common.error'),
      description: t('reseller.creditRequests.reject.error'),
      color: 'error',
    })
  }
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
      v-else-if="creditRequestsStore.resellerPendingRequests.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
    >
      <UIcon name="i-lucide-inbox" class="mx-auto size-12 text-gray-400" />
      <h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ t('reseller.creditRequests.empty') }}
      </h3>
    </div>

    <!-- Requests list -->
    <div v-else class="space-y-3">
      <div
        v-for="request in creditRequestsStore.resellerPendingRequests"
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
                <p class="mt-1 text-xs text-primary-600 dark:text-primary-400">
                  <UIcon name="i-lucide-building-2" class="mr-1 inline size-3" />
                  {{ getOrganizationName(request) }}
                </p>
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
                {{ t('reseller.creditRequests.approve.confirm') }}
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                :disabled="approvingId !== null"
                @click="openRejectModal(request)"
              >
                <UIcon name="i-lucide-x" class="size-4" />
                {{ t('reseller.creditRequests.reject.confirm') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject modal -->
    <UModal
      v-model:open="rejectModalOpen"
      :title="t('reseller.creditRequests.reject.title')"
      :description="t('reseller.creditRequests.reject.description')"
      @update:open="rejectReason = ''"
    >
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ t('reseller.creditRequests.reject.title') }}
              </h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                @click="rejectModalOpen = false"
              />
            </div>
          </template>

          <div v-if="selectedRequest" class="space-y-4">
            <!-- Request summary -->
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{{ getRequesterName(selectedRequest) }}</p>
                  <p class="text-sm text-gray-500">{{ getOrganizationName(selectedRequest) }}</p>
                </div>
                <p class="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {{ selectedRequest.amount }} {{ t('common.credits') }}
                </p>
              </div>
            </div>

            <!-- Reason input -->
            <UFormField :label="t('pages.dashboard.credits.requests.reject.reason')">
              <UTextarea
                id="rejectReason"
                v-model="rejectReason"
                :placeholder="t('pages.dashboard.credits.requests.reject.reasonPlaceholder')"
                :rows="3"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                @click="rejectModalOpen = false"
              >
                {{ t('common.buttons.cancel') }}
              </UButton>
              <UButton
                color="error"
                @click="handleReject(rejectReason)"
              >
                {{ t('reseller.creditRequests.reject.confirm') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

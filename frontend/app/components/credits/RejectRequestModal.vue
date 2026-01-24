<script setup lang="ts">
import type { CreditRequest } from '~/types/creditRequest'

interface Props {
  open: boolean
  request: CreditRequest | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const { t, locale } = useI18n()

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
const toast = useToast()
const creditRequestsStore = useCreditRequestsStore()

const loading = ref(false)
const reason = ref('')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// Reset form when modal opens
watch(isOpen, (open) => {
  if (open) {
    reason.value = ''
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

async function onSubmit() {
  if (!props.request) return

  loading.value = true
  try {
    await creditRequestsStore.rejectRequest(props.request.id, { reason: reason.value || undefined })

    toast.add({
      title: t('common.messages.success'),
      description: t('pages.dashboard.credits.requests.reject.success'),
      color: 'success',
    })

    emit('success')
    isOpen.value = false
  }
  catch {
    toast.add({
      title: t('common.error'),
      description: t('pages.dashboard.credits.requests.reject.error'),
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

function close() {
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('pages.dashboard.credits.requests.reject.title')"
    :description="t('pages.dashboard.credits.requests.reject.description')"
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">
              {{ t('pages.dashboard.credits.requests.reject.title') }}
            </h3>
            <UButton
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              @click="close"
            />
          </div>
        </template>

        <div v-if="request" class="space-y-4">
          <!-- Request details -->
          <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="request.requester?.avatar || undefined"
                :alt="getRequesterName(request)"
                size="md"
              />
              <div class="flex-1">
                <p class="font-medium">{{ getRequesterName(request) }}</p>
                <p class="text-sm text-gray-500">{{ request.requester?.email }}</p>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-gray-500">{{ t('pages.dashboard.credits.requests.columns.amount') }}:</span>
                <span class="ml-1 font-semibold">{{ request.amount }} {{ t('common.credits') }}</span>
              </div>
              <div>
                <span class="text-gray-500">{{ t('pages.dashboard.credits.requests.columns.date') }}:</span>
                <span class="ml-1">{{ formatDate(request.createdAt) }}</span>
              </div>
            </div>
            <div v-if="request.justification" class="mt-3">
              <span class="text-sm text-gray-500">{{ t('pages.dashboard.credits.requests.columns.justification') }}:</span>
              <p class="mt-1 text-sm">{{ request.justification }}</p>
            </div>
          </div>

          <!-- Rejection reason -->
          <UFormField
            :label="t('pages.dashboard.credits.requests.reject.reason')"
            name="reason"
          >
            <UTextarea
              v-model="reason"
              :placeholder="t('pages.dashboard.credits.requests.reject.reasonPlaceholder')"
              :rows="3"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">
              {{ t('common.buttons.cancel') }}
            </UButton>
            <UButton
              color="error"
              :loading="loading"
              @click="onSubmit"
            >
              {{ t('pages.dashboard.credits.requests.reject.confirm') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

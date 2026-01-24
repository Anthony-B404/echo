<script setup lang="ts">
interface Props {
  open: boolean
  currentBalance: number
  type?: 'member_to_owner' | 'owner_to_reseller'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'member_to_owner',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const { t } = useI18n()
const toast = useToast()
const creditRequestsStore = useCreditRequestsStore()

const loading = ref(false)
const form = reactive({
  amount: 0,
  justification: '',
})

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// Reset form when modal opens
watch(isOpen, (open) => {
  if (open) {
    form.amount = 0
    form.justification = ''
  }
})

const isValid = computed(() => {
  return form.amount > 0
})

async function onSubmit() {
  if (!isValid.value) return

  loading.value = true
  try {
    if (props.type === 'owner_to_reseller') {
      await creditRequestsStore.createRequestToReseller({
        amount: form.amount,
        justification: form.justification || undefined,
      })
    }
    else {
      await creditRequestsStore.createRequest({
        amount: form.amount,
        justification: form.justification || undefined,
      })
    }

    toast.add({
      title: t('common.messages.success'),
      description: t('pages.dashboard.credits.requests.create.success'),
      color: 'success',
    })

    emit('success')
    isOpen.value = false
  }
  catch (error: unknown) {
    const apiError = error as { data?: { code?: string } }
    if (apiError.data?.code === 'PENDING_REQUEST_EXISTS') {
      toast.add({
        title: t('common.error'),
        description: t('pages.dashboard.credits.requests.create.pendingExists'),
        color: 'error',
      })
    }
    else {
      toast.add({
        title: t('common.error'),
        description: t('pages.dashboard.credits.requests.create.error'),
        color: 'error',
      })
    }
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
    :title="type === 'owner_to_reseller'
      ? t('pages.dashboard.credits.requests.requestFromReseller')
      : t('pages.dashboard.credits.requests.requestCredits')"
    :description="t('pages.dashboard.credits.requests.form.description')"
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">
              {{ type === 'owner_to_reseller'
                ? t('pages.dashboard.credits.requests.requestFromReseller')
                : t('pages.dashboard.credits.requests.requestCredits') }}
            </h3>
            <UButton
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              @click="close"
            />
          </div>
        </template>

        <div class="space-y-4">
          <!-- Current balance info -->
          <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p class="text-sm text-gray-500">
              {{ t('pages.dashboard.credits.requests.form.currentBalance') }}
            </p>
            <p class="text-lg font-semibold">
              {{ currentBalance }} {{ t('common.credits') }}
            </p>
          </div>

          <!-- Form -->
          <div class="space-y-4">
            <UFormField
              :label="t('pages.dashboard.credits.requests.form.amount')"
              name="amount"
              required
            >
              <UInput
                v-model.number="form.amount"
                type="number"
                :min="1"
                :placeholder="t('pages.dashboard.credits.requests.form.amountPlaceholder')"
              />
            </UFormField>

            <UFormField
              :label="t('pages.dashboard.credits.requests.form.justification')"
              name="justification"
            >
              <UTextarea
                v-model="form.justification"
                :placeholder="t('pages.dashboard.credits.requests.form.justificationPlaceholder')"
                :rows="3"
              />
            </UFormField>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">
              {{ t('common.buttons.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              :disabled="!isValid"
              @click="onSubmit"
            >
              {{ t('pages.dashboard.credits.requests.form.submit') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
  creditsRequired: number
  creditsAvailable: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const { isOwner } = useSettingsPermissions()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// Determine request type based on user role
const requestType = computed(() => isOwner.value ? 'owner_to_reseller' : 'member_to_owner')

// Show request credits modal
const showRequestModal = ref(false)

function openRequestModal() {
  showRequestModal.value = true
}

function onRequestSuccess() {
  isOpen.value = false
}

function close() {
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('pages.dashboard.credits.insufficientCreditsModal.title')"
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/30">
                <UIcon name="i-lucide-coins" class="h-5 w-5 text-error-500" />
              </div>
              <h3 class="text-base font-semibold">
                {{ t('pages.dashboard.credits.insufficientCreditsModal.title') }}
              </h3>
            </div>
            <UButton
              variant="ghost"
              icon="i-lucide-x"
              size="sm"
              @click="close"
            />
          </div>
        </template>

        <div class="space-y-4">
          <!-- Credits deficit info -->
          <p class="text-gray-600 dark:text-gray-400">
            {{ t('pages.dashboard.credits.insufficientCreditsModal.message') }}
          </p>

          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-sm text-gray-500">
                {{ t('pages.dashboard.credits.insufficientCreditsModal.required') }}
              </p>
              <p class="text-lg font-semibold text-error-500">
                {{ creditsRequired }} {{ t('common.credits') }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-sm text-gray-500">
                {{ t('pages.dashboard.credits.insufficientCreditsModal.available') }}
              </p>
              <p class="text-lg font-semibold">
                {{ creditsAvailable }} {{ t('common.credits') }}
              </p>
            </div>
          </div>

          <!-- Request info based on role -->
          <UAlert
            :title="isOwner
              ? t('pages.dashboard.credits.insufficientCreditsModal.requestToResellerHint')
              : t('pages.dashboard.credits.insufficientCreditsModal.requestToOwnerHint')"
            color="info"
            icon="i-lucide-info"
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">
              {{ t('common.buttons.cancel') }}
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-send"
              @click="openRequestModal"
            >
              {{ isOwner
                ? t('pages.dashboard.credits.insufficientCreditsModal.requestToReseller')
                : t('pages.dashboard.credits.insufficientCreditsModal.requestToOwner') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Request Credits Modal -->
  <CreditsRequestCreditsModal
    v-model:open="showRequestModal"
    :current-balance="creditsAvailable"
    :type="requestType"
    @success="onRequestSuccess"
  />
</template>

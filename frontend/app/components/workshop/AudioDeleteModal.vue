<script setup lang="ts">
import type { Audio } from '~/types/audio'

defineProps<{
  audio: Audio | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: []
}>()

const { t } = useI18n()
const deleting = ref(false)

async function handleConfirm () {
  deleting.value = true
  emit('confirm')
}

watch(open, (isOpen) => {
  if (!isOpen) {
    deleting.value = false
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('components.workshop.deleteModal.title')"
    :description="t('components.workshop.deleteModal.description', { name: audio?.title || audio?.fileName })"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton
        :label="t('common.buttons.cancel')"
        color="neutral"
        variant="outline"
        :disabled="deleting"
        @click="open = false"
      />
      <UButton
        :label="t('common.buttons.delete')"
        color="error"
        :loading="deleting"
        @click="handleConfirm"
      />
    </template>
  </UModal>
</template>

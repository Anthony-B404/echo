<script setup lang="ts">
import type { EditConflict } from '~/types/transcription'

defineProps<{
  conflict: EditConflict
}>()

const emit = defineEmits<{
  refresh: []
  dismiss: []
}>()

const { t } = useI18n()
const { formatRelativeTime } = useFormatters()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-alert-triangle"
    :title="t('components.workshop.conflict.title')"
  >
    <template #description>
      <p class="mb-2">
        {{ t('components.workshop.conflict.description') }}
      </p>
      <p v-if="conflict.lastEditedBy" class="text-sm text-muted mb-3">
        {{ t('components.workshop.conflict.editedBy', {
          name: conflict.lastEditedBy.fullName || conflict.lastEditedBy.email || t('common.unknown'),
          time: conflict.lastEditedAt ? formatRelativeTime(conflict.lastEditedAt) : t('common.unknown')
        }) }}
      </p>
      <div class="flex gap-2">
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-refresh-cw"
          :label="t('components.workshop.conflict.refresh')"
          @click="emit('refresh')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :label="t('components.workshop.conflict.dismiss')"
          @click="emit('dismiss')"
        />
      </div>
    </template>
  </UAlert>
</template>

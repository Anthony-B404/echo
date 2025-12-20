<script setup lang="ts">
import type { JobStatus } from '~/types/audio'

const props = defineProps<{
  status: JobStatus
}>()

const { t } = useI18n()

const progressLabel = computed(() => {
  switch (props.status.status) {
    case 'pending':
      return t('components.workshop.processing.pending')
    case 'processing':
      return t('components.workshop.processing.analyzing', { progress: props.status.progress })
    case 'completed':
      return t('components.workshop.processing.completed')
    case 'failed':
      return t('components.workshop.processing.failed')
    default:
      return ''
  }
})

const progressColor = computed(() => {
  switch (props.status.status) {
    case 'pending':
      return 'neutral'
    case 'processing':
      return 'primary'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'neutral'
  }
})

const progressValue = computed(() => {
  if (props.status.status === 'completed') return 100
  if (props.status.status === 'failed') return 100
  return props.status.progress
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ progressLabel }}</span>
      <span v-if="status.status === 'processing'" class="text-highlighted font-medium">
        {{ status.progress }}%
      </span>
    </div>

    <UProgress
      :model-value="progressValue"
      :color="progressColor"
      :animation="status.status === 'processing' ? 'carousel' : undefined"
    />

    <UAlert
      v-if="status.status === 'failed' && status.error"
      color="error"
      variant="subtle"
      :title="t('components.workshop.processing.errorTitle')"
      :description="status.error"
      icon="i-lucide-alert-circle"
    />
  </div>
</template>

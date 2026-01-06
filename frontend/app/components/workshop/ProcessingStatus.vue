<script setup lang="ts">
import { AudioStatus } from '~/types/audio'
import type { JobStatus } from '~/types/audio'

const props = defineProps<{
  status: JobStatus
}>()

const { t } = useI18n()

const progressLabel = computed(() => {
  switch (props.status.status) {
    case 'uploading':
      return t('components.workshop.processing.uploading')
    case AudioStatus.Pending:
      return t('components.workshop.processing.pending')
    case AudioStatus.Processing: {
      const progress = props.status.progress
      // Dynamic labels based on progress stage
      if (progress < 2) return t('components.workshop.processing.starting')
      if (progress < 12) return t('components.workshop.processing.converting')
      if (progress < 17) return t('components.workshop.processing.analyzing_metadata')
      if (progress < 72) return t('components.workshop.processing.transcribing', { progress })
      if (progress < 92) return t('components.workshop.processing.analyzing')
      return t('components.workshop.processing.finalizing')
    }
    case AudioStatus.Completed:
      return t('components.workshop.processing.completed')
    case AudioStatus.Failed:
      return t('components.workshop.processing.failed')
    default:
      return ''
  }
})

const progressColor = computed(() => {
  switch (props.status.status) {
    case 'uploading':
      return 'primary'
    case AudioStatus.Pending:
      return 'neutral'
    case AudioStatus.Processing:
      return 'primary'
    case AudioStatus.Completed:
      return 'success'
    case AudioStatus.Failed:
      return 'error'
    default:
      return 'neutral'
  }
})

// Use indeterminate for uploading state (no real progress tracking)
const isIndeterminate = computed(() => props.status.status === 'uploading')

const progressValue = computed(() => {
  if (props.status.status === 'uploading') return undefined // Indeterminate
  if (props.status.status === AudioStatus.Completed) return 100
  if (props.status.status === AudioStatus.Failed) return 100
  return props.status.progress
})

// Computed helpers for template
const isProcessing = computed(() => props.status.status === AudioStatus.Processing)
const isUploading = computed(() => props.status.status === 'uploading')
const isFailed = computed(() => props.status.status === AudioStatus.Failed)
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ progressLabel }}</span>
      <span v-if="isProcessing" class="text-highlighted font-medium">
        {{ status.progress }}%
      </span>
    </div>

    <UProgress
      :model-value="progressValue"
      :color="progressColor"
      :animation="isUploading || isProcessing ? 'carousel' : undefined"
    />

    <UAlert
      v-if="isFailed && status.error"
      color="error"
      variant="subtle"
      :title="t('components.workshop.processing.errorTitle')"
      :description="status.error"
      icon="i-lucide-alert-circle"
    />
  </div>
</template>

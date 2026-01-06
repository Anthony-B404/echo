<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { AudioStatus } from '~/types/audio'
import type { Audio } from '~/types/audio'

const props = defineProps<{
  audio: Audio
  selected?: boolean
  progress?: number
}>()

const emit = defineEmits<{
  click: []
  delete: []
}>()

const { t, locale } = useI18n()
const audioStore = useAudioStore()

const dateLocale = computed(() => (locale.value === 'fr' ? fr : enUS))

const isProcessing = computed(
  () =>
    audioStore.isAudioProcessing(props.audio.id) ||
    props.audio.status === AudioStatus.Pending ||
    props.audio.status === AudioStatus.Processing
)

const statusConfig = computed(() => {
  const configs: Record<AudioStatus, { color: string; icon: string; label: string }> = {
    [AudioStatus.Pending]: {
      color: 'neutral',
      icon: 'i-lucide-clock',
      label: t('components.workshop.status.pending'),
    },
    [AudioStatus.Processing]: {
      color: 'primary',
      icon: 'i-lucide-loader-2',
      label: t('components.workshop.status.processing'),
    },
    [AudioStatus.Completed]: {
      color: 'success',
      icon: 'i-lucide-check-circle',
      label: t('components.workshop.status.completed'),
    },
    [AudioStatus.Failed]: {
      color: 'error',
      icon: 'i-lucide-x-circle',
      label: t('components.workshop.status.failed'),
    },
  }
  return configs[props.audio.status]
})

// Expose enum for template usage
const isCompleted = computed(() => props.audio.status === AudioStatus.Completed)
const isFailed = computed(() => props.audio.status === AudioStatus.Failed)
const isProcessingStatus = computed(() => props.audio.status === AudioStatus.Processing)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div
    class="group relative p-4 rounded-lg border transition-all cursor-pointer"
    :class="[
      selected
        ? 'border-primary bg-primary/5'
        : 'border-default hover:border-primary/50 hover:bg-elevated/50',
    ]"
    @click="emit('click')"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div
        class="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
        :class="isCompleted ? 'bg-primary/10' : 'bg-elevated'"
      >
        <UIcon
          :name="isProcessing ? 'i-lucide-loader-2' : 'i-lucide-music'"
          class="w-6 h-6"
          :class="[
            isProcessing ? 'animate-spin text-primary' : '',
            isCompleted ? 'text-primary' : 'text-muted',
          ]"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="text-highlighted font-medium truncate">
            {{ audio.title || audio.fileName }}
          </h3>
          <UBadge :color="statusConfig.color" variant="subtle" size="xs">
            <UIcon
              :name="statusConfig.icon"
              class="w-3 h-3 mr-1"
              :class="isProcessingStatus ? 'animate-spin' : ''"
            />
            {{ statusConfig.label }}
          </UBadge>
        </div>

        <div class="flex items-center gap-3 text-sm text-muted">
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
            {{ formatDuration(audio.duration) }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-hard-drive" class="w-3.5 h-3.5" />
            {{ formatFileSize(audio.fileSize) }}
          </span>
          <span>
            {{
              formatDistanceToNow(new Date(audio.createdAt), {
                addSuffix: true,
                locale: dateLocale,
              })
            }}
          </span>
        </div>

        <!-- Error message -->
        <p
          v-if="isFailed && audio.errorMessage"
          class="mt-2 text-sm text-error truncate"
        >
          {{ audio.errorMessage }}
        </p>

        <!-- Progress bar for processing items -->
        <div v-if="isProcessing && props.progress !== undefined" class="mt-2">
          <div class="flex items-center gap-2">
            <UProgress
              :model-value="props.progress"
              color="primary"
              size="xs"
              class="flex-1"
            />
            <span class="text-xs text-muted w-8 text-right">{{ props.progress }}%</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          @click.stop="emit('delete')"
        />
      </div>
    </div>
  </div>
</template>

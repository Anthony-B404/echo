<script setup lang="ts">
import { AudioStatus } from '~/types/audio'
import type { Audio } from '~/types/audio'

const props = defineProps<{
  audios: Audio[]
  loading?: boolean
  selectedId?: number | null
}>()

const emit = defineEmits<{
  select: [audio: Audio]
  delete: [audio: Audio]
  'load-more': []
}>()

const { t } = useI18n()
const audioStore = useAudioStore()

const statusFilter = ref<AudioStatus | 'all'>('all')

const filteredAudios = computed(() => {
  if (statusFilter.value === 'all') return props.audios
  return props.audios.filter((a) => a.status === statusFilter.value)
})

const hasMore = computed(() => audioStore.hasMore)

const statusOptions = computed(() => [
  { label: t('components.workshop.filters.all'), value: 'all' },
  { label: t('components.workshop.filters.completed'), value: AudioStatus.Completed },
  { label: t('components.workshop.filters.processing'), value: AudioStatus.Processing },
  { label: t('components.workshop.filters.failed'), value: AudioStatus.Failed },
])

/**
 * Get progress for a specific audio from the store
 * Returns undefined if the audio is not currently being processed
 */
function getProgressForAudio(audio: Audio): number | undefined {
  // Only show progress for pending or processing audios with a job
  if (!audio.currentJobId) return undefined
  if (audio.status !== AudioStatus.Pending && audio.status !== AudioStatus.Processing) return undefined

  const jobStatus = audioStore.getJobStatus(audio.currentJobId)
  return jobStatus?.progress
}
</script>

<template>
  <UCard
    class="transition-all duration-300 hover:-translate-y-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-2 hover:ring-primary-500/50 dark:hover:ring-primary-400/50 shadow-lg hover:shadow-xl dark:shadow-none"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-lucide-library" class="text-primary-500" />
          {{ t('components.workshop.list.title') }}
        </h3>
        <div class="flex items-center gap-2">
          <UBadge color="neutral" variant="subtle">
            {{ audioStore.pagination.total }}
          </UBadge>
          <USelect v-model="statusFilter" :items="statusOptions" size="sm" class="w-40" />
        </div>
      </div>
    </template>

    <!-- Loading state -->
    <div v-if="loading && audios.length === 0" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-lg" />
    </div>

    <!-- Empty state -->
    <WorkshopEmptyState
      v-else-if="audios.length === 0"
      :title="t('components.workshop.list.emptyTitle')"
      :description="t('components.workshop.list.emptyDescription')"
      icon="i-lucide-music"
    />

    <!-- Audio list -->
    <div v-else class="space-y-2">
      <WorkshopAudioCard
        v-for="audio in filteredAudios"
        :key="audio.id"
        :audio="audio"
        :selected="selectedId === audio.id"
        :progress="getProgressForAudio(audio)"
        @click="emit('select', audio)"
        @delete="emit('delete', audio)"
      />

      <!-- Load more -->
      <div v-if="hasMore" class="pt-4 text-center">
        <UButton
          :label="t('common.buttons.loadMore')"
          color="neutral"
          variant="ghost"
          :loading="loading"
          @click="emit('load-more')"
        />
      </div>
    </div>
  </UCard>
</template>

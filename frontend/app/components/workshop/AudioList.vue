<script setup lang="ts">
import type { Audio, AudioStatus } from '~/types/audio'

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
  { label: t('components.workshop.filters.completed'), value: 'completed' },
  { label: t('components.workshop.filters.processing'), value: 'processing' },
  { label: t('components.workshop.filters.failed'), value: 'failed' },
])
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">
        {{ t('components.workshop.list.title') }}
        <UBadge color="neutral" variant="subtle" class="ml-2">
          {{ audioStore.pagination.total }}
        </UBadge>
      </h2>

      <USelect v-model="statusFilter" :items="statusOptions" size="sm" class="w-40" />
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { AudioStatus } from '~/types/audio'
import type { Audio } from '~/types/audio'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const { t } = useI18n()

useSeoMeta({
  title: t('seo.library.title'),
  description: t('seo.library.description')
})
const toast = useToast()
const localePath = useLocalePath()
const audioStore = useAudioStore()

// State
const searchQuery = ref('')
const sortBy = ref<'createdAt' | 'title' | 'duration' | 'status'>('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')
const statusFilter = ref<AudioStatus | null>(null)
const selectedIds = ref<number[]>([])
const deleteModalOpen = ref(false)
const batchDeleteLoading = ref(false)
const singleDeleteAudio = ref<Audio | null>(null)
const singleDeleteModalOpen = ref(false)

// Debounced search
const debouncedSearch = useDebounceFn(() => {
  loadAudios()
}, 300)

// Watch search input
watch(searchQuery, () => {
  debouncedSearch()
})

// Status filter options
const statusOptions = computed(() => [
  { label: t('components.workshop.filters.all'), value: null },
  { label: t('components.workshop.filters.completed'), value: AudioStatus.Completed },
  { label: t('components.workshop.filters.processing'), value: AudioStatus.Processing },
  { label: t('components.workshop.filters.failed'), value: AudioStatus.Failed }
])

// Sort options
const sortOptions = computed(() => [
  { label: t('pages.dashboard.library.sort.date'), value: 'createdAt' },
  { label: t('pages.dashboard.library.sort.title'), value: 'title' },
  { label: t('pages.dashboard.library.sort.duration'), value: 'duration' }
])

// Load audios with current filters
async function loadAudios (page = 1, append = false) {
  await audioStore.fetchAudios(page, {
    search: searchQuery.value || undefined,
    sort: sortBy.value,
    order: sortOrder.value,
    status: statusFilter.value || undefined,
    append
  })
}

// Handle sort change from table
function handleSort ({ column, order }: { column: string; order: 'asc' | 'desc' }) {
  sortBy.value = column as typeof sortBy.value
  sortOrder.value = order
  loadAudios()
}

// Handle status filter change
function handleStatusChange (status: AudioStatus | null) {
  statusFilter.value = status
  loadAudios()
}

// Handle sort dropdown change
function handleSortChange (value: string) {
  sortBy.value = value as typeof sortBy.value
  loadAudios()
}

// Toggle sort order
function toggleSortOrder () {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  loadAudios()
}

// Handle audio selection (navigate to detail)
function handleSelectAudio (audio: Audio) {
  navigateTo(localePath(`/dashboard/${audio.id}`))
}

// Handle single delete request
function handleDeleteRequest (audio: Audio) {
  singleDeleteAudio.value = audio
  singleDeleteModalOpen.value = true
}

// Handle title update
async function handleUpdateTitle ({ audio, title }: { audio: Audio; title: string }) {
  const success = await audioStore.updateAudio(audio.id, title)

  if (success) {
    toast.add({
      title: t('pages.dashboard.library.titleUpdated'),
      color: 'success'
    })
  } else {
    toast.add({
      title: t('pages.dashboard.library.titleUpdateError'),
      color: 'error'
    })
  }
}

// Handle single delete confirm
async function handleSingleDeleteConfirm () {
  if (!singleDeleteAudio.value) { return }

  const success = await audioStore.deleteAudio(singleDeleteAudio.value.id)

  if (success) {
    toast.add({
      title: t('pages.dashboard.workshop.deleteSuccess'),
      color: 'success'
    })
    // Remove from selection if selected
    selectedIds.value = selectedIds.value.filter(id => id !== singleDeleteAudio.value?.id)
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.deleteError'),
      color: 'error'
    })
  }

  singleDeleteModalOpen.value = false
  singleDeleteAudio.value = null
}

// Handle batch delete
function handleBatchDeleteRequest () {
  if (selectedIds.value.length === 0) { return }
  deleteModalOpen.value = true
}

// Handle batch delete confirm
async function handleBatchDeleteConfirm () {
  batchDeleteLoading.value = true

  const result = await audioStore.deleteMultiple(selectedIds.value)

  if (result.success) {
    toast.add({
      title: t('pages.dashboard.library.batchDeleteSuccess', { count: result.deletedCount }),
      color: 'success'
    })
    selectedIds.value = []
  } else {
    toast.add({
      title: t('pages.dashboard.library.batchDeleteError'),
      color: 'error'
    })
  }

  batchDeleteLoading.value = false
  deleteModalOpen.value = false
}

// Load more
async function handleLoadMore () {
  await loadAudios(audioStore.pagination.currentPage + 1, true)
}

// Initial load
onMounted(() => {
  loadAudios()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ t('pages.dashboard.library.title') }}
        </h1>
        <p class="mt-1 text-muted">
          {{ t('pages.dashboard.library.description') }}
        </p>
      </div>
      <UButton
        :to="localePath('/dashboard')"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        class="self-start sm:self-auto"
      >
        {{ t('pages.dashboard.library.backToWorkshop') }}
      </UButton>
    </div>

    <!-- Filters bar -->
    <UCard class="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <!-- Search input -->
        <div class="w-full sm:flex-1 sm:min-w-[200px]">
          <UInput
            v-model="searchQuery"
            :placeholder="t('pages.dashboard.library.search')"
            icon="i-lucide-search"
            size="md"
            class="w-full"
          />
        </div>

        <!-- Sort + Status row -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <USelect
            :model-value="sortBy"
            :items="sortOptions"
            size="md"
            class="flex-1 sm:flex-initial sm:w-32"
            @update:model-value="handleSortChange"
          />
          <UButton
            :icon="sortOrder === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
            color="neutral"
            variant="ghost"
            size="md"
            @click="toggleSortOrder"
          />
          <USelect
            :model-value="statusFilter"
            :items="statusOptions"
            :placeholder="t('components.workshop.filters.all')"
            size="md"
            class="flex-1 sm:flex-initial sm:w-36"
            @update:model-value="handleStatusChange"
          />
        </div>
      </div>
    </UCard>

    <!-- Selection bar -->
    <div
      v-if="selectedIds.length > 0"
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-3"
    >
      <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
        {{ t('pages.dashboard.library.selected', { count: selectedIds.length }) }}
      </span>
      <UButton
        color="error"
        variant="soft"
        size="sm"
        icon="i-lucide-trash-2"
        @click="handleBatchDeleteRequest"
      >
        {{ t('pages.dashboard.library.deleteSelected') }}
      </UButton>
    </div>

    <!-- Audio table -->
    <UCard class="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <LibraryAudioTable
        v-model:selected-ids="selectedIds"
        :audios="audioStore.audios"
        :loading="audioStore.loading"
        :sort-by="sortBy"
        :sort-order="sortOrder"
        @sort="handleSort"
        @delete="handleDeleteRequest"
        @select="handleSelectAudio"
        @update-title="handleUpdateTitle"
      />

      <!-- Pagination -->
      <div
        v-if="audioStore.audios.length > 0"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4 mt-4"
      >
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('pages.dashboard.library.showing', {
            count: audioStore.audios.length,
            total: audioStore.pagination.total
          }) }}
        </span>

        <UButton
          v-if="audioStore.hasMore"
          :loading="audioStore.loading"
          color="neutral"
          variant="ghost"
          @click="handleLoadMore"
        >
          {{ t('common.buttons.loadMore') }}
        </UButton>
      </div>
    </UCard>

    <!-- Batch delete modal -->
    <LibraryBatchDeleteModal
      v-model:open="deleteModalOpen"
      :count="selectedIds.length"
      :loading="batchDeleteLoading"
      @confirm="handleBatchDeleteConfirm"
    />

    <!-- Single delete modal -->
    <WorkshopAudioDeleteModal
      v-model:open="singleDeleteModalOpen"
      :audio="singleDeleteAudio"
      @confirm="handleSingleDeleteConfirm"
    />
  </div>
</template>

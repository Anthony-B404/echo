<script setup lang="ts">
import { AudioStatus } from '~/types/audio'
import type { Audio } from '~/types/audio'
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

const props = defineProps<{
  audios: Audio[]
  loading?: boolean
  selectedIds: number[]
  sortBy?: 'createdAt' | 'title' | 'duration' | 'status'
  sortOrder?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  'update:selectedIds': [ids: number[]]
  sort: [{ column: string; order: 'asc' | 'desc' }]
  delete: [audio: Audio]
  select: [audio: Audio]
  'update-title': [{ audio: Audio; title: string }]
}>()

// Title editing state
const editingAudioId = ref<number | null>(null)
const editedTitle = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Table columns definition (Nuxt UI 4 uses TanStack Table format)
const columns = computed(() => [
  {
    id: 'select',
    accessorKey: 'select',
    header: '',
    meta: { class: { th: 'w-12', td: 'w-12' } },
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: t('pages.dashboard.library.columns.title'),
    enableSorting: true,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: t('pages.dashboard.library.columns.duration'),
    enableSorting: true,
    meta: { class: { th: 'w-24', td: 'w-24' } },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: t('pages.dashboard.library.columns.status'),
    enableSorting: true,
    meta: { class: { th: 'w-32', td: 'w-32' } },
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: t('pages.dashboard.library.columns.date'),
    enableSorting: true,
    meta: { class: { th: 'w-40', td: 'w-40' } },
  },
  {
    id: 'actions',
    accessorKey: 'actions',
    header: '',
    meta: { class: { th: 'w-16', td: 'w-16' } },
  },
])

// Check if all items are selected
const allSelected = computed(() => {
  if (props.audios.length === 0) return false
  return props.audios.every((a) => props.selectedIds.includes(a.id))
})

// Check if some items are selected (for indeterminate state)
const someSelected = computed(() => {
  return props.selectedIds.length > 0 && !allSelected.value
})

// Toggle all selection
function toggleAll() {
  if (allSelected.value) {
    emit('update:selectedIds', [])
  } else {
    emit('update:selectedIds', props.audios.map((a) => a.id))
  }
}

// Toggle single item selection
function toggleItem(audioId: number) {
  const newSelection = props.selectedIds.includes(audioId)
    ? props.selectedIds.filter((id) => id !== audioId)
    : [...props.selectedIds, audioId]
  emit('update:selectedIds', newSelection)
}

// Handle column sort click
function handleSort(column: string) {
  if (!['title', 'duration', 'status', 'createdAt'].includes(column)) return

  const newOrder =
    props.sortBy === column && props.sortOrder === 'desc' ? 'asc' : 'desc'
  emit('sort', { column, order: newOrder })
}

// Format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format date
function formatDate(dateStr: string): string {
  const dateLocale = locale.value === 'fr' ? fr : enUS
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateLocale })
}

// Status badge config
const statusConfig: Record<AudioStatus, { color: 'neutral' | 'primary' | 'success' | 'error'; icon: string }> = {
  pending: { color: 'neutral', icon: 'i-lucide-clock' },
  processing: { color: 'primary', icon: 'i-lucide-loader-2' },
  completed: { color: 'success', icon: 'i-lucide-check-circle' },
  failed: { color: 'error', icon: 'i-lucide-x-circle' },
}

// Get display title
function getDisplayTitle(audio: Audio): string {
  return audio.title || audio.fileName
}

// Title editing functions
function startEditingTitle(audio: Audio, event: Event) {
  event.stopPropagation()
  editingAudioId.value = audio.id
  editedTitle.value = audio.title || audio.fileName
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelEditingTitle() {
  editingAudioId.value = null
  editedTitle.value = ''
}

function saveTitle(audio: Audio) {
  const newTitle = editedTitle.value.trim()
  if (!newTitle) {
    cancelEditingTitle()
    return
  }

  // Check if title actually changed
  const currentTitle = audio.title || audio.fileName
  if (newTitle !== currentTitle) {
    emit('update-title', { audio, title: newTitle })
  }

  editingAudioId.value = null
  editedTitle.value = ''
}

function handleTitleKeydown(event: KeyboardEvent, audio: Audio) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveTitle(audio)
  } else if (event.key === 'Escape') {
    cancelEditingTitle()
  }
}
</script>

<template>
  <div class="w-full">
    <!-- Loading skeleton -->
    <div v-if="loading && audios.length === 0" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="audios.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <UIcon name="i-lucide-music" class="h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('pages.dashboard.library.empty') }}
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('pages.dashboard.library.emptyDescription') }}
      </p>
    </div>

    <!-- Table -->
    <UTable
      v-else
      :columns="columns"
      :data="audios"
      :loading="loading"
      class="w-full"
      :ui="{
        tr: {
          base: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        },
      }"
      @select="(_e, row) => emit('select', row.original)"
    >
      <!-- Header checkbox -->
      <template #select-header>
        <UCheckbox
          :model-value="allSelected"
          :indeterminate="someSelected"
          @update:model-value="toggleAll"
          @click.stop
        />
      </template>

      <!-- Row checkbox -->
      <template #select-cell="{ row }">
        <div
          class="flex items-center justify-center -m-4 p-4 cursor-pointer"
          @click.stop="toggleItem(row.original.id)"
        >
          <UCheckbox
            :model-value="selectedIds.includes(row.original.id)"
            @update:model-value="toggleItem(row.original.id)"
          />
        </div>
      </template>

      <!-- Title column -->
      <template #title-header>
        <button
          class="flex items-center gap-1 font-medium hover:text-primary-500"
          @click="handleSort('title')"
        >
          {{ t('pages.dashboard.library.columns.title') }}
          <UIcon
            v-if="sortBy === 'title'"
            :name="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
            class="h-4 w-4"
          />
        </button>
      </template>

      <template #title-cell="{ row }">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
            <UIcon
              :name="row.original.status === AudioStatus.Processing ? 'i-lucide-loader-2' : 'i-lucide-music'"
              :class="[
                'h-5 w-5 text-primary-600 dark:text-primary-400',
                row.original.status === AudioStatus.Processing ? 'animate-spin' : ''
              ]"
            />
          </div>

          <!-- Inline editing input -->
          <UInput
            v-if="editingAudioId === row.original.id"
            ref="titleInputRef"
            v-model="editedTitle"
            size="sm"
            class="flex-1 max-w-xs"
            @keydown="(e: KeyboardEvent) => handleTitleKeydown(e, row.original)"
            @blur="saveTitle(row.original)"
            @click.stop
          />

          <!-- Display title (clickable to edit) -->
          <button
            v-else
            class="font-medium text-gray-900 dark:text-white truncate max-w-xs hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left flex items-center gap-1 group"
            :title="t('pages.dashboard.library.clickToRename')"
            @click="(e) => startEditingTitle(row.original, e)"
          >
            <span class="truncate">{{ getDisplayTitle(row.original) }}</span>
            <UIcon
              name="i-lucide-pencil"
              class="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            />
          </button>
        </div>
      </template>

      <!-- Duration column -->
      <template #duration-header>
        <button
          class="flex items-center gap-1 font-medium hover:text-primary-500"
          @click="handleSort('duration')"
        >
          {{ t('pages.dashboard.library.columns.duration') }}
          <UIcon
            v-if="sortBy === 'duration'"
            :name="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
            class="h-4 w-4"
          />
        </button>
      </template>

      <template #duration-cell="{ row }">
        <span class="text-gray-600 dark:text-gray-400">
          {{ formatDuration(row.original.duration) }}
        </span>
      </template>

      <!-- Status column -->
      <template #status-header>
        <button
          class="flex items-center gap-1 font-medium hover:text-primary-500"
          @click="handleSort('status')"
        >
          {{ t('pages.dashboard.library.columns.status') }}
          <UIcon
            v-if="sortBy === 'status'"
            :name="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
            class="h-4 w-4"
          />
        </button>
      </template>

      <template #status-cell="{ row }">
        <UBadge
          :color="statusConfig[row.original.status as AudioStatus]?.color || 'neutral'"
          variant="subtle"
          size="sm"
        >
          <UIcon
            :name="statusConfig[row.original.status as AudioStatus]?.icon || 'i-lucide-circle'"
            :class="[
              'h-3 w-3 mr-1',
              row.original.status === AudioStatus.Processing ? 'animate-spin' : ''
            ]"
          />
          {{ t(`components.workshop.status.${row.original.status}`) }}
        </UBadge>
      </template>

      <!-- Date column -->
      <template #createdAt-header>
        <button
          class="flex items-center gap-1 font-medium hover:text-primary-500"
          @click="handleSort('createdAt')"
        >
          {{ t('pages.dashboard.library.columns.date') }}
          <UIcon
            v-if="sortBy === 'createdAt'"
            :name="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
            class="h-4 w-4"
          />
        </button>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-gray-600 dark:text-gray-400 text-sm">
          {{ formatDate(row.original.createdAt) }}
        </span>
      </template>

      <!-- Actions column -->
      <template #actions-cell="{ row }">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          @click.stop="emit('delete', row.original)"
        />
      </template>
    </UTable>
  </div>
</template>

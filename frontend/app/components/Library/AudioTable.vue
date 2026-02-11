<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { AudioStatus } from '~/types/audio'
import type { Audio } from '~/types/audio'

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

// Mobile card action items
function getCardActionItems (audio: Audio) {
  return [
    [{
      label: t('pages.dashboard.library.clickToRename'),
      icon: 'i-lucide-pencil',
      onSelect: () => {
        editingAudioId.value = audio.id
        editedTitle.value = audio.title || audio.fileName
      }
    }],
    [{
      label: t('common.buttons.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => emit('delete', audio)
    }]
  ]
}

// Table columns definition (Nuxt UI 4 uses TanStack Table format)
const columns = computed(() => [
  {
    id: 'select',
    accessorKey: 'select',
    header: '',
    meta: { class: { th: 'w-12', td: 'w-12' } }
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: t('pages.dashboard.library.columns.title'),
    enableSorting: true
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: t('pages.dashboard.library.columns.duration'),
    enableSorting: true,
    meta: { class: { th: 'hidden sm:table-cell w-24', td: 'hidden sm:table-cell w-24' } }
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: t('pages.dashboard.library.columns.status'),
    enableSorting: true,
    meta: { class: { th: 'hidden md:table-cell w-32', td: 'hidden md:table-cell w-32' } }
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: t('pages.dashboard.library.columns.date'),
    enableSorting: true,
    meta: { class: { th: 'hidden sm:table-cell w-40', td: 'hidden sm:table-cell w-40' } }
  },
  {
    id: 'actions',
    accessorKey: 'actions',
    header: '',
    meta: { class: { th: 'w-12 sm:w-16', td: 'w-12 sm:w-16' } }
  }
])

// Check if all items are selected
const allSelected = computed(() => {
  if (props.audios.length === 0) { return false }
  return props.audios.every(a => props.selectedIds.includes(a.id))
})

// Check if some items are selected (for indeterminate state)
const someSelected = computed(() => {
  return props.selectedIds.length > 0 && !allSelected.value
})

// Toggle all selection
function toggleAll () {
  if (allSelected.value) {
    emit('update:selectedIds', [])
  } else {
    emit('update:selectedIds', props.audios.map(a => a.id))
  }
}

// Toggle single item selection
function toggleItem (audioId: number) {
  const newSelection = props.selectedIds.includes(audioId)
    ? props.selectedIds.filter(id => id !== audioId)
    : [...props.selectedIds, audioId]
  emit('update:selectedIds', newSelection)
}

// Handle column sort click
function handleSort (column: string) {
  if (!['title', 'duration', 'status', 'createdAt'].includes(column)) { return }

  const newOrder =
    props.sortBy === column && props.sortOrder === 'desc' ? 'asc' : 'desc'
  emit('sort', { column, order: newOrder })
}

// Format duration
function formatDuration (seconds: number | null): string {
  if (!seconds) { return '--:--' }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format date
function formatDate (dateStr: string): string {
  const dateLocale = locale.value === 'fr' ? fr : enUS
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateLocale })
}

// Status badge config
const statusConfig: Record<AudioStatus, { color: 'neutral' | 'primary' | 'success' | 'error'; icon: string }> = {
  pending: { color: 'neutral', icon: 'i-lucide-clock' },
  processing: { color: 'primary', icon: 'i-lucide-loader-2' },
  completed: { color: 'success', icon: 'i-lucide-check-circle' },
  failed: { color: 'error', icon: 'i-lucide-x-circle' }
}

// Get display title
function getDisplayTitle (audio: Audio): string {
  return audio.title || audio.fileName
}

// Title editing functions
function startEditingTitle (audio: Audio, event: Event) {
  event.stopPropagation()
  editingAudioId.value = audio.id
  editedTitle.value = audio.title || audio.fileName
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelEditingTitle () {
  editingAudioId.value = null
  editedTitle.value = ''
}

function saveTitle (audio: Audio) {
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

function handleTitleKeydown (event: KeyboardEvent, audio: Audio) {
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
    <UEmpty
      v-else-if="audios.length === 0"
      :title="t('pages.dashboard.library.empty')"
      :description="t('pages.dashboard.library.emptyDescription')"
      icon="i-lucide-music"
      :actions="[{ label: t('pages.dashboard.library.goToWorkshop'), to: localePath('/dashboard'), color: 'primary' as const }]"
    />

    <template v-else>
      <!-- Mobile: Card list -->
      <div class="sm:hidden space-y-2">
        <!-- Select all -->
        <div class="flex items-center gap-2 px-1">
          <UCheckbox
            :model-value="allSelected"
            :indeterminate="someSelected"
            @update:model-value="toggleAll"
          />
          <span class="text-sm text-muted">
            {{ t('pages.dashboard.library.columns.title') }}
          </span>
        </div>

        <div
          v-for="audio in audios"
          :key="audio.id"
          class="flex items-center gap-3 p-3 rounded-lg border border-default cursor-pointer transition-colors hover:bg-elevated/50"
          :class="{ 'border-primary bg-primary/5': selectedIds.includes(audio.id) }"
          @click="emit('select', audio)"
        >
          <UCheckbox
            :model-value="selectedIds.includes(audio.id)"
            @update:model-value="toggleItem(audio.id)"
            @click.stop
          />
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30"
          >
            <UIcon
              :name="audio.status === AudioStatus.Processing ? 'i-lucide-loader-2' : 'i-lucide-music'"
              :class="[
                'h-5 w-5 text-primary-600 dark:text-primary-400',
                audio.status === AudioStatus.Processing ? 'animate-spin' : ''
              ]"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted truncate">
              {{ audio.title || audio.fileName }}
            </p>
            <div class="flex items-center gap-2 mt-1">
              <UBadge
                :color="statusConfig[audio.status as AudioStatus]?.color || 'neutral'"
                variant="subtle"
                size="sm"
              >
                <UIcon
                  :name="statusConfig[audio.status as AudioStatus]?.icon || 'i-lucide-circle'"
                  :class="[
                    'h-3.5 w-3.5 mr-0.5',
                    audio.status === AudioStatus.Processing ? 'animate-spin' : ''
                  ]"
                />
                {{ t(`components.workshop.status.${audio.status}`) }}
              </UBadge>
              <span class="text-xs text-dimmed">
                {{ formatDuration(audio.duration) }} · {{ formatDate(audio.createdAt) }}
              </span>
            </div>
          </div>
          <UDropdownMenu :items="getCardActionItems(audio)">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Desktop: Table -->
      <UTable
        class="hidden sm:block w-full"
        :columns="columns"
        :data="audios"
        :loading="loading"
        :ui="{
          tr: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
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
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
            <UIcon
              :name="row.original.status === AudioStatus.Processing ? 'i-lucide-loader-2' : 'i-lucide-music'"
              :class="[
                'h-5 w-5 text-primary-600 dark:text-primary-400',
                row.original.status === AudioStatus.Processing ? 'animate-spin' : ''
              ]"
            />
          </div>

          <div class="min-w-0 flex-1">
            <!-- Inline editing input -->
            <UInput
              v-if="editingAudioId === row.original.id"
              ref="titleInputRef"
              v-model="editedTitle"
              size="sm"
              class="w-full"
              @keydown="(e: KeyboardEvent) => handleTitleKeydown(e, row.original)"
              @blur="saveTitle(row.original)"
              @click.stop
            />

            <!-- Display title (clickable to edit) -->
            <button
              v-else
              class="font-medium text-gray-900 dark:text-white truncate max-w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left flex items-center gap-1"
              :title="t('pages.dashboard.library.clickToRename')"
              @click="(e) => startEditingTitle(row.original, e)"
            >
              <span class="truncate">{{ getDisplayTitle(row.original) }}</span>
            </button>

            <!-- Condensed info on mobile (hidden columns) -->
            <div class="flex items-center gap-2 mt-1 sm:hidden">
              <UBadge
                :color="statusConfig[row.original.status as AudioStatus]?.color || 'neutral'"
                variant="subtle"
                size="xs"
              >
                <UIcon
                  :name="statusConfig[row.original.status as AudioStatus]?.icon || 'i-lucide-circle'"
                  :class="[
                    'h-3 w-3 mr-0.5',
                    row.original.status === AudioStatus.Processing ? 'animate-spin' : ''
                  ]"
                />
                {{ t(`components.workshop.status.${row.original.status}`) }}
              </UBadge>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(row.original.createdAt) }}
              </span>
            </div>
          </div>
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
          size="sm"
          @click.stop="emit('delete', row.original)"
        />
      </template>
      </UTable>
    </template>
  </div>
</template>

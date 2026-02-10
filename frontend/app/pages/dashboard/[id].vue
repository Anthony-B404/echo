<script setup lang="ts">
import { AudioStatus } from '~/types/audio'
import type { TranscriptionVersionField } from '~/types/transcription'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const route = useRoute()
const { t } = useI18n()
const { formatRelativeTime } = useFormatters()

useSeoMeta({
  title: t('seo.audioDetail.title'),
  description: t('seo.audioDetail.description')
})
const toast = useToast()
const localePath = useLocalePath()
const runtimeConfig = useRuntimeConfig()

const audioStore = useAudioStore()

// Track current job for real-time progress display
const currentJobId = ref<string | null>(null)
const currentJobStatus = computed(() =>
  currentJobId.value ? audioStore.getJobStatus(currentJobId.value) : null
)

const { startPolling, stopAllPolling, polling } = useAudioPolling({
  onComplete: () => {
    currentJobId.value = null
    toast.add({
      title: t('pages.dashboard.workshop.detail.processingComplete'),
      color: 'success'
    })
    // Refresh audio to get transcription
    audioStore.fetchAudio(audioId.value)
  },
  onError: (error) => {
    currentJobId.value = null
    toast.add({
      title: t('pages.dashboard.workshop.detail.processingError'),
      description: error.message,
      color: 'error'
    })
  }
})

const audioId = computed(() => Number(route.params.id))
const audio = computed(() => audioStore.currentAudio)
const isProcessing = computed(
  () => audio.value && (audio.value.status === AudioStatus.Pending || audio.value.status === AudioStatus.Processing)
)

// Computed helpers for template
const isCompleted = computed(() => audio.value?.status === AudioStatus.Completed)
const isFailed = computed(() => audio.value?.status === AudioStatus.Failed)

const activeTab = ref<'transcription' | 'analysis' | 'questions'>('transcription')
const deleteModalOpen = ref(false)
const shareModalOpen = ref(false)
const audioFileUrl = ref<string | null>(null)
const audioFileLoading = ref(false)

// Title editing state
const isEditingTitle = ref(false)
const editedTitle = ref('')
const savingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)

// Audio player ref and current time for segment sync
const audioPlayerRef = ref<{ seekTo?: (time: number) => void } | null>(null)
const currentTime = ref(0)

// Analysis editing state (transcription is read-only)
const isEditingAnalysis = ref(false)
const historyModalOpen = ref(false)
const historyModalField = ref<TranscriptionVersionField>('raw_text')
const diffModalOpen = ref(false)
const diffVersion1Id = ref<number | null>(null)
const diffVersion2Id = ref<number | null>(null)

// Transcription edit composable
const {
  loading: editLoading,
  error: editError,
  conflict: editConflict,
  saveEdit,
  restoreVersion,
  clearConflict,
  clearError: clearEditError
} = useTranscriptionEdit(audioId)

// Check if timestamps are available
const hasTimestamps = computed(
  () => (audio.value?.transcription?.timestamps?.length ?? 0) > 0
)

// Current version numbers for optimistic locking
const currentTranscriptionVersion = computed(() => audio.value?.transcription?.rawTextVersion ?? 1)
const currentAnalysisVersion = computed(() => audio.value?.transcription?.analysisVersion ?? 1)

// Check if currently editing
const isEditing = computed(() => isEditingAnalysis.value)

// Get current field being edited (only analysis is editable)
const currentEditField = computed<TranscriptionVersionField | null>(() => {
  if (isEditingAnalysis.value) return 'analysis'
  return null
})

// Last edited info
const lastEditedInfo = computed(() => {
  const transcription = audio.value?.transcription
  if (!transcription?.lastEditedAt || !transcription?.lastEditedByUser) return null
  return {
    user: transcription.lastEditedByUser,
    time: transcription.lastEditedAt
  }
})

// Markdown rendering
const { renderMarkdown } = useMarkdown()
const renderedTranscription = computed(() =>
  renderMarkdown(audio.value?.transcription?.rawText || '')
)
const renderedAnalysis = computed(() =>
  renderMarkdown(audio.value?.transcription?.analysis || '')
)

// Load audio on mount
onMounted(async () => {
  await audioStore.fetchAudio(audioId.value)
})

// Load audio file when audio is completed
watch(
  () => audio.value?.status,
  async (status) => {
    if (status === AudioStatus.Completed && audio.value && !audioFileUrl.value) {
      await loadAudioFile()
    }
  },
  { immediate: true }
)

// Watch for processing audio with currentJobId (resume polling after page refresh)
watch(
  () => audio.value,
  (newAudio) => {
    if (newAudio?.currentJobId && isProcessing.value && !polling.value) {
      currentJobId.value = newAudio.currentJobId
      startPolling(newAudio.currentJobId, newAudio.id)
    }
  },
  { immediate: true }
)

// Fetch audio file with authentication and create blob URL
async function loadAudioFile () {
  if (!audio.value || audioFileLoading.value) { return }

  const { getAuthHeaders } = useAuth()

  audioFileLoading.value = true
  try {
    const response = await fetch(
      `${runtimeConfig.public.apiUrl}/audios/${audio.value.id}/file`,
      {
        headers: getAuthHeaders() as HeadersInit
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`)
    }

    const blob = await response.blob()
    audioFileUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    // eslint-disable-next-line no-console -- Debug logging for audio file loading errors
    console.error('Failed to load audio file:', error)
  } finally {
    audioFileLoading.value = false
  }
}

// Handle delete
async function handleDeleteConfirm () {
  if (!audio.value) { return }

  const success = await audioStore.deleteAudio(audio.value.id)

  if (success) {
    toast.add({
      title: t('pages.dashboard.workshop.deleteSuccess'),
      color: 'success'
    })
    navigateTo(localePath('/dashboard'))
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.deleteError'),
      color: 'error'
    })
  }

  deleteModalOpen.value = false
}

// Check if current tab content can be copied
const canCopy = computed(() => {
  if (activeTab.value === 'transcription') {
    return !!audio.value?.transcription?.rawText
  }
  return !!audio.value?.transcription?.analysis
})

// Copy active tab content to clipboard
async function copyContent () {
  if (activeTab.value === 'transcription') {
    if (!audio.value?.transcription?.rawText) { return }
    await navigator.clipboard.writeText(audio.value.transcription.rawText)
    toast.add({
      title: t('pages.dashboard.workshop.detail.transcriptionCopied'),
      color: 'success'
    })
  } else if (activeTab.value === 'analysis') {
    if (!audio.value?.transcription?.analysis) { return }
    await navigator.clipboard.writeText(audio.value.transcription.analysis)
    toast.add({
      title: t('pages.dashboard.workshop.detail.analysisCopied'),
      color: 'success'
    })
  }
}

// Title editing functions
function startEditingTitle () {
  if (!audio.value) { return }
  editedTitle.value = audio.value.title || audio.value.fileName
  isEditingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelEditingTitle () {
  isEditingTitle.value = false
  editedTitle.value = ''
}

async function saveTitle () {
  if (!audio.value || !editedTitle.value.trim() || savingTitle.value) {
    cancelEditingTitle()
    return
  }

  const newTitle = editedTitle.value.trim()
  if (newTitle === audio.value.title || (newTitle === audio.value.fileName && !audio.value.title)) {
    cancelEditingTitle()
    return
  }

  savingTitle.value = true
  const success = await audioStore.updateAudio(audio.value.id, newTitle)

  if (success) {
    toast.add({
      title: t('pages.dashboard.workshop.detail.titleUpdated'),
      color: 'success'
    })
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.detail.titleUpdateError'),
      color: 'error'
    })
  }

  savingTitle.value = false
  isEditingTitle.value = false
}

function handleTitleKeydown (event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveTitle()
  } else if (event.key === 'Escape') {
    cancelEditingTitle()
  }
}

// Handle time update from audio player
function onTimeUpdate (time: number) {
  currentTime.value = time
}

// Handle seek from transcription segment click
function handleSegmentSeek (time: number) {
  audioPlayerRef.value?.seekTo?.(time)
}

// Format duration
function formatDuration (seconds: number | null): string {
  if (!seconds) { return '--:--' }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format file size
function formatFileSize (bytes: number): string {
  if (bytes < 1024) { return `${bytes} B` }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB` }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Analysis editing function (transcription is read-only)
function startEditingAnalysis () {
  clearEditError()
  clearConflict()
  isEditingAnalysis.value = true
}

function cancelEditing () {
  isEditingAnalysis.value = false
  clearConflict()
}

async function handleSave (content: string, changeSummary?: string) {
  if (!audio.value?.transcription) return

  const field = currentEditField.value
  if (!field) return

  const expectedVersion = field === 'raw_text'
    ? currentTranscriptionVersion.value
    : currentAnalysisVersion.value

  const result = await saveEdit({
    field,
    content,
    expectedVersion,
    changeSummary
  })

  if (result.success && result.audio) {
    // Update the audio in store with the new data
    audioStore.updateCurrentAudio(result.audio)
    cancelEditing()
    toast.add({
      title: t('pages.dashboard.workshop.detail.editSaved'),
      color: 'success'
    })
  } else if (result.conflict) {
    // Conflict handled by composable, alert will show
    toast.add({
      title: t('pages.dashboard.workshop.detail.editConflict'),
      color: 'warning'
    })
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.detail.editError'),
      description: editError.value || undefined,
      color: 'error'
    })
  }
}

async function handleRefreshAfterConflict () {
  await audioStore.fetchAudio(audioId.value)
  clearConflict()
}

function openHistory (field: TranscriptionVersionField) {
  historyModalField.value = field
  historyModalOpen.value = true
}

async function handleRestore (versionId: number) {
  const result = await restoreVersion(versionId)

  if (result.success && result.audio) {
    audioStore.updateCurrentAudio(result.audio)
    historyModalOpen.value = false
    diffModalOpen.value = false
    toast.add({
      title: t('pages.dashboard.workshop.detail.versionRestored'),
      color: 'success'
    })
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.detail.restoreError'),
      description: editError.value || undefined,
      color: 'error'
    })
  }
}

function handleCompare (version1Id: number, version2Id: number) {
  diffVersion1Id.value = version1Id
  diffVersion2Id.value = version2Id
  diffModalOpen.value = true
}

// Cleanup
onUnmounted(() => {
  stopAllPolling()
  audioStore.clearCurrentAudio()
  // Revoke blob URL to prevent memory leak
  if (audioFileUrl.value) {
    URL.revokeObjectURL(audioFileUrl.value)
  }
})

// Tab items
const tabItems = computed(() => [
  {
    label: t('pages.dashboard.workshop.detail.tabs.transcription'),
    value: 'transcription'
  },
  {
    label: t('pages.dashboard.workshop.detail.tabs.analysis'),
    value: 'analysis'
  },
  {
    label: t('pages.dashboard.workshop.detail.tabs.questions'),
    value: 'questions'
  }
])
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-default">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          :to="localePath('/dashboard')"
        />

        <!-- Editable title -->
        <div v-if="isEditingTitle" class="flex items-center gap-2 flex-1 min-w-0">
          <UInput
            ref="titleInputRef"
            v-model="editedTitle"
            :placeholder="t('pages.dashboard.workshop.detail.titlePlaceholder')"
            size="lg"
            class="flex-1"
            :disabled="savingTitle"
            @keydown="handleTitleKeydown"
            @blur="saveTitle"
          />
          <UButton
            v-if="savingTitle"
            icon="i-lucide-loader-2"
            color="neutral"
            variant="ghost"
            disabled
            class="animate-spin"
          />
        </div>

        <!-- Display title (clickable to edit) -->
        <button
          v-else
          class="text-lg font-semibold text-highlighted truncate hover:text-primary transition-colors cursor-pointer text-left flex items-center gap-2 group"
          :title="t('pages.dashboard.workshop.detail.clickToEdit')"
          @click="startEditingTitle"
        >
          <span class="truncate">
            {{ audio?.title || audio?.fileName || t('pages.dashboard.workshop.detail.title') }}
          </span>
          <UIcon
            name="i-lucide-pencil"
            class="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted"
          />
        </button>
      </div>

      <div v-if="audio" class="flex items-center gap-2">
        <UButton
          icon="i-lucide-share-2"
          color="primary"
          variant="ghost"
          @click="shareModalOpen = true"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          @click="deleteModalOpen = true"
        />
      </div>
    </div>

    <!-- Content (scrollable) -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Loading state -->
      <div v-if="audioStore.loading && !audio" class="space-y-6">
        <USkeleton class="h-24 rounded-lg" />
        <USkeleton class="h-64 rounded-lg" />
      </div>

      <!-- Not found -->
      <WorkshopEmptyState
        v-else-if="!audio"
        :title="t('pages.dashboard.workshop.detail.notFound')"
        :description="t('pages.dashboard.workshop.detail.notFoundDescription')"
        icon="i-lucide-file-audio"
      >
        <UButton
          :label="t('pages.dashboard.workshop.detail.backToWorkshop')"
          color="primary"
          class="mt-4"
          :to="localePath('/dashboard')"
        />
      </WorkshopEmptyState>

      <!-- Audio detail -->
      <div v-else class="space-y-6">
        <!-- Audio info card -->
        <UPageCard variant="subtle">
          <div class="flex items-start gap-4 mb-4">
            <div
              class="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center"
              :class="isCompleted ? 'bg-primary/10' : 'bg-elevated'"
            >
              <UIcon
                :name="isProcessing ? 'i-lucide-loader-2' : 'i-lucide-music'"
                class="w-8 h-8"
                :class="[
                  isProcessing ? 'animate-spin text-primary' : '',
                  isCompleted ? 'text-primary' : 'text-muted',
                ]"
              />
            </div>

            <div class="flex-1">
              <h2 class="text-xl font-semibold text-highlighted mb-2">
                {{ audio.title || audio.fileName }}
              </h2>
              <div class="flex items-center gap-4 text-sm text-muted">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="w-4 h-4" />
                  {{ formatDuration(audio.duration) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-hard-drive" class="w-4 h-4" />
                  {{ formatFileSize(audio.fileSize) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Audio player -->
          <WorkshopAudioPlayer
            v-if="audioFileUrl"
            ref="audioPlayerRef"
            :src="audioFileUrl"
            :duration="audio.duration"
            @timeupdate="onTimeUpdate"
          />

          <!-- Processing status with real-time progress -->
          <WorkshopProcessingStatus
            v-if="isProcessing"
            class="mt-4"
            :status="{
              jobId: currentJobId || '',
              status: currentJobStatus?.status || AudioStatus.Processing,
              progress: currentJobStatus?.progress || 0,
              error: currentJobStatus?.error,
            }"
          />
        </UPageCard>

        <!-- Transcription/Analysis tabs -->
        <UPageCard v-if="isCompleted && audio.transcription" variant="subtle">
          <div class="flex items-center justify-between mb-4">
            <UTabs v-model="activeTab" :items="tabItems" :disabled="isEditing" />

            <div v-if="activeTab !== 'questions'" class="flex items-center gap-2">
              <!-- Edit button (only on analysis tab, transcription is read-only) -->
              <UButton
                v-if="!isEditingAnalysis && activeTab === 'analysis'"
                icon="i-lucide-pencil"
                color="primary"
                variant="ghost"
                size="sm"
                :label="t('common.buttons.edit')"
                :disabled="!audio.transcription?.analysis"
                @click="startEditingAnalysis"
              />

              <!-- TTS player (only on analysis tab, not editing) -->
              <WorkshopAnalysisTtsPlayer
                v-if="!isEditing && activeTab === 'analysis'"
                :key="`tts-${audio.transcription?.analysisVersion}`"
                :audio-id="audio.id"
                :disabled="!audio.transcription?.analysis"
              />

              <!-- History button -->
              <UButton
                v-if="!isEditing"
                icon="i-lucide-history"
                color="neutral"
                variant="ghost"
                size="sm"
                :title="t('pages.dashboard.workshop.detail.viewHistory')"
                @click="openHistory(activeTab === 'transcription' ? 'raw_text' : 'analysis')"
              />

              <UButton
                v-if="!isEditing"
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="!canCopy"
                @click="copyContent"
              />
              <WorkshopExportDropdown
                v-if="!isEditing"
                :audio-id="audio.id"
                :audio-title="audio.title || audio.fileName"
                :has-transcription="!!audio.transcription?.rawText"
                :has-analysis="!!audio.transcription?.analysis"
              />
            </div>
          </div>

          <!-- Last edited info -->
          <div v-if="lastEditedInfo && !isEditing" class="flex items-center gap-2 mb-4 text-xs text-muted">
            <UIcon name="i-lucide-user" class="w-3 h-3" />
            <span>
              {{ t('pages.dashboard.workshop.detail.lastEditedBy', {
                name: lastEditedInfo.user.fullName || lastEditedInfo.user.email,
                time: formatRelativeTime(lastEditedInfo.time)
              }) }}
            </span>
          </div>

          <!-- Transcription content (read-only) -->
          <div v-show="activeTab === 'transcription'">
            <!-- Segments with timestamps (clickable) -->
            <WorkshopTranscriptionSegments
              v-if="hasTimestamps"
              :segments="audio.transcription.timestamps!"
              :current-time="currentTime"
              @seek="handleSegmentSeek"
            />

            <!-- Fallback to markdown for legacy transcriptions -->
            <div
              v-else
              class="markdown-content text-sm"
              v-html="renderedTranscription"
            />

            <!-- Metadata -->
            <div
              class="mt-4 pt-4 border-t border-default flex items-center gap-4 text-sm text-muted"
            >
              <span v-if="audio.transcription.language">
                {{ t('pages.dashboard.workshop.detail.language') }}:
                {{ audio.transcription.language.toUpperCase() }}
              </span>
              <span v-if="audio.transcription.confidence">
                {{ t('pages.dashboard.workshop.detail.confidence') }}:
                {{ (audio.transcription.confidence * 100).toFixed(0) }}%
              </span>
              <span v-if="audio.transcription.rawTextVersion">
                v{{ audio.transcription.rawTextVersion }}
              </span>
            </div>
          </div>

          <!-- Analysis content -->
          <div v-show="activeTab === 'analysis'">
            <!-- Edit mode -->
            <WorkshopTranscriptionEditor
              v-if="isEditingAnalysis"
              :content="audio.transcription.analysis || ''"
              field="analysis"
              :version="currentAnalysisVersion"
              :loading="editLoading"
              :conflict="editConflict"
              @save="handleSave"
              @cancel="cancelEditing"
              @refresh="handleRefreshAfterConflict"
              @dismiss-conflict="clearConflict"
            />

            <!-- View mode -->
            <template v-else>
              <!-- Analysis available -->
              <div
                v-if="audio.transcription?.analysis"
                class="markdown-content text-sm"
                v-html="renderedAnalysis"
              />

              <!-- No analysis -->
              <div v-else class="text-center py-8">
                <WorkshopEmptyState
                  :title="t('pages.dashboard.workshop.detail.noAnalysis')"
                  :description="t('pages.dashboard.workshop.detail.noAnalysisDescription')"
                  icon="i-lucide-sparkles"
                />
              </div>

              <!-- Version info -->
              <div
                v-if="audio.transcription?.analysis && audio.transcription?.analysisVersion"
                class="mt-4 pt-4 border-t border-default text-sm text-muted"
              >
                <span>v{{ audio.transcription.analysisVersion }}</span>
              </div>
            </template>
          </div>

          <!-- Questions chat -->
          <div v-show="activeTab === 'questions'">
            <WorkshopTranscriptChat :audio-id="audio.id" />
          </div>
        </UPageCard>

        <!-- Error state -->
        <UAlert
          v-if="isFailed"
          color="error"
          variant="subtle"
          :title="t('pages.dashboard.workshop.detail.processingFailed')"
          :description="audio.errorMessage || undefined"
          icon="i-lucide-alert-circle"
        />
      </div>
    </div>

    <!-- Delete modal -->
    <WorkshopAudioDeleteModal
      v-model:open="deleteModalOpen"
      :audio="audio"
      @confirm="handleDeleteConfirm"
    />

    <!-- Share modal -->
    <WorkshopShareModal
      v-if="audio"
      v-model:open="shareModalOpen"
      :audio-id="audio.id"
      :audio-title="audio.title || audio.fileName"
    />

    <!-- Version history modal -->
    <WorkshopVersionHistoryModal
      v-if="audio"
      v-model:open="historyModalOpen"
      :audio-id="audio.id"
      :field="historyModalField"
      :current-version="historyModalField === 'raw_text' ? currentTranscriptionVersion : currentAnalysisVersion"
      @restore="handleRestore"
      @compare="handleCompare"
    />

    <!-- Version diff modal -->
    <WorkshopVersionDiffModal
      v-if="audio"
      v-model:open="diffModalOpen"
      :audio-id="audio.id"
      :version1-id="diffVersion1Id"
      :version2-id="diffVersion2Id"
      @restore="handleRestore"
    />
  </div>
</template>

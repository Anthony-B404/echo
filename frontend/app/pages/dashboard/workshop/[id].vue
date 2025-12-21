<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const runtimeConfig = useRuntimeConfig()

const audioStore = useAudioStore()
const { stopPolling } = useAudioPolling({
  onComplete: () => {
    toast.add({
      title: t('pages.dashboard.workshop.detail.processingComplete'),
      color: 'success',
    })
  },
  onError: (error) => {
    toast.add({
      title: t('pages.dashboard.workshop.detail.processingError'),
      description: error.message,
      color: 'error',
    })
  },
})

const audioId = computed(() => Number(route.params.id))
const audio = computed(() => audioStore.currentAudio)
const isProcessing = computed(
  () => audio.value && (audio.value.status === 'pending' || audio.value.status === 'processing')
)

const activeTab = ref<'transcription' | 'analysis'>('transcription')
const deleteModalOpen = ref(false)
const audioFileUrl = ref<string | null>(null)
const audioFileLoading = ref(false)

// Audio player ref and current time for segment sync
const audioPlayerRef = ref<InstanceType<typeof WorkshopAudioPlayer> | null>(null)
const currentTime = ref(0)

// Check if timestamps are available
const hasTimestamps = computed(
  () => (audio.value?.transcription?.timestamps?.length ?? 0) > 0
)

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
    if (status === 'completed' && audio.value && !audioFileUrl.value) {
      await loadAudioFile()
    }
  },
  { immediate: true }
)

// Fetch audio file with authentication and create blob URL
async function loadAudioFile() {
  if (!audio.value || audioFileLoading.value) return

  const { getAuthHeaders } = useAuth()

  audioFileLoading.value = true
  try {
    const response = await fetch(
      `${runtimeConfig.public.apiUrl}/audios/${audio.value.id}/file`,
      {
        headers: getAuthHeaders() as HeadersInit,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`)
    }

    const blob = await response.blob()
    audioFileUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error('Failed to load audio file:', error)
  } finally {
    audioFileLoading.value = false
  }
}

// Handle delete
async function handleDeleteConfirm() {
  if (!audio.value) return

  const success = await audioStore.deleteAudio(audio.value.id)

  if (success) {
    toast.add({
      title: t('pages.dashboard.workshop.deleteSuccess'),
      color: 'success',
    })
    navigateTo(localePath('/dashboard/workshop'))
  } else {
    toast.add({
      title: t('pages.dashboard.workshop.deleteError'),
      color: 'error',
    })
  }

  deleteModalOpen.value = false
}

// Copy transcription to clipboard
async function copyTranscription() {
  if (!audio.value?.transcription?.rawText) return

  await navigator.clipboard.writeText(audio.value.transcription.rawText)
  toast.add({
    title: t('pages.dashboard.workshop.detail.copiedToClipboard'),
    color: 'success',
  })
}

// Download transcription as text file
function downloadTranscription() {
  if (!audio.value?.transcription?.rawText) return

  const blob = new Blob([audio.value.transcription.rawText], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${audio.value.title || audio.value.fileName}-transcription.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Handle time update from audio player
function onTimeUpdate(time: number) {
  currentTime.value = time
}

// Handle seek from transcription segment click
function handleSegmentSeek(time: number) {
  audioPlayerRef.value?.seekTo(time)
}

// Format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Cleanup
onUnmounted(() => {
  stopPolling()
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
    value: 'transcription',
  },
  {
    label: t('pages.dashboard.workshop.detail.tabs.analysis'),
    value: 'analysis',
  },
])
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-default">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          :to="localePath('/dashboard/workshop')"
        />
        <span class="text-lg font-semibold text-highlighted truncate">
          {{ audio?.title || audio?.fileName || t('pages.dashboard.workshop.detail.title') }}
        </span>
      </div>

      <UButton
        v-if="audio"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        @click="deleteModalOpen = true"
      />
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
            :to="localePath('/dashboard/workshop')"
          />
        </WorkshopEmptyState>

        <!-- Audio detail -->
        <div v-else class="space-y-6 max-w-4xl">
          <!-- Audio info card -->
          <UPageCard variant="subtle">
            <div class="flex items-start gap-4 mb-4">
              <div
                class="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center"
                :class="audio.status === 'completed' ? 'bg-primary/10' : 'bg-elevated'"
              >
                <UIcon
                  :name="isProcessing ? 'i-lucide-loader-2' : 'i-lucide-music'"
                  class="w-8 h-8"
                  :class="[
                    isProcessing ? 'animate-spin text-primary' : '',
                    audio.status === 'completed' ? 'text-primary' : 'text-muted',
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

            <!-- Status badge for processing -->
            <UAlert
              v-if="isProcessing"
              color="primary"
              variant="subtle"
              :title="t('pages.dashboard.workshop.detail.processingInProgress')"
              class="mt-4"
            >
              <template #icon>
                <UIcon name="i-lucide-loader-2" class="animate-spin" />
              </template>
            </UAlert>
          </UPageCard>

          <!-- Transcription/Analysis tabs -->
          <UPageCard v-if="audio.status === 'completed' && audio.transcription" variant="subtle">
            <div class="flex items-center justify-between mb-4">
              <UTabs v-model="activeTab" :items="tabItems" />

              <div v-if="activeTab === 'transcription'" class="flex items-center gap-2">
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="copyTranscription"
                />
                <UButton
                  icon="i-lucide-download"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="downloadTranscription"
                />
              </div>
            </div>

            <!-- Transcription content -->
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
              </div>
            </div>

            <!-- Analysis content -->
            <div v-show="activeTab === 'analysis'">
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
            </div>
          </UPageCard>

          <!-- Error state -->
          <UAlert
            v-if="audio.status === 'failed'"
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
  </div>
</template>

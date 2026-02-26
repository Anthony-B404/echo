<script setup lang="ts">
import { AudioStatus } from '~/types/audio'

interface SharedAudioResponse {
  share: {
    id: number
    identifier: string
    expiresAt: string | null
    organizationName?: string
    sharedBy?: {
      fullName?: string
      firstName?: string
    }
  }
  audio: {
    id: number
    title: string
    duration: number | null
    status: AudioStatus
    fileName?: string
    fileSize?: number
    transcription?: {
      rawText: string
      analysis: string
      language?: string
      confidence?: number
      timestamps?: Array<{ start: number; end: number; text: string }>
    }
  }
}

definePageMeta({
  layout: false
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const identifier = computed(() => route.params.identifier as string)

// Fetch shared data
const { data, pending, error } = await useFetch<SharedAudioResponse>(
  () => `${runtimeConfig.public.apiUrl}/shared/${identifier.value}`,
  {
    key: `shared-${identifier.value}`
  }
)

const share = computed(() => data.value?.share)
const audio = computed(() => data.value?.audio)

const activeTab = ref<'transcription' | 'analysis'>('transcription')

// Audio player ref and current time for segment sync
const audioPlayerRef = ref<{ seekTo?: (time: number) => void } | null>(null)
const currentTime = ref(0)

// Audio URL (public endpoint)
const audioUrl = computed(
  () => `${runtimeConfig.public.apiUrl}/shared/${identifier.value}/audio`
)

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

// Tab items
const tabItems = computed(() => [
  {
    label: t('pages.shared.tabs.transcription'),
    value: 'transcription'
  },
  {
    label: t('pages.shared.tabs.analysis'),
    value: 'analysis'
  }
])

// Format duration
function formatDuration (seconds: number | null): string {
  if (!seconds) { return '--:--' }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format file size
function formatFileSize (bytes: number | undefined): string {
  if (!bytes) { return '--' }
  if (bytes < 1024) { return `${bytes} B` }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB` }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Get sender name
const senderName = computed(() => {
  if (!share.value?.sharedBy) { return '' }
  return share.value.sharedBy.fullName || share.value.sharedBy.firstName || ''
})

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
      title: t('pages.shared.transcriptionCopied'),
      color: 'success'
    })
  } else if (activeTab.value === 'analysis') {
    if (!audio.value?.transcription?.analysis) { return }
    await navigator.clipboard.writeText(audio.value.transcription.analysis)
    toast.add({
      title: t('pages.shared.analysisCopied'),
      color: 'success'
    })
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

useSeoMeta({
  title: () => audio.value?.title || t('pages.shared.seoTitle'),
  description: t('pages.shared.seoDescription')
})
</script>

<template>
  <div class="min-h-screen">
    <div class="mx-auto max-w-4xl p-6">
      <!-- Loading state -->
      <div v-if="pending" class="flex items-center justify-center py-24">
        <UIcon
          name="i-lucide-loader-2"
          class="text-primary h-8 w-8 animate-spin"
        />
        <span class="text-muted ml-3">{{ t("pages.shared.loading") }}</span>
      </div>

      <!-- Error / Not found -->
      <div v-else-if="error || !data" class="py-24 text-center">
        <UIcon
          name="i-lucide-file-x"
          class="text-muted mx-auto mb-4 h-16 w-16"
        />
        <h1 class="text-highlighted mb-2 text-2xl font-semibold">
          {{ t("pages.shared.notFound") }}
        </h1>
        <p class="text-muted">
          {{ t("pages.shared.notFoundDescription") }}
        </p>
      </div>

      <!-- Content -->
      <div v-else-if="audio" class="space-y-6">
        <!-- Header -->
        <div class="mb-8 text-center">
          <h1 class="text-highlighted mb-2 text-2xl font-bold">
            {{ audio.title || audio.fileName }}
          </h1>
          <p v-if="senderName" class="text-muted text-sm">
            {{ t("pages.shared.sharedBy", { name: senderName }) }}
          </p>
        </div>

        <!-- Audio info card -->
        <UPageCard variant="subtle">
          <div class="mb-4 flex items-start gap-4">
            <div
              class="bg-primary/10 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg"
            >
              <UIcon name="i-lucide-music" class="text-primary h-8 w-8" />
            </div>

            <div class="flex-1">
              <h2 class="text-highlighted mb-2 text-xl font-semibold">
                {{ audio.title || audio.fileName }}
              </h2>
              <div class="text-muted flex items-center gap-4 text-sm">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="h-4 w-4" />
                  {{ formatDuration(audio.duration) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-hard-drive" class="h-4 w-4" />
                  {{ formatFileSize(audio.fileSize) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Audio player -->
          <WorkshopAudioPlayer
            v-if="audio.status === AudioStatus.Completed"
            ref="audioPlayerRef"
            :src="audioUrl"
            :duration="audio.duration"
            @timeupdate="onTimeUpdate"
          />
        </UPageCard>

        <!-- Transcription/Analysis tabs -->
        <UPageCard v-if="audio.transcription" variant="subtle">
          <div class="mb-4 flex items-center justify-between">
            <UTabs v-model="activeTab" :items="tabItems" />

            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="!canCopy"
                @click="copyContent"
              />
              <WorkshopSharedExportDropdown
                :identifier="identifier"
                :audio-title="audio.title || audio.fileName"
                :has-transcription="!!audio.transcription?.rawText"
                :has-analysis="!!audio.transcription?.analysis"
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
              v-else-if="audio.transcription.rawText"
              class="markdown-content text-sm"
              v-html="renderedTranscription"
            />
            <div v-else class="text-muted py-8 text-center">
              {{ t("pages.shared.noTranscription") }}
            </div>

            <!-- Metadata -->
            <div
              v-if="
                audio.transcription.language || audio.transcription.confidence
              "
              class="border-default text-muted mt-4 flex items-center gap-4 border-t pt-4 text-sm"
            >
              <span v-if="audio.transcription.language">
                {{ t("pages.shared.language") }}:
                {{ audio.transcription.language.toUpperCase() }}
              </span>
              <span v-if="audio.transcription.confidence">
                {{ t("pages.shared.confidence") }}:
                {{ (audio.transcription.confidence * 100).toFixed(0) }}%
              </span>
            </div>
          </div>

          <!-- Analysis content -->
          <div v-show="activeTab === 'analysis'" class="min-w-0 overflow-x-hidden">
            <div
              v-if="audio.transcription?.analysis"
              class="markdown-content text-sm"
              v-html="renderedAnalysis"
            />
            <div v-else class="text-muted py-8 text-center">
              {{ t("pages.shared.noAnalysis") }}
            </div>
          </div>
        </UPageCard>

        <!-- Footer -->
        <div class="text-muted pt-4 text-center text-sm">
          {{ t("pages.shared.sharedVia") }}
        </div>
      </div>
    </div>
  </div>
</template>

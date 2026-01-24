<script setup lang="ts">
import type { TranscriptionVersion, TranscriptionVersionField } from '~/types/transcription'

const props = defineProps<{
  audioId: number
  field: TranscriptionVersionField
  currentVersion: number
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  restore: [versionId: number]
  compare: [version1Id: number, version2Id: number]
}>()

const { t } = useI18n()
const toast = useToast()
const { formatRelativeTime } = useFormatters()

const { loading, error, history, historyMeta, fetchHistory, fetchVersion } = useTranscriptionEdit(
  computed(() => props.audioId)
)

// Selected versions for comparison
const selectedVersions = ref<number[]>([])

// Version preview
const previewVersion = ref<TranscriptionVersion | null>(null)
const loadingPreview = ref(false)
const previewOpen = computed({
  get: () => previewVersion.value !== null,
  set: (value) => {
    if (!value) previewVersion.value = null
  }
})

// Load history when modal opens
watch(open, async (isOpen) => {
  if (isOpen) {
    selectedVersions.value = []
    previewVersion.value = null
    await fetchHistory(props.field, 1, 20)
  }
})

// Toggle version selection for comparison
function toggleVersionSelection(versionId: number) {
  const index = selectedVersions.value.indexOf(versionId)
  if (index === -1) {
    if (selectedVersions.value.length < 2) {
      selectedVersions.value.push(versionId)
    } else {
      // Replace the oldest selection
      selectedVersions.value.shift()
      selectedVersions.value.push(versionId)
    }
  } else {
    selectedVersions.value.splice(index, 1)
  }
}

// Check if version is selected
function isVersionSelected(versionId: number) {
  return selectedVersions.value.includes(versionId)
}

// Compare selected versions
function handleCompare() {
  if (selectedVersions.value.length !== 2) {
    toast.add({
      title: t('components.workshop.versionHistory.selectTwoVersions'),
      color: 'warning',
    })
    return
  }

  const sorted = selectedVersions.value.slice().sort((a, b) => a - b)
  emit('compare', sorted[0]!, sorted[1]!)
}

// Restore version
function handleRestore(versionId: number) {
  emit('restore', versionId)
  open.value = false
}

// Preview version content
async function handlePreview(version: TranscriptionVersion) {
  loadingPreview.value = true
  const fullVersion = await fetchVersion(version.id)
  if (fullVersion) {
    previewVersion.value = { ...version, content: fullVersion.content }
  }
  loadingPreview.value = false
}

// Close preview
function closePreview() {
  previewVersion.value = null
}

// Load more history
async function loadMore() {
  if (!historyMeta.value) return
  const nextPage = historyMeta.value.page + 1
  await fetchHistory(props.field, nextPage, historyMeta.value.limit)
}

// Check if there's more to load
const hasMore = computed(() => {
  if (!historyMeta.value) return false
  return history.value.length < historyMeta.value.total
})

// Field label
const fieldLabel = computed(() =>
  props.field === 'raw_text'
    ? t('pages.dashboard.workshop.detail.tabs.transcription')
    : t('pages.dashboard.workshop.detail.tabs.analysis')
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('components.workshop.versionHistory.title', { field: fieldLabel })"
    class="max-w-2xl"
    :ui="{
      footer: 'justify-between',
    }"
  >
    <template #body>
      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="t('common.error')"
        :description="error"
        class="mb-4"
      />

      <!-- Loading state -->
      <div v-if="loading && history.length === 0" class="space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-16 rounded-lg" />
      </div>

      <!-- Version list -->
      <div v-else-if="history.length > 0" class="space-y-2">
        <div
          v-for="version in history"
          :key="version.id"
          class="border border-default rounded-lg p-3 hover:bg-elevated/50 transition-colors cursor-pointer"
          :class="{ 'ring-2 ring-primary': isVersionSelected(version.id) }"
          @click="toggleVersionSelection(version.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <UBadge
                  :label="`v${version.versionNumber}`"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
                <span
                  v-if="version.versionNumber === currentVersion"
                  class="text-xs text-primary font-medium"
                >
                  {{ t('components.workshop.versionHistory.current') }}
                </span>
              </div>

              <p v-if="version.changeSummary" class="text-sm text-highlighted mb-1 truncate">
                {{ version.changeSummary }}
              </p>

              <p v-if="version.preview" class="text-sm text-muted line-clamp-2">
                {{ version.preview }}
              </p>

              <div class="flex items-center gap-3 mt-2 text-xs text-muted">
                <span>{{ version.user.fullName || version.user.email }}</span>
                <span>{{ formatRelativeTime(version.createdAt) }}</span>
                <span v-if="version.wordCount">{{ version.wordCount }} {{ t('common.words') }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                size="sm"
                :title="t('components.workshop.versionHistory.preview')"
                @click.stop="handlePreview(version)"
              />
              <UButton
                v-if="version.versionNumber !== currentVersion"
                icon="i-lucide-rotate-ccw"
                color="primary"
                variant="ghost"
                size="sm"
                :title="t('components.workshop.versionHistory.restore')"
                @click.stop="handleRestore(version.id)"
              />
            </div>
          </div>
        </div>

        <!-- Load more button -->
        <div v-if="hasMore" class="text-center pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('common.loadMore')"
            :loading="loading"
            @click="loadMore"
          />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-8 text-muted">
        <UIcon name="i-lucide-history" class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{{ t('components.workshop.versionHistory.empty') }}</p>
      </div>

      <!-- Version preview panel -->
      <USlideover
        v-model:open="previewOpen"
        :title="previewVersion ? `v${previewVersion.versionNumber}` : ''"
        class="max-w-xl"
        @close="closePreview"
      >
        <template #body>
          <div v-if="loadingPreview" class="space-y-3">
            <USkeleton v-for="i in 5" :key="i" class="h-4 rounded" />
          </div>
          <div v-else-if="previewVersion?.content" class="prose prose-sm max-w-none">
            <pre class="whitespace-pre-wrap text-sm">{{ previewVersion.content }}</pre>
          </div>
        </template>
      </USlideover>
    </template>

    <template #footer>
      <div class="flex items-center gap-2">
        <span v-if="selectedVersions.length > 0" class="text-sm text-muted">
          {{ t('components.workshop.versionHistory.selectedCount', { count: selectedVersions.length }) }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-if="selectedVersions.length === 2"
          color="primary"
          variant="soft"
          icon="i-lucide-git-compare"
          :label="t('components.workshop.versionHistory.compare')"
          @click="handleCompare"
        />
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.buttons.close')"
          @click="open = false"
        />
      </div>
    </template>
  </UModal>
</template>

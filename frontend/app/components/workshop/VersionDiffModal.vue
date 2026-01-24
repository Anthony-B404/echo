<script setup lang="ts">
import type { VersionDiffResponse, DiffChange } from '~/types/transcription'

const props = defineProps<{
  audioId: number
  version1Id: number | null
  version2Id: number | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  restore: [versionId: number]
}>()

const { t } = useI18n()
const { formatRelativeTime } = useFormatters()

const { loading, error, compareVersions } = useTranscriptionEdit(computed(() => props.audioId))

const diffData = ref<VersionDiffResponse | null>(null)

// Load diff when modal opens with valid version IDs
watch(
  [open, () => props.version1Id, () => props.version2Id],
  async ([isOpen, v1, v2]) => {
    if (isOpen && v1 && v2) {
      diffData.value = await compareVersions(v1, v2)
    } else if (!isOpen) {
      diffData.value = null
    }
  }
)

// Use pre-calculated diff from backend, transformed for unified display
const diffLines = computed(() => {
  if (!diffData.value?.diff?.changes) return []
  return diffData.value.diff.changes
})

// Stats from backend
const stats = computed(() => {
  if (!diffData.value?.diff?.stats) return null
  return diffData.value.diff.stats
})

function handleRestore(versionId: number) {
  emit('restore', versionId)
  open.value = false
}

// Helper to get background class based on change type
function getChangeClass(change: DiffChange) {
  switch (change.type) {
    case 'added':
      return 'bg-green-500/10'
    case 'removed':
      return 'bg-red-500/10'
    default:
      return ''
  }
}

// Helper to get text prefix based on change type
function getChangePrefix(change: DiffChange) {
  switch (change.type) {
    case 'added':
      return '+'
    case 'removed':
      return '-'
    default:
      return ' '
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('components.workshop.versionDiff.title')"
    class="max-w-5xl"
    :ui="{
      footer: 'justify-end',
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
      <div v-if="loading" class="space-y-3">
        <USkeleton class="h-8 w-48 rounded" />
        <USkeleton class="h-64 rounded-lg" />
      </div>

      <!-- Diff content -->
      <div v-else-if="diffData" class="space-y-4">
        <!-- Version headers -->
        <div class="grid grid-cols-2 gap-4">
          <div class="border border-default rounded-lg p-3 bg-elevated/50">
            <div class="flex items-center justify-between mb-2">
              <UBadge
                :label="`v${diffData.version1.versionNumber}`"
                color="error"
                variant="subtle"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-rotate-ccw"
                :label="t('components.workshop.versionHistory.restore')"
                @click="handleRestore(diffData.version1.id)"
              />
            </div>
            <p v-if="diffData.version1.changeSummary" class="text-sm text-highlighted mb-1">
              {{ diffData.version1.changeSummary }}
            </p>
            <div class="flex items-center gap-2 text-xs text-muted">
              <span>{{ diffData.version1.user.fullName }}</span>
              <span>{{ formatRelativeTime(diffData.version1.createdAt) }}</span>
            </div>
          </div>

          <div class="border border-default rounded-lg p-3 bg-elevated/50">
            <div class="flex items-center justify-between mb-2">
              <UBadge
                :label="`v${diffData.version2.versionNumber}`"
                color="success"
                variant="subtle"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-rotate-ccw"
                :label="t('components.workshop.versionHistory.restore')"
                @click="handleRestore(diffData.version2.id)"
              />
            </div>
            <p v-if="diffData.version2.changeSummary" class="text-sm text-highlighted mb-1">
              {{ diffData.version2.changeSummary }}
            </p>
            <div class="flex items-center gap-2 text-xs text-muted">
              <span>{{ diffData.version2.user.fullName }}</span>
              <span>{{ formatRelativeTime(diffData.version2.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="stats" class="flex items-center gap-4 text-sm">
          <span class="text-green-500">
            +{{ stats.linesAdded }} {{ t('components.workshop.versionDiff.linesAdded') }}
          </span>
          <span class="text-red-500">
            -{{ stats.linesRemoved }} {{ t('components.workshop.versionDiff.linesRemoved') }}
          </span>
          <span class="text-muted">
            {{ stats.linesUnchanged }} {{ t('components.workshop.versionDiff.linesUnchanged') }}
          </span>
        </div>

        <!-- Unified diff view -->
        <div class="border border-default rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
          <div class="font-mono text-xs">
            <div
              v-for="(line, index) in diffLines"
              :key="index"
              class="px-3 py-1 border-b border-default last:border-b-0 flex"
              :class="getChangeClass(line)"
            >
              <span
                class="mr-2 select-none w-4 inline-block text-center font-bold"
                :class="{
                  'text-green-500': line.type === 'added',
                  'text-red-500': line.type === 'removed',
                  'text-muted': line.type === 'unchanged',
                }"
              >
                {{ getChangePrefix(line) }}
              </span>
              <span class="text-muted mr-2 select-none w-6 inline-block text-right">
                {{ index + 1 }}
              </span>
              <span class="flex-1 whitespace-pre-wrap break-all">{{ line.value || '\u00A0' }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        :label="t('common.buttons.close')"
        @click="open = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
type ExportFormat = 'pdf' | 'docx' | 'txt' | 'md'
type ExportContent = 'transcription' | 'analysis' | 'both'

const props = defineProps<{
  identifier: string
  audioTitle?: string | null
  hasTranscription: boolean
  hasAnalysis: boolean
}>()

const { t, locale } = useI18n()
const toast = useToast()
const config = useRuntimeConfig()

const loading = ref(false)
const open = ref(false)
const selectedContent = ref<ExportContent>('both')

// Format options with icons
const formatOptions = computed(() => [
  {
    label: t('components.workshop.export.format.pdf'),
    value: 'pdf' as ExportFormat,
    icon: 'i-lucide-file-text',
    extension: '.pdf',
  },
  {
    label: t('components.workshop.export.format.docx'),
    value: 'docx' as ExportFormat,
    icon: 'i-lucide-file-type',
    extension: '.docx',
  },
  {
    label: t('components.workshop.export.format.txt'),
    value: 'txt' as ExportFormat,
    icon: 'i-lucide-file',
    extension: '.txt',
  },
  {
    label: t('components.workshop.export.format.md'),
    value: 'md' as ExportFormat,
    icon: 'i-lucide-file-code',
    extension: '.md',
  },
])

// Content options
const contentOptions = computed(() => {
  const options = []

  if (props.hasTranscription && props.hasAnalysis) {
    options.push({
      label: t('components.workshop.export.content.both'),
      value: 'both' as ExportContent,
    })
  }

  if (props.hasTranscription) {
    options.push({
      label: t('components.workshop.export.content.transcription'),
      value: 'transcription' as ExportContent,
    })
  }

  if (props.hasAnalysis) {
    options.push({
      label: t('components.workshop.export.content.analysis'),
      value: 'analysis' as ExportContent,
    })
  }

  return options
})

// Set default content based on availability
watch(
  [() => props.hasTranscription, () => props.hasAnalysis],
  ([hasTrans, hasAnal]) => {
    if (hasTrans && hasAnal) {
      selectedContent.value = 'both'
    } else if (hasTrans) {
      selectedContent.value = 'transcription'
    } else if (hasAnal) {
      selectedContent.value = 'analysis'
    }
  },
  { immediate: true }
)

async function exportDocument(format: ExportFormat) {
  if (loading.value) return

  loading.value = true
  open.value = false

  try {
    // Build URL with query params for public shared export endpoint
    const url = new URL(`${config.public.apiUrl}/shared/${props.identifier}/export`)
    url.searchParams.set('format', format)
    url.searchParams.set('content', selectedContent.value)

    // Note: Using native fetch for blob response (no authentication required for shared pages)
    // Accept-Language header added for i18n consistency
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept-Language': locale.value,
      },
    })

    if (!response.ok) {
      throw new Error(t('components.workshop.export.error'))
    }

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `${props.audioTitle || 'audio'}-${selectedContent.value}.${format}`

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) {
        filename = match[1]
      }
    }

    // Download the file
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)

    toast.add({
      title: t('components.workshop.export.success'),
      color: 'success',
    })
  } catch (error) {
    console.error('Export error:', error)
    toast.add({
      title: t('components.workshop.export.error'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-download"
      color="neutral"
      variant="ghost"
      size="sm"
      :loading="loading"
      :disabled="!hasTranscription && !hasAnalysis"
    />

    <template #content>
      <div class="min-w-52 p-3">
        <!-- Content selector (only if both available) -->
        <div v-if="contentOptions.length > 1" class="mb-3">
          <p class="text-muted mb-2 text-xs">
            {{ t('components.workshop.export.content.label') }}
          </p>
          <URadioGroup v-model="selectedContent" :items="contentOptions" size="sm" />
        </div>

        <!-- Separator -->
        <div v-if="contentOptions.length > 1" class="border-default my-3 border-t" />

        <!-- Format label -->
        <p class="text-muted mb-2 text-xs">
          {{ t('components.workshop.export.format.label') }}
        </p>

        <!-- Format options -->
        <div class="space-y-1">
          <UButton
            v-for="format in formatOptions"
            :key="format.value"
            :icon="format.icon"
            :label="format.label"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
            :disabled="loading"
            @click="exportDocument(format.value)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
type ExportFormat = 'pdf' | 'docx' | 'txt' | 'md'
type ExportContent = 'transcription' | 'analysis' | 'both'

const props = withDefaults(defineProps<{
  audioId: number
  audioTitle?: string | null
  hasTranscription: boolean
  hasAnalysis: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  size: 'sm',
})

const { t, locale } = useI18n()
const toast = useToast()
const { token } = useAuth()
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
    extension: '.pdf'
  },
  {
    label: t('components.workshop.export.format.docx'),
    value: 'docx' as ExportFormat,
    icon: 'i-lucide-file-type',
    extension: '.docx'
  },
  {
    label: t('components.workshop.export.format.txt'),
    value: 'txt' as ExportFormat,
    icon: 'i-lucide-file',
    extension: '.txt'
  },
  {
    label: t('components.workshop.export.format.md'),
    value: 'md' as ExportFormat,
    icon: 'i-lucide-file-code',
    extension: '.md'
  }
])

// Content options
const contentOptions = computed(() => {
  const options = []

  if (props.hasTranscription && props.hasAnalysis) {
    options.push({
      label: t('components.workshop.export.content.both'),
      value: 'both' as ExportContent
    })
  }

  if (props.hasTranscription) {
    options.push({
      label: t('components.workshop.export.content.transcription'),
      value: 'transcription' as ExportContent
    })
  }

  if (props.hasAnalysis) {
    options.push({
      label: t('components.workshop.export.content.analysis'),
      value: 'analysis' as ExportContent
    })
  }

  return options
})

// Set default content based on availability
watch([() => props.hasTranscription, () => props.hasAnalysis], ([hasTrans, hasAnal]) => {
  if (hasTrans && hasAnal) {
    selectedContent.value = 'both'
  } else if (hasTrans) {
    selectedContent.value = 'transcription'
  } else if (hasAnal) {
    selectedContent.value = 'analysis'
  }
}, { immediate: true })

async function exportDocument (format: ExportFormat) {
  if (loading.value) { return }

  loading.value = true
  open.value = false

  try {
    // Note: Using native fetch for blob response (useApi/$fetch auto-parses to JSON)
    // Accept-Language header added for i18n consistency with useApi pattern
    const response = await fetch(`${config.public.apiUrl}/audios/${props.audioId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': locale.value,
        Authorization: `Bearer ${token.value}`
      },
      body: JSON.stringify({
        format,
        content: selectedContent.value
      })
    })

    if (!response.ok) {
      throw new Error(t('components.workshop.export.error'))
    }

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `${props.audioTitle || 'audio'}-${selectedContent.value}.${format}`

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match?.[1]) {
        filename = match[1]
      }
    }

    // Download the file
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      title: t('components.workshop.export.success'),
      color: 'success'
    })
  } catch (error) {
    // eslint-disable-next-line no-console -- Debug logging
    console.error('Export error:', error)
    toast.add({
      title: t('components.workshop.export.error'),
      color: 'error'
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
      :size="props.size"
      :loading="loading"
      :disabled="!hasTranscription && !hasAnalysis"
    />

    <template #content>
      <div class="p-3 min-w-52">
        <!-- Content selector (only if both available) -->
        <div v-if="contentOptions.length > 1" class="mb-3">
          <p class="text-xs text-muted mb-2">
            {{ t('components.workshop.export.content.label') }}
          </p>
          <URadioGroup
            v-model="selectedContent"
            :items="contentOptions"
            size="sm"
          />
        </div>

        <!-- Separator -->
        <div v-if="contentOptions.length > 1" class="border-t border-default my-3" />

        <!-- Format label -->
        <p class="text-xs text-muted mb-2">
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

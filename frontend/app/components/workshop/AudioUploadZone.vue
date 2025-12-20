<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  'file-selected': [file: File]
}>()

const { t } = useI18n()
const { validateFile, formatMaxSize } = useAudioUpload()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const validationError = ref<string | null>(null)

function handleFiles(files: FileList | null) {
  if (!files || files.length === 0 || props.disabled) return

  const file = files[0]
  const validation = validateFile(file)

  if (!validation.valid) {
    validationError.value = validation.error || t('components.workshop.upload.invalidFile')
    return
  }

  validationError.value = null
  emit('file-selected', file)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (props.disabled) return
  handleFiles(event.dataTransfer?.files || null)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (!props.disabled) {
    isDragging.value = true
  }
}

function handleDragLeave() {
  isDragging.value = false
}

function openFilePicker() {
  if (!props.disabled) {
    fileInput.value?.click()
  }
}

function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  handleFiles(target.files)
  target.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
      :class="[
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-default hover:border-primary/50 hover:bg-elevated/50',
        disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @drop.prevent="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="openFilePicker"
    >
      <input
        ref="fileInput"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        class="hidden"
        :disabled="disabled || loading"
        @change="handleInputChange"
      />

      <div v-if="loading" class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-loader-2" class="w-12 h-12 text-primary animate-spin" />
        <p class="text-highlighted font-medium">
          {{ t('components.workshop.upload.uploading') }}
        </p>
      </div>

      <div v-else class="flex flex-col items-center gap-3">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <UIcon name="i-lucide-upload-cloud" class="w-8 h-8 text-primary" />
        </div>

        <div>
          <p class="text-highlighted font-medium mb-1">
            {{ t('components.workshop.upload.title') }}
          </p>
          <p class="text-muted text-sm">
            {{ t('components.workshop.upload.description') }}
          </p>
        </div>

        <UBadge color="neutral" variant="subtle" class="text-xs">
          {{ t('components.workshop.upload.formats', { maxSize: formatMaxSize() }) }}
        </UBadge>
      </div>
    </div>

    <UAlert
      v-if="validationError"
      color="error"
      variant="subtle"
      :title="validationError"
      icon="i-lucide-alert-circle"
      :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
      @close="validationError = null"
    />
  </div>
</template>

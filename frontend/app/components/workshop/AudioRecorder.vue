<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  'recording-complete': [file: File]
}>()

const { t } = useI18n()
const { state, isSupported, start, pause, resume, stop, reset, getFile, formatDuration } =
  useAudioRecorder()

async function handleStart() {
  await start()
}

function handleStop() {
  stop()
}

function handleUseRecording() {
  const file = getFile()
  if (file) {
    emit('recording-complete', file)
    reset()
  }
}

function handleDiscard() {
  reset()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Not supported message -->
    <UAlert
      v-if="!isSupported"
      color="warning"
      variant="subtle"
      :title="t('components.workshop.recorder.notSupported')"
      icon="i-lucide-mic-off"
    />

    <!-- Recorder UI -->
    <div v-else class="p-6 rounded-xl border border-default bg-elevated/50 text-center">
      <!-- Recording indicator -->
      <div
        class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center transition-all"
        :class="state.isRecording ? 'bg-error/20 animate-pulse' : 'bg-primary/10'"
      >
        <UIcon
          :name="state.isRecording ? 'i-lucide-mic' : 'i-lucide-mic-off'"
          class="w-10 h-10"
          :class="state.isRecording ? 'text-error' : 'text-primary'"
        />
      </div>

      <!-- Duration -->
      <p class="text-2xl font-mono font-bold text-highlighted mb-4">
        {{ formatDuration(state.duration) }}
      </p>

      <!-- Error message -->
      <UAlert
        v-if="state.error"
        color="error"
        variant="subtle"
        :title="state.error"
        icon="i-lucide-alert-circle"
        class="mb-4 text-left"
      />

      <!-- Controls -->
      <div class="flex items-center justify-center gap-3">
        <!-- Start recording -->
        <UButton
          v-if="!state.isRecording && !state.audioBlob"
          :label="t('components.workshop.recorder.start')"
          icon="i-lucide-mic"
          color="error"
          size="lg"
          :disabled="disabled"
          @click="handleStart"
        />

        <!-- Stop recording -->
        <UButton
          v-if="state.isRecording"
          :label="t('components.workshop.recorder.stop')"
          icon="i-lucide-square"
          color="error"
          variant="outline"
          size="lg"
          @click="handleStop"
        />

        <!-- Pause/Resume -->
        <UButton
          v-if="state.isRecording"
          :icon="state.isPaused ? 'i-lucide-play' : 'i-lucide-pause'"
          color="neutral"
          variant="ghost"
          size="lg"
          @click="state.isPaused ? resume() : pause()"
        />
      </div>

      <!-- Preview recorded audio -->
      <div v-if="state.audioUrl" class="mt-6 space-y-4">
        <audio :src="state.audioUrl" controls class="w-full" />

        <div class="flex items-center justify-center gap-3">
          <UButton
            :label="t('components.workshop.recorder.use')"
            icon="i-lucide-check"
            color="primary"
            @click="handleUseRecording"
          />
          <UButton
            :label="t('components.workshop.recorder.discard')"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            @click="handleDiscard"
          />
        </div>
      </div>
    </div>
  </div>
</template>

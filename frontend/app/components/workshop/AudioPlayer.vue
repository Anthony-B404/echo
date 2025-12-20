<script setup lang="ts">
const props = defineProps<{
  src: string
  duration?: number | null
}>()

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const totalDuration = ref(props.duration || 0)
const volume = ref(1)
const isMuted = ref(false)

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function togglePlay() {
  if (!audioRef.value) return

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
}

function toggleMute() {
  if (!audioRef.value) return
  isMuted.value = !isMuted.value
  audioRef.value.muted = isMuted.value
}

function handleTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

function handleLoadedMetadata() {
  if (audioRef.value) {
    totalDuration.value = audioRef.value.duration
  }
}

function handleSeek(value: number) {
  if (audioRef.value) {
    audioRef.value.currentTime = value
    currentTime.value = value
  }
}

function handleVolumeChange(value: number) {
  if (audioRef.value) {
    volume.value = value
    audioRef.value.volume = value
    isMuted.value = value === 0
  }
}

function handleEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

function skipBackward() {
  if (audioRef.value) {
    audioRef.value.currentTime = Math.max(0, audioRef.value.currentTime - 10)
  }
}

function skipForward() {
  if (audioRef.value) {
    audioRef.value.currentTime = Math.min(totalDuration.value, audioRef.value.currentTime + 10)
  }
}

watch(
  () => props.src,
  () => {
    isPlaying.value = false
    currentTime.value = 0
  }
)
</script>

<template>
  <div class="p-4 rounded-lg bg-elevated border border-default">
    <audio
      ref="audioRef"
      :src="src"
      preload="metadata"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="handleEnded"
    />

    <!-- Progress bar -->
    <div class="mb-4">
      <USlider
        :model-value="currentTime"
        :max="totalDuration || 100"
        :step="0.1"
        size="sm"
        @update:model-value="handleSeek"
      />
      <div class="flex justify-between text-xs text-muted mt-1">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(totalDuration) }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Skip backward -->
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="skipBackward"
        />

        <!-- Play/Pause -->
        <UButton
          :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
          color="primary"
          size="lg"
          class="rounded-full"
          @click="togglePlay"
        />

        <!-- Skip forward -->
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="skipForward"
        />
      </div>

      <!-- Volume control -->
      <div class="flex items-center gap-2">
        <UButton
          :icon="isMuted || volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleMute"
        />
        <div class="w-24">
          <USlider
            :model-value="isMuted ? 0 : volume"
            :max="1"
            :step="0.1"
            size="xs"
            @update:model-value="handleVolumeChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

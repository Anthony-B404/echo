<script setup lang="ts">
const props = defineProps<{
  audioId: number
  disabled?: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const { getAuthHeaders } = useAuth()
const config = useRuntimeConfig()

const smBreakpoint = 640
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : smBreakpoint)
const isMobile = computed(() => windowWidth.value < smBreakpoint)

onMounted(() => {
  const onResize = () => { windowWidth.value = window.innerWidth }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))
})

const loading = ref(false)
const isPlaying = ref(false)
const objectUrl = ref<string | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)

const hasAudio = computed(() => !!objectUrl.value)
const currentSpeedLabel = computed(() => `${playbackRate.value}x`)

const speedOptions = [
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2x', value: 2 },
]

const speedMenuItems = computed(() => [
  speedOptions.map((opt) => ({
    label: opt.label,
    onSelect: () => setSpeed(opt.value),
  })),
])

const supportsMediaSource =
  typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')

function formatTime(s: number): string {
  if (!isFinite(s)) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function attachAudioListeners(audio: HTMLAudioElement) {
  audio.addEventListener('play', () => { isPlaying.value = true })
  audio.addEventListener('pause', () => { isPlaying.value = false })
  audio.addEventListener('ended', () => { isPlaying.value = false })
  audio.addEventListener('error', () => {
    isPlaying.value = false
    loading.value = false
  })
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
  })
  audio.addEventListener('durationchange', () => {
    duration.value = audio.duration
  })
}

function skipBackward() {
  if (!audioEl.value) return
  audioEl.value.currentTime = Math.max(0, audioEl.value.currentTime - 10)
}

function skipForward() {
  if (!audioEl.value) return
  audioEl.value.currentTime = Math.min(
    audioEl.value.duration || Infinity,
    audioEl.value.currentTime + 10
  )
}

function handleSeek(val: number | undefined) {
  if (!audioEl.value || val == null) return
  audioEl.value.currentTime = val
}

function setSpeed(rate: number) {
  playbackRate.value = rate
  if (audioEl.value) {
    audioEl.value.playbackRate = rate
  }
}

async function loadAndPlay() {
  if (loading.value) return

  // If already loaded, just replay
  if (objectUrl.value && audioEl.value) {
    audioEl.value.currentTime = 0
    audioEl.value.play()
    return
  }

  loading.value = true
  try {
    if (supportsMediaSource) {
      await streamWithMediaSource()
    } else {
      await fetchFullBlob()
    }
  } catch {
    toast.add({
      title: t('pages.dashboard.workshop.detail.tts.error'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function streamWithMediaSource() {
  const audio = new Audio()
  const mediaSource = new MediaSource()
  const url = URL.createObjectURL(mediaSource)
  objectUrl.value = url
  audio.src = url
  audio.playbackRate = playbackRate.value
  audioEl.value = audio

  attachAudioListeners(audio)

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', async () => {
      let started = false
      const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')

      try {
        const response = await fetch(
          `${config.public.apiUrl}/audios/${props.audioId}/tts`,
          { headers: getAuthHeaders() as HeadersInit }
        )

        if (!response.ok) throw new Error(`TTS failed: ${response.status}`)

        const reader = response.body!.getReader()

        while (true) {
          const { value, done } = await reader.read()

          if (done) break

          // Wait for previous append to complete
          if (sourceBuffer.updating) {
            await new Promise<void>(r =>
              sourceBuffer.addEventListener('updateend', () => r(), { once: true })
            )
          }

          sourceBuffer.appendBuffer(value)

          // Start playing as soon as we have data
          if (!started) {
            await new Promise<void>(r =>
              sourceBuffer.addEventListener('updateend', () => r(), { once: true })
            )
            audio.play()
            started = true
            loading.value = false
          }
        }
      } catch (err) {
        // If audio never started, reject so the toast is shown
        if (!started) {
          reject(err)
          return
        }
        // Otherwise, let the buffered audio finish playing
        console.warn('TTS stream error (audio continues with buffered data):', err)
      }

      // Always properly end the stream so the 'ended' event fires
      try {
        if (sourceBuffer.updating) {
          await new Promise<void>(r =>
            sourceBuffer.addEventListener('updateend', () => r(), { once: true })
          )
        }
        if (mediaSource.readyState === 'open') {
          mediaSource.endOfStream()
        }
      } catch {
        // Ignore endOfStream errors
      }

      resolve()
    })

    mediaSource.addEventListener('error', reject)
  })
}

async function fetchFullBlob() {
  const response = await fetch(
    `${config.public.apiUrl}/audios/${props.audioId}/tts`,
    { headers: getAuthHeaders() as HeadersInit }
  )

  if (!response.ok) throw new Error(`TTS failed: ${response.status}`)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  objectUrl.value = url

  const audio = new Audio(url)
  audio.playbackRate = playbackRate.value
  audioEl.value = audio

  attachAudioListeners(audio)

  await audio.play()
}

function togglePlay() {
  if (loading.value) return

  if (!objectUrl.value) {
    loadAndPlay()
    return
  }

  if (isPlaying.value) {
    audioEl.value?.pause()
  } else {
    audioEl.value?.play()
  }
}

onUnmounted(() => {
  audioEl.value?.pause()
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
  }
})
</script>

<template>
  <!-- Initial: just the play button -->
  <UButton
    v-if="!hasAudio"
    :icon="isPlaying ? 'i-lucide-square' : 'i-lucide-volume-2'"
    :loading="loading"
    loading-icon="i-lucide-loader-2"
    color="primary"
    variant="ghost"
    size="sm"
    class=""
    :label="t('pages.dashboard.workshop.detail.tts.button')"
    :disabled="disabled"
    @click="togglePlay"
  />

  <!-- Loaded: inline control bar -->
  <div v-else class="flex items-center gap-3">
    <!-- Transport controls -->
    <div class="flex items-center gap-2 sm:gap-1">
      <UButton
        icon="i-lucide-rotate-ccw"
        :size="isMobile ? 'md' : 'sm'"
        variant="ghost"
        color="neutral"
        :aria-label="t('pages.dashboard.workshop.detail.tts.skipBack')"
        @click="skipBackward"
      />
      <UButton
        :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
        :size="isMobile ? 'lg' : 'md'"
        variant="ghost"
        color="primary"
        @click="togglePlay"
      />
      <UButton
        icon="i-lucide-rotate-cw"
        :size="isMobile ? 'md' : 'sm'"
        variant="ghost"
        color="neutral"
        :aria-label="t('pages.dashboard.workshop.detail.tts.skipForward')"
        @click="skipForward"
      />
    </div>

    <!-- Time + speed -->
    <div class="flex items-center gap-3 sm:gap-2">
      <span class="text-sm sm:text-xs text-muted tabular-nums whitespace-nowrap">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
      <UDropdownMenu :items="speedMenuItems">
        <UButton :size="isMobile ? 'md' : 'sm'" variant="ghost" color="neutral" :label="currentSpeedLabel" />
      </UDropdownMenu>
    </div>
  </div>
</template>

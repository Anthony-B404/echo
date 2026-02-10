<script setup lang="ts">
const props = defineProps<{
  audioId: number
  disabled?: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const { getAuthHeaders } = useAuth()
const config = useRuntimeConfig()

const loading = ref(false)
const isPlaying = ref(false)
const objectUrl = ref<string | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)

const supportsMediaSource =
  typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')

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
  audioEl.value = audio

  audio.addEventListener('play', () => { isPlaying.value = true })
  audio.addEventListener('pause', () => { isPlaying.value = false })
  audio.addEventListener('ended', () => { isPlaying.value = false })

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', async () => {
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')

        const response = await fetch(
          `${config.public.apiUrl}/audios/${props.audioId}/tts`,
          { headers: getAuthHeaders() as HeadersInit }
        )

        if (!response.ok) throw new Error(`TTS failed: ${response.status}`)

        const reader = response.body!.getReader()
        let started = false

        while (true) {
          const { value, done } = await reader.read()

          if (done) {
            if (sourceBuffer.updating) {
              await new Promise<void>(r =>
                sourceBuffer.addEventListener('updateend', () => r(), { once: true })
              )
            }
            mediaSource.endOfStream()
            break
          }

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

        resolve()
      } catch (err) {
        reject(err)
      }
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
  audioEl.value = audio

  audio.addEventListener('play', () => { isPlaying.value = true })
  audio.addEventListener('pause', () => { isPlaying.value = false })
  audio.addEventListener('ended', () => { isPlaying.value = false })

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
  <UButton
    :icon="isPlaying ? 'i-lucide-square' : 'i-lucide-volume-2'"
    :loading="loading"
    loading-icon="i-lucide-loader-2"
    color="primary"
    variant="ghost"
    size="sm"
    :label="t('pages.dashboard.workshop.detail.tts.button')"
    :disabled="disabled"
    @click="togglePlay"
  />
</template>

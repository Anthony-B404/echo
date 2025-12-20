import type { RecorderState } from '~/types/audio'

export function useAudioRecorder() {
  const state = reactive<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
  })

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let durationInterval: ReturnType<typeof setInterval> | null = null
  let stream: MediaStream | null = null

  /**
   * Check if recording is supported
   */
  const isSupported = computed(() => {
    if (import.meta.server) return false
    return (
      typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices
    )
  })

  /**
   * Get best supported MIME type
   */
  function getBestMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/wav'

    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus'
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm'
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return 'audio/mp4'
    }
    if (MediaRecorder.isTypeSupported('audio/ogg')) {
      return 'audio/ogg'
    }
    return 'audio/wav'
  }

  /**
   * Start recording
   */
  async function start(): Promise<boolean> {
    if (!isSupported.value) {
      state.error = 'Audio recording is not supported in this browser'
      return false
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const mimeType = getBestMimeType()

      mediaRecorder = new MediaRecorder(stream, { mimeType })
      audioChunks = []
      state.duration = 0
      state.error = null
      state.audioBlob = null
      state.audioUrl = null

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm'
        const blob = new Blob(audioChunks, { type: mimeType })
        state.audioBlob = blob
        state.audioUrl = URL.createObjectURL(blob)
        stopDurationTimer()
      }

      mediaRecorder.onerror = (event: any) => {
        state.error = event.error?.message || 'Recording error occurred'
        stop()
      }

      mediaRecorder.start(1000) // Collect data every second
      state.isRecording = true
      state.isPaused = false
      startDurationTimer()

      return true
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        state.error = 'Microphone access denied. Please allow microphone access.'
      } else if (err.name === 'NotFoundError') {
        state.error = 'No microphone found. Please connect a microphone.'
      } else {
        state.error = err.message || 'Failed to start recording'
      }
      return false
    }
  }

  /**
   * Pause recording
   */
  function pause() {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.pause()
      state.isPaused = true
      stopDurationTimer()
    }
  }

  /**
   * Resume recording
   */
  function resume() {
    if (mediaRecorder?.state === 'paused') {
      mediaRecorder.resume()
      state.isPaused = false
      startDurationTimer()
    }
  }

  /**
   * Stop recording
   */
  function stop() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
    state.isRecording = false
    state.isPaused = false
    stopDurationTimer()
  }

  /**
   * Reset to initial state
   */
  function reset() {
    stop()
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    state.audioBlob = null
    state.audioUrl = null
    state.duration = 0
    state.error = null
    audioChunks = []
  }

  /**
   * Start duration timer
   */
  function startDurationTimer() {
    stopDurationTimer()
    durationInterval = setInterval(() => {
      state.duration += 1
    }, 1000)
  }

  /**
   * Stop duration timer
   */
  function stopDurationTimer() {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
  }

  /**
   * Get recorded audio as File
   */
  function getFile(): File | null {
    if (!state.audioBlob) return null

    const mimeType = state.audioBlob.type
    let extension = 'webm'

    if (mimeType.includes('mp4')) {
      extension = 'm4a'
    } else if (mimeType.includes('ogg')) {
      extension = 'ogg'
    } else if (mimeType.includes('wav')) {
      extension = 'wav'
    }

    return new File([state.audioBlob], `recording-${Date.now()}.${extension}`, {
      type: state.audioBlob.type,
    })
  }

  /**
   * Format duration for display (mm:ss or hh:mm:ss)
   */
  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  onUnmounted(() => {
    reset()
  })

  return {
    // State
    state: readonly(state),
    isSupported,

    // Methods
    start,
    pause,
    resume,
    stop,
    reset,
    getFile,
    formatDuration,
  }
}

import type { JobStatus, AudioStatus } from '~/types/audio'

export interface UseAudioPollingOptions {
  /** Initial polling interval in ms (default: 2000) */
  initialInterval?: number
  /** Maximum polling interval in ms (default: 30000) */
  maxInterval?: number
  /** Backoff multiplier (default: 1.5) */
  backoffFactor?: number
  /** Maximum polling attempts (default: 60) */
  maxAttempts?: number
  /** Callback when status changes */
  onStatusChange?: (status: JobStatus) => void
  /** Callback when processing completes */
  onComplete?: (result: JobStatus) => void
  /** Callback when processing fails or max attempts reached */
  onError?: (error: Error) => void
}

export function useAudioPolling(options: UseAudioPollingOptions = {}) {
  const {
    initialInterval = 2000,
    maxInterval = 30000,
    backoffFactor = 1.5,
    maxAttempts = 60,
    onStatusChange,
    onComplete,
    onError,
  } = options

  const { authenticatedFetch } = useAuth()
  const audioStore = useAudioStore()

  const polling = ref(false)
  const currentJobId = ref<string | null>(null)
  const currentAudioId = ref<number | null>(null)
  const attempts = ref(0)
  const currentInterval = ref(initialInterval)

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  /**
   * Fetch job status from API
   */
  async function fetchStatus(jobId: string): Promise<JobStatus | null> {
    try {
      const status = await authenticatedFetch<JobStatus>(`/audio/status/${jobId}`)
      return status
    } catch (err: any) {
      console.error('Polling error:', err)
      return null
    }
  }

  /**
   * Single poll iteration
   */
  async function poll() {
    if (!polling.value || !currentJobId.value || !currentAudioId.value) return

    attempts.value += 1

    // Check max attempts
    if (attempts.value > maxAttempts) {
      stopPolling()
      onError?.(new Error('Maximum polling attempts reached. Please refresh to check status.'))
      return
    }

    const status = await fetchStatus(currentJobId.value)

    if (!status) {
      // Retry with backoff on network error
      scheduleNextPoll()
      return
    }

    // Update store with job status
    audioStore.updateJobStatus(currentJobId.value, status)
    onStatusChange?.(status)

    // Handle completion
    if (status.status === 'completed') {
      stopPolling()
      audioStore.removeJob(currentJobId.value!, currentAudioId.value!)
      audioStore.updateAudioStatus(currentAudioId.value!, 'completed' as AudioStatus)
      // Refresh the audio to get transcription
      await audioStore.fetchAudio(currentAudioId.value!)
      onComplete?.(status)
      return
    }

    // Handle failure
    if (status.status === 'failed') {
      stopPolling()
      audioStore.removeJob(currentJobId.value!, currentAudioId.value!)
      audioStore.updateAudioStatus(currentAudioId.value!, 'failed' as AudioStatus, status.error)
      onError?.(new Error(status.error || 'Processing failed'))
      return
    }

    // Continue polling with backoff
    scheduleNextPoll()
  }

  /**
   * Schedule next poll with exponential backoff
   */
  function scheduleNextPoll() {
    // Apply exponential backoff
    currentInterval.value = Math.min(currentInterval.value * backoffFactor, maxInterval)

    timeoutId = setTimeout(() => {
      poll()
    }, currentInterval.value)
  }

  /**
   * Start polling for a job
   */
  function startPolling(jobId: string, audioId: number) {
    // Stop any existing polling
    stopPolling()

    polling.value = true
    currentJobId.value = jobId
    currentAudioId.value = audioId
    attempts.value = 0
    currentInterval.value = initialInterval

    // Track in store
    audioStore.trackJob(jobId, audioId)

    // Start polling immediately
    poll()
  }

  /**
   * Stop polling
   */
  function stopPolling() {
    polling.value = false

    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    currentJobId.value = null
    currentAudioId.value = null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
  })

  return {
    // State
    polling: readonly(polling),
    currentJobId: readonly(currentJobId),
    currentAudioId: readonly(currentAudioId),
    attempts: readonly(attempts),

    // Methods
    startPolling,
    stopPolling,
  }
}

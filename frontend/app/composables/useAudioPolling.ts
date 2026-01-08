import { AudioStatus } from '~/types/audio'
import type { JobStatus } from '~/types/audio'

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

/**
 * Internal state for each active poll
 */
interface ActivePoll {
  jobId: string
  audioId: number
  attempts: number
  interval: number
  timeoutId: ReturnType<typeof setTimeout> | null
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

  // Map of active polls - supports multiple concurrent jobs
  const activePolls = ref<Map<string, ActivePoll>>(new Map())

  // Computed: true if any job is being polled
  const polling = computed(() => activePolls.value.size > 0)

  /**
   * Fetch job status from API
   */
  async function fetchStatus(jobId: string): Promise<JobStatus | null> {
    const poll = activePolls.value.get(jobId)
    if (!poll) return null

    try {
      const status = await authenticatedFetch<JobStatus>(`/audio/status/${jobId}`)
      return status
    } catch (err: any) {
      // Handle 404 - job may have completed and currentJobId was cleared
      if (err?.response?.status === 404 || err?.statusCode === 404 || err?.data?.status === 404) {
        // Fetch the audio directly to check its current status
        try {
          await audioStore.fetchAudio(poll.audioId)
          const audio = audioStore.currentAudio
          if (audio && (audio.status === AudioStatus.Completed || audio.status === AudioStatus.Failed)) {
            // Job finished, return synthetic status to trigger completion handlers
            return {
              jobId,
              status: audio.status,
              progress: 100,
              error: audio.status === AudioStatus.Failed ? (audio.errorMessage ?? undefined) : undefined,
            } as JobStatus
          }
        } catch {
          // If audio fetch also fails, treat as real error
        }
      }
      console.error('Polling error:', err)
      return null
    }
  }

  /**
   * Single poll iteration for a specific job
   */
  async function pollJob(jobId: string) {
    const poll = activePolls.value.get(jobId)
    if (!poll) return

    poll.attempts += 1

    // Check max attempts
    if (poll.attempts > maxAttempts) {
      stopPollingForJob(jobId)
      onError?.(new Error('Maximum polling attempts reached. Please refresh to check status.'))
      return
    }

    const status = await fetchStatus(jobId)

    if (!status) {
      // Retry with backoff on network error
      scheduleNextPoll(jobId)
      return
    }

    // Update store with job status
    audioStore.updateJobStatus(jobId, status)
    onStatusChange?.(status)

    // Handle completion
    if (status.status === AudioStatus.Completed) {
      const audioId = poll.audioId
      stopPollingForJob(jobId)
      audioStore.removeJob(jobId, audioId)
      audioStore.updateAudioStatus(audioId, AudioStatus.Completed)
      // Refresh the audio to get transcription
      await audioStore.fetchAudio(audioId)
      onComplete?.(status)
      return
    }

    // Handle failure
    if (status.status === AudioStatus.Failed) {
      const audioId = poll.audioId
      stopPollingForJob(jobId)
      audioStore.removeJob(jobId, audioId)
      audioStore.updateAudioStatus(audioId, AudioStatus.Failed, status.error)
      onError?.(new Error(status.error || 'Processing failed'))
      return
    }

    // Continue polling with backoff
    scheduleNextPoll(jobId)
  }

  /**
   * Schedule next poll with exponential backoff for a specific job
   */
  function scheduleNextPoll(jobId: string) {
    const poll = activePolls.value.get(jobId)
    if (!poll) return

    // Apply exponential backoff
    poll.interval = Math.min(poll.interval * backoffFactor, maxInterval)

    poll.timeoutId = setTimeout(() => {
      pollJob(jobId)
    }, poll.interval)
  }

  /**
   * Start polling for a job (supports multiple concurrent jobs)
   */
  function startPolling(jobId: string, audioId: number) {
    // Don't restart if already polling this job
    if (activePolls.value.has(jobId)) return

    // Create new poll entry
    const poll: ActivePoll = {
      jobId,
      audioId,
      attempts: 0,
      interval: initialInterval,
      timeoutId: null,
    }

    activePolls.value.set(jobId, poll)

    // Track in store
    audioStore.trackJob(jobId, audioId)

    // Start polling immediately
    pollJob(jobId)
  }

  /**
   * Stop polling for a specific job
   */
  function stopPollingForJob(jobId: string) {
    const poll = activePolls.value.get(jobId)
    if (!poll) return

    if (poll.timeoutId) {
      clearTimeout(poll.timeoutId)
    }

    activePolls.value.delete(jobId)
  }

  /**
   * Stop all active polling
   */
  function stopAllPolling() {
    activePolls.value.forEach((poll) => {
      if (poll.timeoutId) {
        clearTimeout(poll.timeoutId)
      }
    })
    activePolls.value.clear()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAllPolling()
  })

  return {
    // State
    polling: readonly(polling),
    activePolls: readonly(activePolls),

    // Methods
    startPolling,
    stopPollingForJob,
    stopAllPolling,
  }
}

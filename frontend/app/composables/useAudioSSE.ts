import { AudioStatus } from '~/types/audio'
import type { JobStatus } from '~/types/audio'

export interface UseAudioSSEOptions {
  /** Callback when status changes */
  onStatusChange?: (status: JobStatus) => void
  /** Callback when processing completes */
  onComplete?: (result: JobStatus) => void
  /** Callback when processing fails */
  onError?: (error: Error) => void
  /** Max consecutive errors before falling back to polling (default: 3) */
  maxSSEErrors?: number
}

/**
 * Internal state for each active SSE connection
 */
interface ActiveSSE {
  jobId: string
  audioId: number
  eventSource: EventSource
  errorCount: number
  receivedEvent: boolean
}

/**
 * SSE-based composable for real-time audio job progress tracking.
 * Same interface as useAudioPolling for transparent swap.
 * Falls back to useAudioPolling after repeated SSE failures.
 */
export function useAudioSSE (options: UseAudioSSEOptions = {}) {
  const {
    onStatusChange,
    onComplete,
    onError,
    maxSSEErrors = 3
  } = options

  const { token } = useAuth()
  const audioStore = useAudioStore()
  const runtimeConfig = useRuntimeConfig()

  // SSE connections
  const activeConnections = ref<Map<string, ActiveSSE>>(new Map())

  // Polling fallback for jobs where SSE failed
  const pollingFallback = useAudioPolling({
    onStatusChange,
    onComplete,
    onError
  })

  // Computed: true if any job is being tracked (SSE or polling fallback)
  const polling = computed(() => activeConnections.value.size > 0 || pollingFallback.polling.value)

  /**
   * Handle SSE failure: fall back to polling for this specific job
   */
  function fallbackToPolling (jobId: string) {
    const conn = activeConnections.value.get(jobId)
    if (!conn) return

    console.warn(`[SSE] Falling back to polling for job ${jobId}`)

    // Close SSE connection
    conn.eventSource.close()
    const audioId = conn.audioId
    activeConnections.value.delete(jobId)

    // Start polling for this job
    pollingFallback.startPolling(jobId, audioId)
  }

  /**
   * Start SSE tracking for a job
   */
  function startPolling (jobId: string, audioId: number) {
    // Don't restart if already tracking this job
    if (activeConnections.value.has(jobId)) return

    // Track in store
    audioStore.trackJob(jobId, audioId)

    // Build SSE URL
    const baseUrl = runtimeConfig.public.apiUrl
    const url = `${baseUrl}/audio/events/${jobId}?token=${encodeURIComponent(token.value || '')}`

    const eventSource = new EventSource(url)

    const conn: ActiveSSE = {
      jobId,
      audioId,
      eventSource,
      errorCount: 0,
      receivedEvent: false
    }

    activeConnections.value.set(jobId, conn)

    // Handle progress events
    eventSource.addEventListener('progress', (event) => {
      conn.receivedEvent = true
      conn.errorCount = 0

      try {
        const data = JSON.parse(event.data) as { jobId: string; progress: number; status: string }

        const status: JobStatus = {
          jobId: data.jobId,
          status: data.status as JobStatus['status'],
          progress: data.progress
        }

        audioStore.updateJobStatus(jobId, status)
        onStatusChange?.(status)
      } catch {
        // Ignore parse errors
      }
    })

    // Handle completed events
    eventSource.addEventListener('completed', (event) => {
      conn.receivedEvent = true

      try {
        const data = JSON.parse(event.data) as {
          jobId: string
          progress: number
          result?: { transcription: string; analysis?: string }
        }

        const status: JobStatus = {
          jobId: data.jobId,
          status: AudioStatus.Completed,
          progress: 100,
          result: data.result
        }

        // Close SSE connection
        eventSource.close()
        activeConnections.value.delete(jobId)

        // Update store
        audioStore.removeJob(jobId, audioId)
        audioStore.updateAudioStatus(audioId, AudioStatus.Completed)

        // Refresh the audio to get transcription
        audioStore.fetchAudio(audioId).then(() => {
          onComplete?.(status)
        })
      } catch {
        // Ignore parse errors
      }
    })

    // Handle failed events
    eventSource.addEventListener('failed', (event) => {
      conn.receivedEvent = true

      try {
        const data = JSON.parse(event.data) as { jobId: string; error: string }

        const status: JobStatus = {
          jobId: data.jobId,
          status: AudioStatus.Failed,
          progress: 0,
          error: data.error
        }

        // Close SSE connection
        eventSource.close()
        activeConnections.value.delete(jobId)

        // Update store
        audioStore.removeJob(jobId, audioId)
        audioStore.updateAudioStatus(audioId, AudioStatus.Failed, data.error)

        onError?.(new Error(data.error || 'Processing failed'))
      } catch {
        // Ignore parse errors
      }
    })

    // Handle SSE connection errors (network issues, server down, etc.)
    eventSource.onerror = () => {
      conn.errorCount++

      // If EventSource is CLOSED (permanent failure like CORS error),
      // it won't auto-reconnect — fall back to polling immediately
      if (eventSource.readyState === EventSource.CLOSED) {
        fallbackToPolling(jobId)
        return
      }

      // For transient errors (readyState === CONNECTING, auto-reconnecting),
      // fall back after max consecutive errors
      if (conn.errorCount >= maxSSEErrors) {
        fallbackToPolling(jobId)
      }

      // Otherwise let EventSource auto-reconnect
    }
  }

  /**
   * Stop SSE tracking for a specific job
   */
  function stopPollingForJob (jobId: string) {
    const conn = activeConnections.value.get(jobId)
    if (conn) {
      conn.eventSource.close()
      activeConnections.value.delete(jobId)
    }

    // Also stop polling fallback if active
    pollingFallback.stopPollingForJob(jobId)
  }

  /**
   * Stop all SSE connections and polling
   */
  function stopAllPolling () {
    activeConnections.value.forEach((conn) => {
      conn.eventSource.close()
    })
    activeConnections.value.clear()

    pollingFallback.stopAllPolling()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAllPolling()
  })

  return {
    // State
    polling: readonly(polling),

    // Methods
    startPolling,
    stopPollingForJob,
    stopAllPolling
  }
}

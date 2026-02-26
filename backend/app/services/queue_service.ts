import { Queue, Job, QueueEvents } from 'bullmq'
import queueConfig from '#config/queue'

/**
 * Data structure for transcription jobs.
 */
export interface TranscriptionJobData {
  jobId: string
  userId: number
  organizationId: number
  audioId: number
  audioFilePath: string
  audioFileName: string
  prompt: string
  locale: string
}

/**
 * Result structure for completed transcription jobs.
 */
export interface TranscriptionJobResult {
  transcription: string
  analysis: string
}

/**
 * Simplified job status.
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Callbacks for real-time job event subscription (SSE).
 */
export interface JobEventCallbacks {
  onProgress: (progress: number) => void
  onCompleted: (result?: TranscriptionJobResult) => void
  onFailed: (error: string) => void
}

/**
 * Response structure for job status queries.
 */
export interface JobStatusResponse {
  jobId: string
  status: JobStatus
  progress: number
  result?: TranscriptionJobResult
  error?: string
  createdAt?: Date
  processedAt?: Date
  completedAt?: Date
}

/**
 * Service for managing audio transcription job queue.
 * Uses BullMQ with Redis backend for async processing.
 *
 * Implements singleton pattern for consistent queue management.
 */
class QueueService {
  private transcriptionQueue: Queue<TranscriptionJobData, TranscriptionJobResult>
  private queueEvents: QueueEvents
  private static instance: QueueService

  private constructor() {
    const { connection } = queueConfig

    this.transcriptionQueue = new Queue<TranscriptionJobData, TranscriptionJobResult>(
      queueConfig.queues.transcription.name,
      { connection }
    )

    this.queueEvents = new QueueEvents(queueConfig.queues.transcription.name, { connection })
  }

  /**
   * Get singleton instance.
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService()
    }
    return QueueService.instance
  }

  /**
   * Add a transcription job to the queue.
   */
  async addTranscriptionJob(
    data: TranscriptionJobData
  ): Promise<Job<TranscriptionJobData, TranscriptionJobResult>> {
    const job = await this.transcriptionQueue.add('transcribe', data, {
      jobId: data.jobId,
      ...queueConfig.defaultJobOptions,
    })
    return job
  }

  /**
   * Get job status by ID.
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const job = await this.transcriptionQueue.getJob(jobId)

    if (!job) {
      return null
    }

    const state = await job.getState()
    const progress = (job.progress as number) || 0

    const response: JobStatusResponse = {
      jobId: job.id!,
      status: this.mapState(state),
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
    }

    if (state === 'completed') {
      response.result = job.returnvalue
      response.completedAt = job.finishedOn ? new Date(job.finishedOn) : undefined
    }

    if (state === 'failed') {
      response.error = job.failedReason || 'Unknown error'
    }

    return response
  }

  /**
   * Get the transcription queue for worker registration.
   */
  getTranscriptionQueue(): Queue<TranscriptionJobData, TranscriptionJobResult> {
    return this.transcriptionQueue
  }

  /**
   * Map BullMQ state to simplified status.
   */
  private mapState(state: string): JobStatus {
    switch (state) {
      case 'waiting':
      case 'delayed':
      case 'prioritized':
        return 'pending'
      case 'active':
        return 'processing'
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      default:
        return 'pending'
    }
  }

  /**
   * Subscribe to real-time events for a specific job.
   * Returns an unsubscribe function to clean up listeners.
   */
  subscribeToJob(jobId: string, callbacks: JobEventCallbacks): () => void {
    const onProgress = (
      args: { jobId: string; data: string | boolean | number | object },
      _id: string
    ) => {
      if (args.jobId !== jobId) return
      const progress = typeof args.data === 'number' ? args.data : 0
      callbacks.onProgress(progress)
    }

    const onCompleted = (
      args: { jobId: string; returnvalue: string },
      _id: string
    ) => {
      if (args.jobId !== jobId) return
      let result: TranscriptionJobResult | undefined
      try {
        result = JSON.parse(args.returnvalue) as TranscriptionJobResult
      } catch {
        // returnvalue may be empty or invalid
      }
      callbacks.onCompleted(result)
    }

    const onFailed = (
      args: { jobId: string; failedReason: string },
      _id: string
    ) => {
      if (args.jobId !== jobId) return
      callbacks.onFailed(args.failedReason || 'Unknown error')
    }

    this.queueEvents.on('progress', onProgress)
    this.queueEvents.on('completed', onCompleted)
    this.queueEvents.on('failed', onFailed)

    return () => {
      this.queueEvents.off('progress', onProgress)
      this.queueEvents.off('completed', onCompleted)
      this.queueEvents.off('failed', onFailed)
    }
  }

  /**
   * Graceful shutdown - close connections.
   */
  async close(): Promise<void> {
    await this.transcriptionQueue.close()
    await this.queueEvents.close()
  }
}

export default QueueService

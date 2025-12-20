import { Worker, Job } from 'bullmq'
import queueConfig from '#config/queue'
import MistralService from '#services/mistral_service'
import storageService from '#services/storage_service'
import Audio, { AudioStatus } from '#models/audio'
import Transcription from '#models/transcription'
import type { TranscriptionJobData, TranscriptionJobResult } from '#services/queue_service'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

/**
 * Process transcription jobs.
 *
 * Progress stages:
 * - 0-10%: Downloading file from storage
 * - 10-50%: Transcribing audio with Mistral
 * - 50-90%: Analyzing with AI
 * - 90-100%: Cleanup and completion
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionJobResult> {
  const { audioId, audioFilePath, audioFileName, prompt } = job.data

  console.log(`[Job ${job.id}] Starting transcription for: ${audioFileName} (audioId: ${audioId})`)

  // Load audio record and set status to processing
  const audio = await Audio.find(audioId)
  if (audio) {
    audio.status = AudioStatus.Processing
    await audio.save()
  }

  // Stage 1: Download file from storage (0-10%)
  await job.updateProgress(5)

  const fileBuffer = await storageService.getFileBuffer(audioFilePath)

  // Write to temp file for Mistral API
  const tempPath = join(tmpdir(), `${randomUUID()}-${audioFileName}`)
  await writeFile(tempPath, fileBuffer)

  await job.updateProgress(10)
  console.log(`[Job ${job.id}] File downloaded to temp path`)

  try {
    // Stage 2: Transcribe audio (10-50%)
    const mistralService = new MistralService()

    await job.updateProgress(20)
    console.log(`[Job ${job.id}] Starting transcription...`)

    const transcription = await mistralService.transcribe(tempPath, audioFileName)

    await job.updateProgress(50)
    console.log(`[Job ${job.id}] Transcription complete (${transcription.length} chars)`)

    if (!transcription || transcription.trim() === '') {
      throw new Error('Transcription returned empty result')
    }

    // Stage 3: Analyze with AI (50-90%)
    await job.updateProgress(60)
    console.log(`[Job ${job.id}] Starting analysis...`)

    const analysis = await mistralService.analyze(transcription, prompt)

    await job.updateProgress(90)
    console.log(`[Job ${job.id}] Analysis complete (${analysis.length} chars)`)

    // Save transcription AND analysis to database
    if (audio) {
      await Transcription.create({
        audioId: audio.id,
        rawText: transcription,
        language: 'fr', // Default to French, could be detected later
        analysis: analysis,
      })
      console.log(`[Job ${job.id}] Transcription and analysis saved to database`)
    }

    // Stage 4: Cleanup and finalize (90-100%)
    await unlink(tempPath)

    // Update audio status to completed
    if (audio) {
      audio.status = AudioStatus.Completed
      await audio.save()
    }

    await job.updateProgress(100)
    console.log(`[Job ${job.id}] Job completed successfully`)

    return {
      transcription,
      analysis,
    }
  } catch (error) {
    // Update audio status to failed
    if (audio) {
      audio.status = AudioStatus.Failed
      audio.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await audio.save()
    }

    // Cleanup temp file on error
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }
    console.error(`[Job ${job.id}] Job failed:`, error)
    throw error
  }
}

/**
 * Create and start the transcription worker.
 */
export function createTranscriptionWorker(): Worker<TranscriptionJobData, TranscriptionJobResult> {
  const worker = new Worker<TranscriptionJobData, TranscriptionJobResult>(
    queueConfig.queues.transcription.name,
    processTranscriptionJob,
    {
      connection: queueConfig.connection,
      concurrency: queueConfig.queues.transcription.concurrency,
    }
  )

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message)
  })

  worker.on('progress', (job, progress) => {
    console.log(`[Worker] Job ${job.id} progress: ${progress}%`)
  })

  worker.on('error', (error) => {
    console.error('[Worker] Error:', error)
  })

  return worker
}

export default { createTranscriptionWorker }

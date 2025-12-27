import { Worker, Job } from 'bullmq'
import queueConfig from '#config/queue'
import MistralService, { type TranscriptionResult } from '#services/mistral_service'
import AudioChunkingService, { type ChunkingResult } from '#services/audio_chunking_service'
import storageService from '#services/storage_service'
import Audio, { AudioStatus } from '#models/audio'
import User from '#models/user'
import Transcription, { type TranscriptionTimestamp } from '#models/transcription'
import type { TranscriptionJobData, TranscriptionJobResult } from '#services/queue_service'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

/**
 * Context for merging transcription chunks
 */
interface MergeContext {
  lastEndTime: number
  segments: TranscriptionTimestamp[]
  fullText: string
  language: string | null
}

/**
 * Calculate progress percentage for chunk processing
 * Transcription phase: 10% to 70% (60% range distributed across chunks)
 */
function calculateChunkProgress(currentChunk: number, totalChunks: number): number {
  const TRANSCRIPTION_START = 10
  const TRANSCRIPTION_END = 70
  const TRANSCRIPTION_RANGE = TRANSCRIPTION_END - TRANSCRIPTION_START

  const perChunkRange = TRANSCRIPTION_RANGE / totalChunks
  return Math.round(TRANSCRIPTION_START + (currentChunk + 1) * perChunkRange)
}

/**
 * Deduplicate segments in overlap zone
 * Filters out segments that start before the previous chunk ended
 */
function deduplicateOverlap(
  prevSegments: TranscriptionTimestamp[],
  nextSegments: TranscriptionTimestamp[]
): TranscriptionTimestamp[] {
  if (prevSegments.length === 0 || nextSegments.length === 0) {
    return nextSegments
  }

  // Get the end time of previous segments
  const prevEnd = prevSegments[prevSegments.length - 1]?.end || 0

  // Keep only segments that start at or after where previous chunk ended
  // This removes any overlapping content regardless of how Mistral segmented it
  return nextSegments.filter((seg) => seg.start >= prevEnd)
}

/**
 * Merge chunk transcription into context with timestamp adjustment
 */
function mergeChunkTranscription(
  context: MergeContext,
  chunkResult: TranscriptionResult,
  chunkIndex: number,
  chunkStartTime: number // Position du chunk dans l'audio original
): MergeContext {
  // First chunk: use timestamps as-is
  if (chunkIndex === 0) {
    const lastSegment = chunkResult.segments[chunkResult.segments.length - 1]
    return {
      lastEndTime: lastSegment?.end || 0,
      segments: [...chunkResult.segments],
      fullText: chunkResult.text,
      language: chunkResult.language,
    }
  }

  // Subsequent chunks: use chunk's actual start time in original audio as offset
  const offset = chunkStartTime
  const adjustedSegments = chunkResult.segments.map((seg) => ({
    start: seg.start + offset,
    end: seg.end + offset,
    text: seg.text,
    speaker: seg.speaker,
  }))

  // Deduplicate segments in overlap zone
  const deduplicatedSegments = deduplicateOverlap(context.segments, adjustedSegments)

  const newLastEndTime =
    deduplicatedSegments[deduplicatedSegments.length - 1]?.end || context.lastEndTime

  return {
    lastEndTime: newLastEndTime,
    segments: [...context.segments, ...deduplicatedSegments],
    fullText: context.fullText + ' ' + chunkResult.text.trim(),
    language: context.language || chunkResult.language,
  }
}

/**
 * Process transcription jobs with chunking support for long audio files.
 *
 * Progress stages:
 * - 0-5%: Downloading file from storage
 * - 5-10%: Getting metadata and chunking if needed
 * - 10-70%: Transcribing audio chunks with Mistral
 * - 70-90%: Analyzing with AI
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

  // Stage 1: Download file from storage (0-5%)
  await job.updateProgress(2)

  const fileBuffer = await storageService.getFileBuffer(audioFilePath)

  // Write to temp file for processing
  const tempDir = tmpdir()
  const tempPath = join(tempDir, `${randomUUID()}-${audioFileName}`)
  await writeFile(tempPath, fileBuffer)

  await job.updateProgress(5)
  console.log(`[Job ${job.id}] File downloaded to temp path`)

  // Initialize chunking service and result tracking
  const chunkingService = new AudioChunkingService()
  let chunkingResult: ChunkingResult | null = null

  try {
    // Stage 2: Get metadata and chunk if needed (5-10%)
    await job.updateProgress(7)
    console.log(`[Job ${job.id}] Analyzing audio metadata...`)

    chunkingResult = await chunkingService.splitIntoChunks(tempPath, tempDir)

    // Update audio duration in database
    if (audio) {
      audio.duration = Math.round(chunkingResult.metadata.duration)
      await audio.save()
    }

    await job.updateProgress(10)

    if (chunkingResult.needsChunking) {
      console.log(
        `[Job ${job.id}] Audio requires chunking: ${chunkingResult.metadata.duration.toFixed(1)}s → ${chunkingResult.chunks.length} chunks`
      )
    } else {
      console.log(
        `[Job ${job.id}] Audio under threshold: ${chunkingResult.metadata.duration.toFixed(1)}s, no chunking needed`
      )
    }

    // Credit check: Calculate credits needed (1 credit = 1 minute, rounded up)
    const durationMinutes = Math.ceil(chunkingResult.metadata.duration / 60)
    const creditsNeeded = Math.max(1, durationMinutes) // Minimum 1 credit

    console.log(
      `[Job ${job.id}] Credits needed: ${creditsNeeded} (${chunkingResult.metadata.duration.toFixed(1)}s)`
    )

    // Load user and check credits
    const user = await User.find(job.data.userId)
    if (!user) {
      throw new Error('User not found')
    }

    if (!user.hasEnoughCredits(creditsNeeded)) {
      // Set audio status to failed with specific error
      if (audio) {
        audio.status = AudioStatus.Failed
        audio.errorMessage = `Insufficient credits. Required: ${creditsNeeded}, Available: ${user.credits}`
        audio.currentJobId = null
        await audio.save()
      }
      throw new Error(
        `Insufficient credits. Required: ${creditsNeeded}, Available: ${user.credits}`
      )
    }

    // Deduct credits
    const fileNameWithoutExt = audioFileName.replace(/\.[^/.]+$/, '')
    await user.deductCredits(
      creditsNeeded,
      `Analyse audio: ${fileNameWithoutExt} (${Math.round(chunkingResult.metadata.duration)}s)`,
      audioId
    )
    console.log(`[Job ${job.id}] Deducted ${creditsNeeded} credits. New balance: ${user.credits}`)

    // Stage 3: Transcribe audio chunks (10-70%)
    const mistralService = new MistralService()
    let transcriptionResult: TranscriptionResult

    if (chunkingResult.needsChunking) {
      // Process multiple chunks
      let mergeContext: MergeContext = {
        lastEndTime: 0,
        segments: [],
        fullText: '',
        language: null,
      }

      for (let i = 0; i < chunkingResult.chunks.length; i++) {
        const chunk = chunkingResult.chunks[i]
        console.log(
          `[Job ${job.id}] Transcribing chunk ${i + 1}/${chunkingResult.chunks.length} (${chunk.duration.toFixed(1)}s)...`
        )

        const chunkFileName = `chunk_${i}_${audioFileName}`
        const chunkTranscription = await mistralService.transcribe(chunk.path, chunkFileName)

        console.log(
          `[Job ${job.id}] Chunk ${i + 1} transcribed: ${chunkTranscription.text.length} chars, ${chunkTranscription.segments.length} segments`
        )

        // Merge with timestamp adjustment using chunk's position in original audio
        mergeContext = mergeChunkTranscription(mergeContext, chunkTranscription, i, chunk.startTime)

        // Update progress
        const progress = calculateChunkProgress(i, chunkingResult.chunks.length)
        await job.updateProgress(progress)
      }

      transcriptionResult = {
        text: mergeContext.fullText.trim(),
        segments: mergeContext.segments,
        language: mergeContext.language,
      }

      console.log(
        `[Job ${job.id}] All chunks merged: ${transcriptionResult.text.length} chars, ${transcriptionResult.segments.length} total segments`
      )
    } else {
      // Single file transcription (no chunking)
      console.log(`[Job ${job.id}] Starting transcription...`)
      transcriptionResult = await mistralService.transcribe(tempPath, audioFileName)
      await job.updateProgress(70)
    }

    console.log(
      `[Job ${job.id}] Transcription complete (${transcriptionResult.text.length} chars, ${transcriptionResult.segments.length} segments)`
    )

    if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
      throw new Error('Transcription returned empty result')
    }

    // Stage 4: Analyze with AI (70-90%)
    await job.updateProgress(75)
    console.log(`[Job ${job.id}] Starting analysis...`)

    const analysis = await mistralService.analyze(transcriptionResult.text, prompt)

    await job.updateProgress(90)
    console.log(`[Job ${job.id}] Analysis complete (${analysis.length} chars)`)

    // Save transcription AND analysis to database
    if (audio) {
      await Transcription.create({
        audioId: audio.id,
        rawText: transcriptionResult.text,
        timestamps: transcriptionResult.segments,
        language: transcriptionResult.language || 'fr',
        analysis: analysis,
      })
      console.log(`[Job ${job.id}] Transcription and analysis saved to database`)
    }

    // Stage 5: Cleanup and finalize (90-100%)
    await job.updateProgress(95)

    // Cleanup original temp file
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    // Cleanup chunk files if chunking was used
    if (chunkingResult.needsChunking) {
      await chunkingService.cleanupChunks(chunkingResult.chunks)
    }

    // Update audio status to completed and clear job ID
    if (audio) {
      audio.status = AudioStatus.Completed
      audio.currentJobId = null
      await audio.save()
    }

    await job.updateProgress(100)
    console.log(`[Job ${job.id}] Job completed successfully`)

    return {
      transcription: transcriptionResult.text,
      analysis,
    }
  } catch (error) {
    // Update audio status to failed and clear job ID
    if (audio) {
      audio.status = AudioStatus.Failed
      audio.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      audio.currentJobId = null
      await audio.save()
    }

    // Cleanup temp file on error
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    // Cleanup chunk files on error
    if (chunkingResult?.needsChunking) {
      await chunkingService.cleanupChunks(chunkingResult.chunks)
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

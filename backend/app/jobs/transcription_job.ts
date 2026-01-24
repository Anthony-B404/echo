import { Worker, Job } from 'bullmq'
import queueConfig from '#config/queue'
import MistralService, { type TranscriptionResult } from '#services/mistral_service'
import AudioChunkingService, { type ChunkingResult } from '#services/audio_chunking_service'
import AudioConverterService from '#services/audio_converter_service'
import storageService from '#services/storage_service'
import creditService from '#services/credit_service'
import Audio, { AudioStatus } from '#models/audio'
import User from '#models/user'
import Organization from '#models/organization'
import Transcription, { type TranscriptionTimestamp } from '#models/transcription'
import transcriptionVersionService from '#services/transcription_version_service'
import type { TranscriptionJobData, TranscriptionJobResult } from '#services/queue_service'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import i18nManager from '@adonisjs/i18n/services/main'

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
 * Transcription phase: 17% to 72% (55% range distributed across chunks)
 */
function calculateChunkProgress(currentChunk: number, totalChunks: number): number {
  const TRANSCRIPTION_START = 17
  const TRANSCRIPTION_END = 72
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
 * - 0-2%: Downloading file from storage
 * - 2-12%: Converting audio to Opus format
 * - 12-17%: Getting metadata and chunking if needed
 * - 17-72%: Transcribing audio chunks with Mistral
 * - 72-92%: Analyzing with AI
 * - 92-100%: Cleanup and completion
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionJobResult> {
  const { audioId, audioFilePath, audioFileName, prompt } = job.data

  // Load audio record and set status to processing
  const audio = await Audio.find(audioId)
  if (audio) {
    audio.status = AudioStatus.Processing
    await audio.save()
  }

  // Initialize tracking variables
  const tempDir = tmpdir()
  let tempOriginalPath: string | null = null
  let tempPath: string | null = null
  const converter = new AudioConverterService()
  const chunkingService = new AudioChunkingService()
  let chunkingResult: ChunkingResult | null = null

  try {
    // Stage 1: Download file from storage (0-2%)
    await job.updateProgress(1)

    const fileBuffer = await storageService.getFileBuffer(audioFilePath)

    // Write to temp file for processing
    tempOriginalPath = join(tempDir, `${randomUUID()}-original-${audioFileName}`)
    await writeFile(tempOriginalPath, fileBuffer)

    await job.updateProgress(2)

    // Stage 2: Convert to Opus format (2-12%)
    // Use simulated progress during ffmpeg conversion
    await job.updateProgress(3)

    // Start simulated progress during conversion (3% to 7%)
    let conversionProgress = 3
    const conversionInterval = setInterval(async () => {
      if (conversionProgress < 7) {
        conversionProgress++
        await job.updateProgress(conversionProgress).catch(() => {})
      }
    }, 500)

    let conversionResult
    try {
      conversionResult = await converter.convertToOpus(tempOriginalPath, 'voice')
    } finally {
      clearInterval(conversionInterval)
    }

    await job.updateProgress(8)

    // Store converted file in persistent storage
    await job.updateProgress(9)
    const convertedFile = await storageService.storeAudioFromPath(
      conversionResult.path,
      job.data.organizationId,
      {
        originalName: audioFileName.replace(/\.[^/.]+$/, '.opus'),
        mimeType: 'audio/opus',
      }
    )

    // Update Audio record with converted file info
    await job.updateProgress(10)
    if (audio) {
      audio.filePath = convertedFile.path
      audio.fileSize = convertedFile.size
      audio.mimeType = 'audio/opus'
      audio.duration = Math.round(conversionResult.duration)
      await audio.save()
    }

    // Delete original file from storage
    await storageService.deleteFile(audioFilePath).catch(() => {})

    // Cleanup temp files from conversion
    await job.updateProgress(11)
    await unlink(tempOriginalPath).catch(() => {})
    tempOriginalPath = null // Mark as cleaned
    await converter.cleanup(conversionResult.path)

    // Write converted file to temp for subsequent processing
    tempPath = join(tempDir, `${randomUUID()}-converted.opus`)
    const convertedBuffer = await storageService.getFileBuffer(convertedFile.path)
    await writeFile(tempPath, convertedBuffer)

    await job.updateProgress(12)

    // Stage 3: Get metadata and chunk if needed (12-17%)
    await job.updateProgress(14)

    chunkingResult = await chunkingService.splitIntoChunks(tempPath, tempDir)

    await job.updateProgress(17)

    // Credit check: Calculate credits needed (1 credit = 1 minute, rounded up)
    const durationMinutes = Math.ceil(chunkingResult.metadata.duration / 60)
    const creditsNeeded = Math.max(1, durationMinutes) // Minimum 1 credit

    // Load user and their organization to check credits
    const user = await User.find(job.data.userId)
    if (!user) {
      throw new Error('User not found')
    }

    if (!user.currentOrganizationId) {
      throw new Error('User has no current organization')
    }

    const organization = await Organization.find(user.currentOrganizationId)
    if (!organization) {
      throw new Error('Organization not found')
    }

    // Check credits based on organization's credit mode (shared vs individual)
    const hasCredits = await creditService.hasEnoughCreditsForProcessing(
      user,
      organization,
      creditsNeeded
    )

    if (!hasCredits) {
      // Set audio status to failed with specific error
      const effectiveBalance = await creditService.getEffectiveBalance(user, organization)
      const i18n = i18nManager.locale('fr')
      const errorMessage = i18n.t('messages.audio.insufficient_credits_details', {
        creditsNeeded,
        creditsAvailable: effectiveBalance,
      })

      if (audio) {
        audio.status = AudioStatus.Failed
        audio.errorMessage = errorMessage
        audio.currentJobId = null
        await audio.save()
      }
      throw new Error(errorMessage)
    }

    // Deduct credits based on organization's credit mode (shared vs individual)
    const fileNameWithoutExt = audioFileName.replace(/\.[^/.]+$/, '')
    await creditService.deductForAudioProcessing(
      user,
      organization,
      creditsNeeded,
      `Analyse audio: ${fileNameWithoutExt} (${Math.round(chunkingResult.metadata.duration)}s)`,
      audioId
    )

    // Stage 4: Transcribe audio chunks (17-72%)
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

        const chunkFileName = `chunk_${i}_${audioFileName}`
        const chunkTranscription = await mistralService.transcribe(chunk.path, chunkFileName)

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
    } else {
      // Single file transcription (no chunking)
      // Use simulated progress during Mistral API call (17% to 70%)
      await job.updateProgress(20)

      let transcriptionProgress = 20
      const transcriptionInterval = setInterval(async () => {
        if (transcriptionProgress < 68) {
          transcriptionProgress += 3
          await job.updateProgress(transcriptionProgress).catch(() => {})
        }
      }, 1000)

      try {
        transcriptionResult = await mistralService.transcribe(tempPath, audioFileName)
      } finally {
        clearInterval(transcriptionInterval)
      }
      await job.updateProgress(72)
    }

    if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
      throw new Error('Transcription returned empty result')
    }

    // Stage 5: Analyze with AI (72-92%)
    // Use simulated progress during Mistral API call
    await job.updateProgress(74)

    let analysisProgress = 74
    const analysisInterval = setInterval(async () => {
      if (analysisProgress < 90) {
        analysisProgress += 2
        await job.updateProgress(analysisProgress).catch(() => {})
      }
    }, 500)

    let analysis
    try {
      analysis = await mistralService.analyze(transcriptionResult.text, prompt)
    } finally {
      clearInterval(analysisInterval)
    }

    await job.updateProgress(92)

    // Save transcription AND analysis to database
    if (audio) {
      const transcription = await Transcription.create({
        audioId: audio.id,
        rawText: transcriptionResult.text,
        timestamps: transcriptionResult.segments,
        language: transcriptionResult.language || 'fr',
        analysis: analysis,
      })

      // Create initial version entries (v1) for version history
      await transcriptionVersionService.createInitialVersions(transcription, audio.userId)
    }

    // Stage 6: Cleanup and finalize (92-100%)
    await job.updateProgress(96)

    // Cleanup converted temp file
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

    // Cleanup temp files on error
    if (tempOriginalPath) {
      await unlink(tempOriginalPath).catch(() => {})
    }
    if (tempPath) {
      await unlink(tempPath).catch(() => {})
    }

    // Cleanup chunk files on error
    if (chunkingResult?.needsChunking) {
      await chunkingService.cleanupChunks(chunkingResult.chunks)
    }

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

  worker.on('completed', () => {})

  worker.on('failed', () => {})

  worker.on('progress', () => {})

  worker.on('error', () => {})

  return worker
}

export default { createTranscriptionWorker }

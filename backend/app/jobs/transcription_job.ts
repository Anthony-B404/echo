import { Worker, Job, UnrecoverableError } from 'bullmq'
import queueConfig from '#config/queue'
import MistralService, { type TranscriptionResult } from '#services/mistral_service'
import AudioConverterService from '#services/audio_converter_service'
import AudioChunkingService from '#services/audio_chunking_service'
import storageService from '#services/storage_service'
import creditService from '#services/credit_service'
import Audio, { AudioStatus } from '#models/audio'
import User from '#models/user'
import Organization from '#models/organization'
import Transcription from '#models/transcription'
import type { TranscriptionTimestamp } from '#models/transcription'
import CreditTransaction from '#models/credit_transaction'
import UserCreditTransaction from '#models/user_credit_transaction'
import transcriptionVersionService from '#services/transcription_version_service'
import type { TranscriptionJobData, TranscriptionJobResult } from '#services/queue_service'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import i18nManager from '@adonisjs/i18n/services/main'
import { RequestTimeoutError, ConnectionError } from '@mistralai/mistralai/models/errors/httpclienterrors.js'
import { SDKError } from '@mistralai/mistralai/models/errors/sdkerror.js'

/**
 * Speed factor applied to audio before transcription.
 * Reduces Mistral API cost by ~33% while preserving transcription quality.
 * Timestamps are corrected back to original speed after transcription.
 */
const TRANSCRIPTION_SPEED_FACTOR = 1.5

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
 * Calculate progress percentage for chunk processing.
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
 * Deduplicate segments in overlap zone.
 * Filters out segments from the next chunk that start before the previous chunk ended.
 */
function deduplicateOverlap(
  prevSegments: TranscriptionTimestamp[],
  nextSegments: TranscriptionTimestamp[]
): TranscriptionTimestamp[] {
  if (prevSegments.length === 0 || nextSegments.length === 0) {
    return nextSegments
  }

  const prevEnd = prevSegments[prevSegments.length - 1]?.end || 0
  return nextSegments.filter((seg) => seg.start >= prevEnd)
}

/**
 * Merge chunk transcription into context with timestamp adjustment.
 * Each chunk's segments are offset by the chunk's start time in the original sped-up audio.
 *
 * Speaker IDs are disambiguated per chunk (suffix `_c1`, `_c2`, etc.) because
 * Mistral assigns IDs independently per transcription call — `speaker_0` in chunk 1
 * may be a different person than `speaker_0` in chunk 2.
 */
function mergeChunkTranscription(
  context: MergeContext,
  chunkResult: TranscriptionResult,
  chunkIndex: number,
  chunkStartTime: number
): MergeContext {
  if (chunkIndex === 0) {
    const lastSegment = chunkResult.segments[chunkResult.segments.length - 1]
    return {
      lastEndTime: lastSegment?.end || 0,
      segments: [...chunkResult.segments],
      fullText: chunkResult.text,
      language: chunkResult.language,
    }
  }

  // Disambiguate speaker IDs for chunks > 0 to avoid cross-chunk conflicts
  const adjustedSegments = chunkResult.segments.map((seg) => ({
    start: seg.start + chunkStartTime,
    end: seg.end + chunkStartTime,
    text: seg.text,
    speaker: seg.speaker ? `${seg.speaker}_c${chunkIndex}` : seg.speaker,
  }))

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
 * Transcribe audio with chunking support for long files.
 * Files > 20 min (after speed-up) are split into 20-min chunks with 5s overlap.
 * Each chunk is transcribed sequentially and results are merged with deduplication.
 */
async function transcribeWithChunking(
  filePath: string,
  audioFileName: string,
  spedUpDuration: number,
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionResult> {
  const chunkingService = new AudioChunkingService()
  const chunkingResult = await chunkingService.splitIntoChunks(filePath)

  if (!chunkingResult.needsChunking) {
    // No chunking needed — one-shot transcription with asymptotic progress
    const mistralService = new MistralService()

    let transcriptionProgress = 17
    const TRANSCRIPTION_CAP = 70
    const transcriptionInterval = setInterval(async () => {
      const increment = (TRANSCRIPTION_CAP - transcriptionProgress) * 0.035
      if (increment > 0.3) {
        transcriptionProgress = Math.round(transcriptionProgress + increment)
        await job.updateProgress(transcriptionProgress).catch(() => {})
      }
    }, 1000)

    try {
      return await mistralService.transcribe(filePath, audioFileName, spedUpDuration, 'audio/mp4')
    } finally {
      clearInterval(transcriptionInterval)
    }
  }

  // Chunked transcription
  console.log(
    `[Transcription] Job ${job.id} chunking: ${chunkingResult.chunks.length} chunks (audioId: ${job.data.audioId})`
  )

  let mergeContext: MergeContext = {
    lastEndTime: 0,
    segments: [],
    fullText: '',
    language: null,
  }

  try {
    for (let i = 0; i < chunkingResult.chunks.length; i++) {
      const chunk = chunkingResult.chunks[i]
      const mistralService = new MistralService()

      console.log(
        `[Transcription] Job ${job.id} transcribing chunk ${i + 1}/${chunkingResult.chunks.length} (start: ${Math.round(chunk.startTime)}s, duration: ${Math.round(chunk.duration)}s, audioId: ${job.data.audioId})`
      )

      const chunkResult = await mistralService.transcribe(
        chunk.path,
        `chunk_${i}_${audioFileName}`,
        chunk.duration,
        'audio/mp4'
      )

      mergeContext = mergeChunkTranscription(mergeContext, chunkResult, i, chunk.startTime)

      const progress = calculateChunkProgress(i, chunkingResult.chunks.length)
      await job.updateProgress(progress).catch(() => {})
    }
  } finally {
    await chunkingService.cleanupChunks(chunkingResult.chunks)
  }

  return {
    text: mergeContext.fullText.trim(),
    segments: mergeContext.segments,
    language: mergeContext.language,
  }
}

/**
 * Classify whether an error is retriable by BullMQ.
 * Non-retriable errors are wrapped in UnrecoverableError to skip remaining attempts.
 */
function isRetriableError(error: unknown): boolean {
  // Mistral timeout / connection → retry
  if (error instanceof RequestTimeoutError || error instanceof ConnectionError) {
    return true
  }

  // Mistral SDK HTTP errors → check status code
  if (error instanceof SDKError) {
    const msg = error.message || ''
    // Rate limit (429) or server errors (5xx) → retry
    if (msg.includes('Status 429') || /Status 5\d\d/.test(msg)) {
      return true
    }
    // Client errors (400, 401, 403) → non-retriable
    if (msg.includes('Status 400') || msg.includes('Status 401') || msg.includes('Status 403')) {
      return false
    }
  }

  if (error instanceof Error) {
    const msg = error.message || ''
    // Business logic errors → non-retriable
    if (
      msg.includes('INSUFFICIENT_CREDITS') ||
      msg.includes('insufficient_credits') ||
      msg.includes('User not found') ||
      msg.includes('Organization not found') ||
      msg.includes('no current organization') ||
      msg.includes('empty result')
    ) {
      return false
    }
  }

  // Unknown errors → retry by default
  return true
}

/**
 * Process transcription jobs with chunking support for long audio files.
 * Files > 20 min (after 1.75x speed-up) are automatically chunked.
 *
 * Progress stages (first attempt — parallel):
 * - 0-5%: Downloading file from storage
 * - 5-10%: ffprobe duration + credit check
 * - 10-15%: Speed up audio 1.75x
 * - 15-17%: Parallel conversion start + chunking check
 * - 17-72%: Transcription (one-shot or chunked)
 * - 72-75%: Store converted file
 * - 75-92%: AI analysis
 * - 92-100%: Cleanup and completion
 *
 * Progress stages (retry — sequential):
 * - 0-12%: Download converted file
 * - 12-17%: Speed up + chunking check
 * - 17-72%: Transcription (one-shot or chunked)
 * - 72-92%: AI analysis
 * - 92-100%: Cleanup and completion
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionJobResult> {
  const { audioId, audioFilePath, audioFileName, prompt } = job.data
  const maxAttempts = job.opts.attempts ?? 1

  console.log(
    `[Transcription] Job ${job.id} started (attempt ${job.attemptsMade + 1}/${maxAttempts}, audioId: ${audioId})`
  )

  // Load audio record and set status to processing
  // Restore currentJobId on retry (cleared by error handler on previous attempt)
  const audio = await Audio.find(audioId)
  if (audio) {
    audio.status = AudioStatus.Processing
    audio.currentJobId = job.data.jobId
    await audio.save()
  }

  // Initialize tracking variables
  const tempDir = tmpdir()
  let tempOriginalPath: string | null = null
  let tempPath: string | null = null
  let tempSpeedUpPath: string | null = null
  const converter = new AudioConverterService()

  // Detect retry: if Audio record's filePath differs from job data, conversion already happened
  const alreadyConverted = audio && audio.filePath !== audioFilePath
  let audioDuration: number
  let skipToAnalysis = false
  let analysisTranscriptionResult!: TranscriptionResult

  try {
    if (alreadyConverted) {
      // Retry: conversion was completed in a previous attempt, skip to transcription
      console.log(`[Transcription] Job ${job.id} retry detected, skipping conversion (audioId: ${audioId})`)
      await job.updateProgress(12)

      audioDuration = audio.duration || 0

      // Write already-converted file to temp for transcription
      tempPath = join(tempDir, `${randomUUID()}-converted.m4a`)
      const convertedBuffer = await storageService.getFileBuffer(audio.filePath)
      await writeFile(tempPath, convertedBuffer)
    } else {
      // First attempt: full pipeline with parallel conversion + transcription

      // Stage 1: Download file from storage (0-5%)
      await job.updateProgress(1)

      const fileBuffer = await storageService.getFileBuffer(audioFilePath)

      // Write to temp file for processing
      tempOriginalPath = join(tempDir, `${randomUUID()}-original-${audioFileName}`)
      await writeFile(tempOriginalPath, fileBuffer)

      await job.updateProgress(3)

      // Stage 2: Get duration with ffprobe (5-8%) — fast (~100ms)
      await job.updateProgress(5)
      audioDuration = await converter.getDuration(tempOriginalPath)

      console.log(
        `[Transcription] Job ${job.id} ffprobe duration: ${Math.round(audioDuration)}s (audioId: ${audioId})`
      )

      await job.updateProgress(8)

      // Stage 3: Credit check (8-10%) — needs duration, must happen before parallel work
      const durationMinutes = Math.ceil(audioDuration / 60)
      const creditsNeeded = Math.max(1, durationMinutes)

      console.log(
        `[Transcription] Job ${job.id} credit check (needed: ${creditsNeeded}, audioId: ${audioId})`
      )

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

      const existingOrgDeduction = await CreditTransaction.query()
        .where('audioId', audioId)
        .where('type', 'usage')
        .first()
      const existingUserDeduction = await UserCreditTransaction.query()
        .where('audioId', audioId)
        .where('type', 'usage')
        .first()
      const creditsAlreadyDeducted = !!(existingOrgDeduction || existingUserDeduction)

      if (!creditsAlreadyDeducted) {
        const hasCredits = await creditService.hasEnoughCreditsForProcessing(
          user,
          organization,
          creditsNeeded
        )

        if (!hasCredits) {
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

        const fileNameWithoutExt = audioFileName.replace(/\.[^/.]+$/, '')
        await creditService.deductForAudioProcessing(
          user,
          organization,
          creditsNeeded,
          `Analyse audio: ${fileNameWithoutExt} (${Math.round(audioDuration)}s)`,
          audioId
        )
      }

      await job.updateProgress(10)

      // Stage 4: Speed up + parallel conversion + transcription (10-75%)
      const spedUpDuration = audioDuration / TRANSCRIPTION_SPEED_FACTOR

      // Speed up audio for cheaper/faster transcription (10-15%)
      console.log(
        `[Transcription] Job ${job.id} speeding up ${TRANSCRIPTION_SPEED_FACTOR}x (${Math.round(audioDuration)}s → ${Math.round(spedUpDuration)}s, audioId: ${audioId})`
      )
      tempSpeedUpPath = await converter.speedUp(tempOriginalPath, TRANSCRIPTION_SPEED_FACTOR)
      await job.updateProgress(15)

      // Start AAC conversion in parallel with transcription
      const conversionPromise = converter.convertToAac(tempOriginalPath, 'voice')

      // Transcribe sped-up file (with chunking if > 20 min)
      await job.updateProgress(17)
      const transcriptionResult = await transcribeWithChunking(
        tempSpeedUpPath,
        audioFileName,
        spedUpDuration,
        job
      )

      // Wait for conversion to finish
      const conversionResult = await conversionPromise

      // Correct timestamps back to original speed
      for (const seg of transcriptionResult.segments) {
        seg.start = seg.start * TRANSCRIPTION_SPEED_FACTOR
        seg.end = seg.end * TRANSCRIPTION_SPEED_FACTOR
      }

      console.log(
        `[Transcription] Job ${job.id} parallel phase done — conversion: ${Math.round(conversionResult.duration)}s, transcription: ${transcriptionResult.text.length} chars (audioId: ${audioId})`
      )

      await job.updateProgress(72)

      // Stage 5: Store converted file + update Audio record (72-75%)
      const convertedFile = await storageService.storeAudioFromPath(
        conversionResult.path,
        job.data.organizationId,
        {
          originalName: audioFileName.replace(/\.[^/.]+$/, '.m4a'),
          mimeType: 'audio/mp4',
        }
      )

      if (audio) {
        audio.filePath = convertedFile.path
        audio.fileSize = convertedFile.size
        audio.mimeType = 'audio/mp4'
        audio.duration = Math.round(conversionResult.duration)
        await audio.save()
      }

      // Delete original file from storage
      await storageService.deleteFile(audioFilePath).catch(() => {})

      // Cleanup temp files
      await unlink(tempOriginalPath).catch(() => {})
      tempOriginalPath = null
      await converter.cleanup(conversionResult.path)
      if (tempSpeedUpPath) {
        await unlink(tempSpeedUpPath).catch(() => {})
        tempSpeedUpPath = null
      }

      tempPath = null

      await job.updateProgress(75)

      if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
        throw new Error('Transcription returned empty result')
      }

      // Jump to analysis (skip retry-only block)
      skipToAnalysis = true
      analysisTranscriptionResult = transcriptionResult
    }

    // Retry path: transcription on already-converted file (12-72%)
    if (!skipToAnalysis) {
      // Credit check for retry path
      const durationMinutes = Math.ceil(audioDuration / 60)
      const creditsNeeded = Math.max(1, durationMinutes)

      console.log(
        `[Transcription] Job ${job.id} credit check (needed: ${creditsNeeded}, audioId: ${audioId})`
      )

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

      const existingOrgDeduction = await CreditTransaction.query()
        .where('audioId', audioId)
        .where('type', 'usage')
        .first()
      const existingUserDeduction = await UserCreditTransaction.query()
        .where('audioId', audioId)
        .where('type', 'usage')
        .first()
      const creditsAlreadyDeducted = !!(existingOrgDeduction || existingUserDeduction)

      if (!creditsAlreadyDeducted) {
        const hasCredits = await creditService.hasEnoughCreditsForProcessing(
          user,
          organization,
          creditsNeeded
        )

        if (!hasCredits) {
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

        const fileNameWithoutExt = audioFileName.replace(/\.[^/.]+$/, '')
        await creditService.deductForAudioProcessing(
          user,
          organization,
          creditsNeeded,
          `Analyse audio: ${fileNameWithoutExt} (${Math.round(audioDuration)}s)`,
          audioId
        )
      }

      // Speed up converted file for transcription (retry path)
      const spedUpDuration = audioDuration / TRANSCRIPTION_SPEED_FACTOR
      console.log(
        `[Transcription] Job ${job.id} retry: speeding up ${TRANSCRIPTION_SPEED_FACTOR}x (${Math.round(audioDuration)}s → ${Math.round(spedUpDuration)}s, audioId: ${audioId})`
      )
      tempSpeedUpPath = await converter.speedUp(tempPath!, TRANSCRIPTION_SPEED_FACTOR)
      await job.updateProgress(17)

      // Transcribe sped-up file with chunking support (retry path)
      const transcriptionResult = await transcribeWithChunking(
        tempSpeedUpPath,
        audioFileName,
        spedUpDuration,
        job
      )
      await job.updateProgress(72)

      // Correct timestamps back to original speed
      for (const seg of transcriptionResult.segments) {
        seg.start = seg.start * TRANSCRIPTION_SPEED_FACTOR
        seg.end = seg.end * TRANSCRIPTION_SPEED_FACTOR
      }

      // Cleanup speed-up temp file
      if (tempSpeedUpPath) {
        await unlink(tempSpeedUpPath).catch(() => {})
        tempSpeedUpPath = null
      }

      if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
        throw new Error('Transcription returned empty result')
      }

      analysisTranscriptionResult = transcriptionResult
    }

    // Stage: Analyze with AI (75-92%)
    let analysisText: string | null = null

    if (prompt) {
      const analysisMistralService = new MistralService()
      await job.updateProgress(77)

      let analysisProgress = 77
      const ANALYSIS_CAP = 91
      const analysisInterval = setInterval(async () => {
        const increment = (ANALYSIS_CAP - analysisProgress) * 0.04
        if (increment > 0.3) {
          analysisProgress = Math.round(analysisProgress + increment)
          await job.updateProgress(analysisProgress).catch(() => {})
        }
      }, 1000)

      let analysisResult
      try {
        analysisResult = await analysisMistralService.analyze(
          analysisTranscriptionResult.text,
          prompt,
          analysisTranscriptionResult.segments
        )
      } finally {
        clearInterval(analysisInterval)
      }

      // Apply speaker name mapping to segments
      if (Object.keys(analysisResult.speakers).length > 0) {
        for (const seg of analysisTranscriptionResult.segments) {
          if (seg.speaker && analysisResult.speakers[seg.speaker]) {
            seg.speaker = analysisResult.speakers[seg.speaker]
          }
        }
      }

      analysisText = analysisResult.analysis
    } else {
      // No prompt: still identify speaker names from diarized segments
      const hasSpeakers = analysisTranscriptionResult.segments.some((seg) => seg.speaker)
      if (hasSpeakers) {
        await job.updateProgress(77)
        const speakerService = new MistralService()
        const speakers = await speakerService.identifySpeakers(
          analysisTranscriptionResult.segments
        )

        if (Object.keys(speakers).length > 0) {
          for (const seg of analysisTranscriptionResult.segments) {
            if (seg.speaker && speakers[seg.speaker]) {
              seg.speaker = speakers[seg.speaker]
            }
          }
        }
      }
    }

    // Strip chunk disambiguation suffixes (_c1, _c2, etc.) from any remaining raw speaker IDs.
    // e.g. "speaker_0_c1" → "speaker_0"
    for (const seg of analysisTranscriptionResult.segments) {
      if (seg.speaker && /_c\d+$/.test(seg.speaker)) {
        seg.speaker = seg.speaker.replace(/_c\d+$/, '')
      }
    }

    await job.updateProgress(92)

    // Save transcription (and analysis if prompt was provided) to database
    if (audio) {
      const transcription = await Transcription.create({
        audioId: audio.id,
        rawText: analysisTranscriptionResult.text,
        timestamps: analysisTranscriptionResult.segments,
        language: analysisTranscriptionResult.language || 'fr',
        analysis: analysisText,
      })

      // Create initial version entries (v1) for version history
      await transcriptionVersionService.createInitialVersions(transcription, audio.userId, prompt)
    }

    // Stage: Cleanup and finalize (92-100%)
    await job.updateProgress(96)

    // Cleanup temp files
    if (tempPath) {
      try {
        await unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }

    // Update audio status to completed and clear job ID
    if (audio) {
      audio.status = AudioStatus.Completed
      audio.currentJobId = null
      await audio.save()
    }

    await job.updateProgress(100)

    console.log(`[Transcription] Job ${job.id} completed successfully (audioId: ${audioId})`)

    return {
      transcription: analysisTranscriptionResult.text,
      analysis: analysisText || '',
    }
  } catch (error) {
    const retriable = isRetriableError(error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log cause chain for fetch errors (e.g. connection reset, DNS failure)
    const cause = error instanceof Error && 'cause' in error ? (error as any).cause : undefined
    const causeDetail = cause
      ? ` | cause: ${cause instanceof Error ? `${cause.message}${cause.cause ? ` → ${(cause.cause as any).message || cause.cause}` : ''}` : cause}`
      : ''

    console.log(
      `[Transcription] Job ${job.id} failed (attempt ${job.attemptsMade + 1}/${maxAttempts}, retriable: ${retriable}, audioId: ${audioId}): ${errorMessage}${causeDetail}`
    )

    // Update audio status to failed
    // Clear currentJobId if non-retriable (no point waiting) or on final attempt
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
    if (audio) {
      audio.status = AudioStatus.Failed
      audio.errorMessage = errorMessage
      if (!retriable || isFinalAttempt) {
        audio.currentJobId = null
      }
      await audio.save()
    }

    // Cleanup temp files on error
    if (tempOriginalPath) {
      await unlink(tempOriginalPath).catch(() => {})
    }
    if (tempPath) {
      await unlink(tempPath).catch(() => {})
    }
    if (tempSpeedUpPath) {
      await unlink(tempSpeedUpPath).catch(() => {})
    }

    // Non-retriable: wrap in UnrecoverableError to skip remaining BullMQ attempts
    if (!retriable) {
      throw new UnrecoverableError(errorMessage)
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
      lockDuration: 3_600_000, // 60 minutes — large audio uploads + Mistral processing
      stalledInterval: 3_600_000, // Check for stalled jobs every 60 minutes
      maxStalledCount: 3, // Allow 3 stall events before failing
    }
  )

  worker.on('completed', (_job) => {
    const audioId = _job.data?.audioId
    console.log(`[Transcription] Worker: job ${_job.id} completed (audioId: ${audioId})`)
  })

  worker.on('failed', (_job, err) => {
    const audioId = _job?.data?.audioId
    console.log(
      `[Transcription] Worker: job ${_job?.id} failed (audioId: ${audioId}): ${err.message}`
    )
  })

  worker.on('error', (err) => {
    console.log(`[Transcription] Worker error: ${err.message}`)
  })

  return worker
}

export default { createTranscriptionWorker }

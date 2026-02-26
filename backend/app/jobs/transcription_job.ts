import { Worker, Job, UnrecoverableError } from 'bullmq'
import queueConfig from '#config/queue'
import MistralService, { type TranscriptionResult } from '#services/mistral_service'
import AudioConverterService from '#services/audio_converter_service'
import storageService from '#services/storage_service'
import creditService from '#services/credit_service'
import Audio, { AudioStatus } from '#models/audio'
import User from '#models/user'
import Organization from '#models/organization'
import Transcription from '#models/transcription'
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
 * Process transcription jobs (one-shot, no chunking).
 * Voxtral Transcribe V2 supports up to 3 hours / 1 GB per request.
 *
 * Progress stages (first attempt — parallel):
 * - 0-5%: Downloading file from storage
 * - 5-10%: ffprobe duration + credit check
 * - 10-75%: Parallel conversion + transcription
 * - 75-92%: Store converted file + AI analysis
 * - 92-100%: Cleanup and completion
 *
 * Progress stages (retry — sequential):
 * - 0-12%: Download converted file
 * - 12-72%: Transcription on converted file
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

      // Stage 4: Parallel conversion + transcription (10-75%)
      // Guard to prevent progress going backward when two branches update concurrently
      let currentProgress = 10
      const safeUpdateProgress = async (value: number) => {
        if (value > currentProgress) {
          currentProgress = value
          await job.updateProgress(value).catch(() => {})
        }
      }

      const mistralService = new MistralService()

      // Determine MIME type for Mistral (use original file's MIME type)
      const originalMimeType = audio?.mimeType || 'audio/mpeg'

      // Asymptotic progress for parallel phase (10→70%)
      // Formula: progress += (cap - progress) * factor
      // Never stalls — always moves, just slower as it approaches the cap
      const PARALLEL_CAP = 70
      const parallelInterval = setInterval(async () => {
        const increment = (PARALLEL_CAP - currentProgress) * 0.035
        if (increment > 0.3) {
          await safeUpdateProgress(Math.round(currentProgress + increment))
        }
      }, 1000)

      let conversionResult: Awaited<ReturnType<typeof converter.convertToAac>>
      let transcriptionResult: TranscriptionResult

      try {
        ;[conversionResult, transcriptionResult] = await Promise.all([
          converter.convertToAac(tempOriginalPath, 'voice'),
          mistralService.transcribe(
            tempOriginalPath,
            audioFileName,
            audioDuration,
            originalMimeType
          ),
        ])
      } finally {
        clearInterval(parallelInterval)
      }

      console.log(
        `[Transcription] Job ${job.id} parallel phase done — conversion: ${Math.round(conversionResult.duration)}s, transcription: ${transcriptionResult.text.length} chars (audioId: ${audioId})`
      )

      await job.updateProgress(72)

      // Stage 5: Store converted file + update Audio record (72-80%)
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

      // tempPath not needed — transcription already done on original file
      // Set tempPath to null since we don't need a converted temp file anymore
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
      const mistralService = new MistralService()
      let transcriptionResult: TranscriptionResult

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

      // Transcribe on converted file (retry path) — asymptotic progress 15→70%
      let retryProgress = 15
      const RETRY_TRANSCRIPTION_CAP = 70
      const transcriptionInterval = setInterval(async () => {
        const increment = (RETRY_TRANSCRIPTION_CAP - retryProgress) * 0.035
        if (increment > 0.3) {
          retryProgress = Math.round(retryProgress + increment)
          await job.updateProgress(retryProgress).catch(() => {})
        }
      }, 1000)

      try {
        transcriptionResult = await mistralService.transcribe(
          tempPath!,
          audioFileName,
          audioDuration
        )
      } finally {
        clearInterval(transcriptionInterval)
      }
      await job.updateProgress(72)

      if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
        throw new Error('Transcription returned empty result')
      }

      analysisTranscriptionResult = transcriptionResult
    }

    // Stage: Analyze with AI (75-92%) — asymptotic progress
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

    await job.updateProgress(92)

    // Save transcription AND analysis to database
    if (audio) {
      const transcription = await Transcription.create({
        audioId: audio.id,
        rawText: analysisTranscriptionResult.text,
        timestamps: analysisTranscriptionResult.segments,
        language: analysisTranscriptionResult.language || 'fr',
        analysis: analysisResult.analysis,
      })

      // Create initial version entries (v1) for version history
      await transcriptionVersionService.createInitialVersions(transcription, audio.userId)
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
      analysis: analysisResult.analysis,
    }
  } catch (error) {
    const retriable = isRetriableError(error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.log(
      `[Transcription] Job ${job.id} failed (attempt ${job.attemptsMade + 1}/${maxAttempts}, retriable: ${retriable}, audioId: ${audioId}): ${errorMessage}`
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

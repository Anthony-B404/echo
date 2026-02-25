import { Worker, Job } from 'bullmq'
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

/**
 * Process transcription jobs (one-shot, no chunking).
 * Voxtral Transcribe V2 supports up to 3 hours / 1 GB per request.
 *
 * Progress stages:
 * - 0-2%: Downloading file from storage
 * - 2-12%: Converting audio to AAC/M4A format
 * - 12-72%: Transcribing audio with Mistral
 * - 72-92%: Analyzing with AI
 * - 92-100%: Cleanup and completion
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionJobResult> {
  const { audioId, audioFilePath, audioFileName, prompt } = job.data

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

  try {
    if (alreadyConverted) {
      // Retry: conversion was completed in a previous attempt, skip to transcription
      await job.updateProgress(12)

      audioDuration = audio.duration || 0

      // Write already-converted file to temp for transcription
      tempPath = join(tempDir, `${randomUUID()}-converted.m4a`)
      const convertedBuffer = await storageService.getFileBuffer(audio.filePath)
      await writeFile(tempPath, convertedBuffer)
    } else {
      // First attempt: full pipeline

      // Stage 1: Download file from storage (0-2%)
      await job.updateProgress(1)

      const fileBuffer = await storageService.getFileBuffer(audioFilePath)

      // Write to temp file for processing
      tempOriginalPath = join(tempDir, `${randomUUID()}-original-${audioFileName}`)
      await writeFile(tempOriginalPath, fileBuffer)

      await job.updateProgress(2)

      // Stage 2: Convert to AAC/M4A format for universal browser playback (2-12%)
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
        conversionResult = await converter.convertToAac(tempOriginalPath, 'voice')
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
          originalName: audioFileName.replace(/\.[^/.]+$/, '.m4a'),
          mimeType: 'audio/mp4',
        }
      )

      // Update Audio record with converted file info
      await job.updateProgress(10)
      if (audio) {
        audio.filePath = convertedFile.path
        audio.fileSize = convertedFile.size
        audio.mimeType = 'audio/mp4'
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
      tempPath = join(tempDir, `${randomUUID()}-converted.m4a`)
      const convertedBuffer = await storageService.getFileBuffer(convertedFile.path)
      await writeFile(tempPath, convertedBuffer)

      audioDuration = conversionResult.duration

      await job.updateProgress(12)
    }

    // Credit check: Calculate credits needed (1 credit = 1 minute, rounded up)
    const durationMinutes = Math.ceil(audioDuration / 60)
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

    // Check if credits were already deducted for this audio (idempotent on retry)
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
        `Analyse audio: ${fileNameWithoutExt} (${Math.round(audioDuration)}s)`,
        audioId
      )
    }

    // Stage 3: Transcribe audio one-shot (12-72%)
    const mistralService = new MistralService()
    let transcriptionResult: TranscriptionResult

    // Use simulated progress during Mistral API call (12% to 70%)
    await job.updateProgress(15)

    let transcriptionProgress = 15
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

    if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
      throw new Error('Transcription returned empty result')
    }

    // Stage 4: Analyze with AI (72-92%)
    // Use simulated progress during Mistral API call
    await job.updateProgress(74)

    let analysisProgress = 74
    const analysisInterval = setInterval(async () => {
      if (analysisProgress < 90) {
        analysisProgress += 2
        await job.updateProgress(analysisProgress).catch(() => {})
      }
    }, 500)

    let analysisResult
    try {
      analysisResult = await mistralService.analyze(
        transcriptionResult.text,
        prompt,
        transcriptionResult.segments
      )
    } finally {
      clearInterval(analysisInterval)
    }

    // Apply speaker name mapping to segments
    if (Object.keys(analysisResult.speakers).length > 0) {
      for (const seg of transcriptionResult.segments) {
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
        rawText: transcriptionResult.text,
        timestamps: transcriptionResult.segments,
        language: transcriptionResult.language || 'fr',
        analysis: analysisResult.analysis,
      })

      // Create initial version entries (v1) for version history
      await transcriptionVersionService.createInitialVersions(transcription, audio.userId)
    }

    // Stage 5: Cleanup and finalize (92-100%)
    await job.updateProgress(96)

    // Cleanup converted temp file
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
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
      analysis: analysisResult.analysis,
    }
  } catch (error) {
    // Update audio status to failed
    // Only clear currentJobId on final attempt (no more retries)
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
    if (audio) {
      audio.status = AudioStatus.Failed
      audio.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (isFinalAttempt) {
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

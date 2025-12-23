import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unlink, mkdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

// Use createRequire to import CommonJS modules in ESM
const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static') as string
const ffprobePath = require('ffprobe-static') as { path: string }

const execFileAsync = promisify(execFile)

/**
 * Audio file metadata extracted via ffprobe
 */
export interface AudioMetadata {
  duration: number // seconds
  format: string // e.g., 'mp3', 'wav'
  bitrate: number // bits per second
  sampleRate: number // Hz
  channels: number // 1 (mono) or 2 (stereo)
}

/**
 * Information about a single audio chunk
 */
export interface ChunkInfo {
  index: number // 0-based chunk index
  path: string // temp file path
  startTime: number // start time in seconds
  duration: number // chunk duration in seconds
}

/**
 * Result of chunking operation
 */
export interface ChunkingResult {
  metadata: AudioMetadata
  chunks: ChunkInfo[]
  needsChunking: boolean
}

/**
 * Configuration for audio chunking
 */
export const CHUNKING_CONFIG = {
  /** Duration of each chunk in seconds (2 minutes - Mistral API limit) */
  CHUNK_DURATION_SECONDS: 2 * 60,
  /** Overlap between chunks to avoid mid-sentence cuts (3 seconds) */
  OVERLAP_SECONDS: 3,
  /** Minimum duration that triggers chunking (2 minutes) */
  MIN_DURATION_FOR_CHUNKING: 2 * 60,
  /** Prefix for temporary chunk files */
  TEMP_CHUNK_PREFIX: 'alexia_chunk_',
  /** Supported audio formats */
  SUPPORTED_FORMATS: ['mp3', 'wav', 'm4a', 'ogg', 'flac'],
}

export default class AudioChunkingService {
  /**
   * Get audio metadata using ffprobe
   */
  async getMetadata(filePath: string): Promise<AudioMetadata> {
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]

    const { stdout } = await execFileAsync(ffprobePath.path, args)
    const data = JSON.parse(stdout)

    const format = data.format || {}
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio') || {}

    return {
      duration: parseFloat(format.duration) || 0,
      format: format.format_name?.split(',')[0] || 'unknown',
      bitrate: parseInt(format.bit_rate) || 0,
      sampleRate: parseInt(audioStream.sample_rate) || 0,
      channels: audioStream.channels || 0,
    }
  }

  /**
   * Split audio into chunks if duration exceeds threshold
   * Returns the original file path in a single chunk if no splitting needed
   */
  async splitIntoChunks(filePath: string, outputDir: string): Promise<ChunkingResult> {
    const metadata = await this.getMetadata(filePath)

    // If duration is under threshold, no chunking needed
    if (metadata.duration < CHUNKING_CONFIG.MIN_DURATION_FOR_CHUNKING) {
      return {
        metadata,
        chunks: [
          {
            index: 0,
            path: filePath,
            startTime: 0,
            duration: metadata.duration,
          },
        ],
        needsChunking: false,
      }
    }

    // Create output directory if needed
    const chunkDir = join(outputDir, `chunks_${randomUUID()}`)
    await mkdir(chunkDir, { recursive: true })

    const chunks: ChunkInfo[] = []
    // Always output as .mp3 since we use libmp3lame codec
    const inputExt = extname(filePath)
    const baseName = basename(filePath, inputExt)
    const outputExt = '.mp3'

    let currentStart = 0
    let chunkIndex = 0
    const totalDuration = metadata.duration

    while (currentStart < totalDuration) {
      // Calculate chunk duration with overlap
      // For all chunks except the last one, add overlap to avoid mid-sentence cuts
      const isLastChunk = currentStart + CHUNKING_CONFIG.CHUNK_DURATION_SECONDS >= totalDuration
      const chunkDuration = isLastChunk
        ? totalDuration - currentStart // Last chunk: just take remaining
        : CHUNKING_CONFIG.CHUNK_DURATION_SECONDS + CHUNKING_CONFIG.OVERLAP_SECONDS

      const chunkPath = join(
        chunkDir,
        `${CHUNKING_CONFIG.TEMP_CHUNK_PREFIX}${baseName}_${chunkIndex}${outputExt}`
      )

      // Use ffmpeg to extract chunk
      await this.extractChunk(filePath, chunkPath, currentStart, chunkDuration)

      chunks.push({
        index: chunkIndex,
        path: chunkPath,
        startTime: currentStart,
        duration: chunkDuration,
      })

      // Move to next chunk start position
      // Subtract overlap so next chunk starts before this one ends
      currentStart += CHUNKING_CONFIG.CHUNK_DURATION_SECONDS
      chunkIndex++
    }

    console.log(
      `[AudioChunking] Split ${metadata.duration.toFixed(1)}s audio into ${chunks.length} chunks`
    )

    return {
      metadata,
      chunks,
      needsChunking: true,
    }
  }

  /**
   * Extract a chunk from audio file using ffmpeg
   */
  private async extractChunk(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number
  ): Promise<void> {
    if (!ffmpegPath) {
      throw new Error('ffmpeg-static path not found')
    }

    const args = [
      '-ss',
      startTime.toString(), // Seek BEFORE input for faster seeking
      '-i',
      inputPath,
      '-t',
      duration.toString(),
      '-acodec',
      'libmp3lame', // Re-encode to MP3 to fix duration metadata
      '-ar',
      '16000', // 16kHz sample rate (good for speech, smaller files)
      '-ac',
      '1', // Mono (speech doesn't need stereo)
      '-b:a',
      '64k', // 64kbps bitrate (sufficient for speech)
      '-y', // Overwrite output file if exists
      outputPath,
    ]

    await execFileAsync(ffmpegPath, args)
  }

  /**
   * Cleanup temporary chunk files
   */
  async cleanupChunks(chunks: ChunkInfo[]): Promise<void> {
    for (const chunk of chunks) {
      try {
        await unlink(chunk.path)
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Try to remove the chunk directory if it's a temp directory
    if (chunks.length > 0) {
      const chunkDir = join(chunks[0].path, '..')
      if (chunkDir.includes('chunks_')) {
        try {
          const { rmdir } = await import('node:fs/promises')
          await rmdir(chunkDir)
        } catch {
          // Ignore errors - directory might not be empty or already deleted
        }
      }
    }

    console.log(`[AudioChunking] Cleaned up ${chunks.length} chunk files`)
  }
}

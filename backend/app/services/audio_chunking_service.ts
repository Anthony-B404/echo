import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unlink, mkdir, rmdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

const require = createRequire(import.meta.url)

function getFfmpegPath(): string {
  const envPath = env.get('FFMPEG_PATH')
  if (envPath) {
    return envPath
  }
  return require('ffmpeg-static') as string
}

function getFfprobePath(): string {
  const envPath = env.get('FFPROBE_PATH')
  if (envPath) {
    return envPath
  }
  const ffprobeStatic = require('ffprobe-static') as { path: string }
  return ffprobeStatic.path
}

const ffmpegPath = getFfmpegPath()
const ffprobePath = getFfprobePath()

const execFileAsync = promisify(execFile)

export interface AudioMetadata {
  duration: number
  format: string
  bitrate: number
  sampleRate: number
  channels: number
}

export interface ChunkInfo {
  index: number
  path: string
  startTime: number
  duration: number
}

export interface ChunkingResult {
  metadata: AudioMetadata
  chunks: ChunkInfo[]
  needsChunking: boolean
}

export const CHUNKING_CONFIG = {
  /** Duration of each chunk in seconds (60 minutes) */
  CHUNK_DURATION_SECONDS: 60 * 60,
  /** Overlap between chunks to avoid mid-sentence cuts (5 seconds) */
  OVERLAP_SECONDS: 5,
  /** Minimum duration that triggers chunking (60 minutes) */
  MIN_DURATION_FOR_CHUNKING: 60 * 60,
}

export default class AudioChunkingService {
  /**
   * Get audio metadata using ffprobe
   */
  async getMetadata(filePath: string): Promise<AudioMetadata> {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath]

    const { stdout } = await execFileAsync(ffprobePath, args)
    const data = JSON.parse(stdout)

    const format = data.format || {}
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio') || {}

    return {
      duration: Number.parseFloat(format.duration) || 0,
      format: format.format_name?.split(',')[0] || 'unknown',
      bitrate: Number.parseInt(format.bit_rate) || 0,
      sampleRate: Number.parseInt(audioStream.sample_rate) || 0,
      channels: audioStream.channels || 0,
    }
  }

  /**
   * Split audio into chunks if duration exceeds threshold.
   * Output format is M4A/AAC, consistent with the current pipeline.
   */
  async splitIntoChunks(filePath: string): Promise<ChunkingResult> {
    const metadata = await this.getMetadata(filePath)

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

    const tmpDir = app.tmpPath()
    const chunkDir = join(tmpDir, `chunks_${randomUUID()}`)
    await mkdir(chunkDir, { recursive: true })

    const chunks: ChunkInfo[] = []
    const inputExt = extname(filePath)
    const baseName = basename(filePath, inputExt)

    let currentStart = 0
    let chunkIndex = 0
    const totalDuration = metadata.duration

    while (currentStart < totalDuration) {
      const isLastChunk = currentStart + CHUNKING_CONFIG.CHUNK_DURATION_SECONDS >= totalDuration
      const chunkDuration = isLastChunk
        ? totalDuration - currentStart
        : CHUNKING_CONFIG.CHUNK_DURATION_SECONDS + CHUNKING_CONFIG.OVERLAP_SECONDS

      const chunkPath = join(chunkDir, `chunk_${baseName}_${chunkIndex}.m4a`)

      await this.extractChunk(filePath, chunkPath, currentStart, chunkDuration)

      chunks.push({
        index: chunkIndex,
        path: chunkPath,
        startTime: currentStart,
        duration: chunkDuration,
      })

      currentStart += CHUNKING_CONFIG.CHUNK_DURATION_SECONDS
      chunkIndex++
    }

    return {
      metadata,
      chunks,
      needsChunking: true,
    }
  }

  /**
   * Extract a chunk from audio file using ffmpeg.
   * Output is AAC/M4A to stay consistent with the pipeline.
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
      startTime.toString(),
      '-i',
      inputPath,
      '-t',
      duration.toString(),
      '-acodec',
      'aac',
      '-b:a',
      '64k',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-vn',
      '-y',
      outputPath,
    ]

    await execFileAsync(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 })
  }

  /**
   * Cleanup temporary chunk files and directory
   */
  async cleanupChunks(chunks: ChunkInfo[]): Promise<void> {
    for (const chunk of chunks) {
      try {
        await unlink(chunk.path)
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (chunks.length > 0) {
      const chunkDir = join(chunks[0].path, '..')
      if (chunkDir.includes('chunks_')) {
        try {
          await rmdir(chunkDir)
        } catch {
          // Ignore errors - directory might not be empty or already deleted
        }
      }
    }
  }
}

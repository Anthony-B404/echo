import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unlink, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import app from '@adonisjs/core/services/app'

// Use createRequire to import CommonJS modules in ESM
const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static') as string
const ffprobePath = require('ffprobe-static') as { path: string }

const execFileAsync = promisify(execFile)

/**
 * Audio conversion result
 */
export interface ConversionResult {
  path: string
  originalSize: number
  convertedSize: number
  duration: number
  compressionRatio: number
}

/**
 * Opus encoding presets for different use cases
 */
export const OPUS_PRESETS = {
  /** Voice/speech - excellent quality at low bitrate */
  voice: {
    bitrate: '48k',
    channels: 1,
    sampleRate: 48000,
  },
  /** Voice with higher quality */
  voiceHq: {
    bitrate: '64k',
    channels: 1,
    sampleRate: 48000,
  },
  /** Music/podcast quality */
  music: {
    bitrate: '96k',
    channels: 2,
    sampleRate: 48000,
  },
} as const

export type OpusPreset = keyof typeof OPUS_PRESETS

/**
 * Service for converting audio files to Opus format.
 * Uses ffmpeg-static for portable ffmpeg binary.
 */
export default class AudioConverterService {
  /**
   * Check if ffmpeg is available
   */
  async checkFfmpegAvailable(): Promise<boolean> {
    try {
      if (!ffmpegPath) {
        return false
      }
      await execFileAsync(ffmpegPath, ['-version'])
      return true
    } catch {
      return false
    }
  }

  /**
   * Get audio duration in seconds using ffprobe
   */
  async getDuration(filePath: string): Promise<number> {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]

    const { stdout } = await execFileAsync(ffprobePath.path, args)
    const data = JSON.parse(stdout)

    return parseFloat(data.format?.duration) || 0
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    const stats = await stat(filePath)
    return stats.size
  }

  /**
   * Convert audio file to Opus format
   *
   * @param inputPath - Path to source audio file
   * @param preset - Opus encoding preset (default: 'voice')
   * @returns Conversion result with paths and size info
   */
  async convertToOpus(inputPath: string, preset: OpusPreset = 'voice'): Promise<ConversionResult> {
    if (!ffmpegPath) {
      throw new Error('ffmpeg-static path not found')
    }

    const settings = OPUS_PRESETS[preset]
    const originalName = basename(inputPath)
    const outputPath = join(app.tmpPath(), `${randomUUID()}.opus`)

    // Get original file info
    const [originalSize, duration] = await Promise.all([
      this.getFileSize(inputPath),
      this.getDuration(inputPath),
    ])

    // Build ffmpeg arguments for Opus conversion
    const args = [
      '-i',
      inputPath,
      '-acodec',
      'libopus',
      '-b:a',
      settings.bitrate,
      '-ac',
      settings.channels.toString(),
      '-ar',
      settings.sampleRate.toString(),
      '-vn', // No video
      '-y', // Overwrite output
      outputPath,
    ]

    await execFileAsync(ffmpegPath, args)

    // Get converted file size
    const convertedSize = await this.getFileSize(outputPath)
    const compressionRatio = originalSize > 0 ? convertedSize / originalSize : 1

    console.log(
      `[AudioConverter] Converted ${originalName}: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(convertedSize / 1024 / 1024).toFixed(2)}MB (${(compressionRatio * 100).toFixed(1)}%)`
    )

    return {
      path: outputPath,
      originalSize,
      convertedSize,
      duration,
      compressionRatio,
    }
  }

  /**
   * Convert audio and delete original file
   *
   * @param inputPath - Path to source audio file
   * @param preset - Opus encoding preset (default: 'voice')
   * @returns Conversion result
   */
  async convertAndReplace(
    inputPath: string,
    preset: OpusPreset = 'voice'
  ): Promise<ConversionResult> {
    const result = await this.convertToOpus(inputPath, preset)

    // Delete original file
    try {
      await unlink(inputPath)
    } catch {
      // Ignore errors during cleanup
    }

    return result
  }

  /**
   * Check if file is already in Opus format
   */
  isOpusFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.opus')
  }

  /**
   * Cleanup temporary converted file
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      await unlink(filePath)
    } catch {
      // Ignore errors during cleanup
    }
  }
}

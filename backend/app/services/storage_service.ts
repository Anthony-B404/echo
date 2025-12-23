import drive from '@adonisjs/drive/services/main'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { randomUUID } from 'node:crypto'
import { extname, basename } from 'node:path'
import { readFile, stat } from 'node:fs/promises'

export interface StoredFileInfo {
  path: string
  originalName: string
  size: number
  mimeType: string
}

export interface StoreFromPathOptions {
  /** Original filename to preserve */
  originalName?: string
  /** Custom MIME type override */
  mimeType?: string
}

/**
 * Service for managing file storage with multi-tenant organization scoping.
 * Uses @adonisjs/drive for abstracted storage (local/S3).
 */
class StorageService {
  /**
   * Store audio file with organization scoping.
   * Path format: audios/{organizationId}/{uuid}{ext}
   */
  async storeAudioFile(file: MultipartFile, organizationId: number): Promise<StoredFileInfo> {
    const ext = extname(file.clientName)
    const fileName = `${randomUUID()}${ext}`
    const path = `audios/${organizationId}/${fileName}`

    // Read file from temp path and store using drive
    if (!file.tmpPath) {
      throw new Error('File has no temporary path')
    }

    const fileBuffer = await readFile(file.tmpPath)
    const disk = drive.use()
    await disk.put(path, fileBuffer)

    return {
      path,
      originalName: file.clientName,
      size: file.size,
      mimeType: file.type || 'audio/mpeg',
    }
  }

  /**
   * Store audio file from a local path with organization scoping.
   * Useful for storing converted/processed audio files.
   * Path format: audios/{organizationId}/{uuid}{ext}
   */
  async storeAudioFromPath(
    filePath: string,
    organizationId: number,
    options: StoreFromPathOptions = {}
  ): Promise<StoredFileInfo> {
    const ext = extname(filePath)
    const fileName = `${randomUUID()}${ext}`
    const storagePath = `audios/${organizationId}/${fileName}`

    const fileBuffer = await readFile(filePath)
    const fileStats = await stat(filePath)
    const disk = drive.use()
    await disk.put(storagePath, fileBuffer)

    const originalName = options.originalName || basename(filePath)
    const mimeType = options.mimeType || this.getMimeType(ext)

    return {
      path: storagePath,
      originalName,
      size: fileStats.size,
      mimeType,
    }
  }

  /**
   * Store document file with organization scoping.
   * Path format: documents/{organizationId}/{uuid}{ext}
   */
  async storeDocumentFile(
    content: Buffer | string,
    fileName: string,
    organizationId: number
  ): Promise<StoredFileInfo> {
    const ext = extname(fileName)
    const storedName = `${randomUUID()}${ext}`
    const path = `documents/${organizationId}/${storedName}`

    const disk = drive.use()
    await disk.put(path, content)

    const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content

    return {
      path,
      originalName: fileName,
      size: contentBuffer.length,
      mimeType: this.getMimeType(ext),
    }
  }

  /**
   * Delete a file from storage.
   */
  async deleteFile(path: string): Promise<void> {
    const disk = drive.use()
    await disk.delete(path)
  }

  /**
   * Check if file exists in storage.
   */
  async fileExists(path: string): Promise<boolean> {
    const disk = drive.use()
    return disk.exists(path)
  }

  /**
   * Get file content as Buffer.
   */
  async getFileBuffer(path: string): Promise<Buffer> {
    const disk = drive.use()
    const bytes = await disk.getBytes(path)
    return Buffer.from(bytes)
  }

  /**
   * Get file as readable stream.
   */
  async getFileStream(path: string) {
    const disk = drive.use()
    return disk.getStream(path)
  }

  /**
   * Get signed URL for temporary access (useful for S3).
   */
  async getSignedUrl(path: string, expiresIn: string = '1h'): Promise<string> {
    const disk = drive.use()
    return disk.getSignedUrl(path, { expiresIn })
  }

  /**
   * Get MIME type from file extension.
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.opus': 'audio/opus',
      '.webm': 'audio/webm',
    }
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
  }
}

export default new StorageService()

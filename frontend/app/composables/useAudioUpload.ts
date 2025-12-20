import type { ProcessJobResponse, AudioUploadProgress } from '~/types/audio'

export interface UseAudioUploadOptions {
  onProgress?: (progress: AudioUploadProgress) => void
  onSuccess?: (response: ProcessJobResponse) => void
  onError?: (error: Error) => void
}

const ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
]

const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|ogg|flac)$/i

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

export function useAudioUpload(options: UseAudioUploadOptions = {}) {
  const { authenticatedFetch } = useAuth()

  const uploading = ref(false)
  const progress = ref<AudioUploadProgress>({ loaded: 0, total: 0, percentage: 0 })
  const error = ref<string | null>(null)

  /**
   * Validate file type and size
   */
  function validateFile(file: File): { valid: boolean; error?: string } {
    const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.test(file.name)

    if (!isValidType) {
      return {
        valid: false,
        error: 'Invalid file type. Supported formats: MP3, WAV, M4A, OGG, FLAC',
      }
    }

    if (file.size > MAX_SIZE) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 25MB',
      }
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty',
      }
    }

    return { valid: true }
  }

  /**
   * Upload audio file with prompt
   */
  async function upload(file: File, prompt: string): Promise<ProcessJobResponse | null> {
    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      error.value = validation.error || 'Invalid file'
      options.onError?.(new Error(error.value))
      return null
    }

    // Validate prompt
    if (!prompt || prompt.trim().length < 5) {
      error.value = 'Prompt must be at least 5 characters'
      options.onError?.(new Error(error.value))
      return null
    }

    if (prompt.trim().length > 1000) {
      error.value = 'Prompt must be less than 1000 characters'
      options.onError?.(new Error(error.value))
      return null
    }

    uploading.value = true
    error.value = null
    progress.value = { loaded: 0, total: file.size, percentage: 0 }

    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('prompt', prompt.trim())

      const response = await authenticatedFetch<ProcessJobResponse>('/audio/process', {
        method: 'POST',
        body: formData,
      })

      progress.value = { loaded: file.size, total: file.size, percentage: 100 }
      options.onSuccess?.(response)

      return response
    } catch (err: any) {
      error.value = err?.data?.message || err?.message || 'Upload failed'
      options.onError?.(new Error(error.value))
      return null
    } finally {
      uploading.value = false
    }
  }

  /**
   * Reset state
   */
  function reset() {
    uploading.value = false
    progress.value = { loaded: 0, total: 0, percentage: 0 }
    error.value = null
  }

  /**
   * Format file size for display
   */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Format max size for display
   */
  function formatMaxSize(): string {
    return formatFileSize(MAX_SIZE)
  }

  return {
    // State
    uploading: readonly(uploading),
    progress: readonly(progress),
    error: readonly(error),

    // Methods
    validateFile,
    upload,
    reset,
    formatFileSize,
    formatMaxSize,

    // Constants
    ALLOWED_TYPES,
    MAX_SIZE,
  }
}

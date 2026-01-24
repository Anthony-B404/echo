/**
 * Audio Status Enum
 * Represents the processing state of an audio file
 */
export enum AudioStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Transcription Timestamp
 * Represents a segment of transcription with timing information
 */
export interface TranscriptionTimestamp {
  start: number
  end: number
  text: string
  speaker?: string
}

/**
 * Transcription User (minimal user info for last edited by)
 */
export interface TranscriptionUser {
  id: number
  fullName: string | null
  email: string
}

/**
 * Transcription
 * The result of audio transcription
 */
export interface Transcription {
  id: number
  audioId: number
  rawText: string
  language: string
  timestamps: TranscriptionTimestamp[] | null
  confidence: number | null
  analysis: string | null
  createdAt: string
  // Version tracking fields
  rawTextVersion: number
  analysisVersion: number
  lastEditedByUserId: number | null
  lastEditedAt: string | null
  updatedAt: string | null
  // Relations
  lastEditedByUser?: TranscriptionUser | null
}

/**
 * Audio
 * Represents an audio file record
 */
export interface Audio {
  id: number
  organizationId: number
  userId: number
  title: string | null
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string | null
  duration: number | null
  status: AudioStatus
  errorMessage: string | null
  currentJobId: string | null
  createdAt: string
  updatedAt: string
  transcription?: Transcription | null
}

/**
 * Audio Pagination Response
 * Paginated list of audios from the API
 */
export interface AudioPagination {
  data: Audio[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
    firstPage: number
  }
}

/**
 * Process Job Response
 * Response from POST /audio/process
 */
export interface ProcessJobResponse {
  jobId: string
  audioId: number
  message: string
  statusUrl: string
}

/**
 * Job Status
 * Response from GET /audio/status/:jobId
 */
export interface JobStatus {
  jobId: string
  status: 'uploading' | 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: {
    transcription: string
    analysis?: string
  }
  error?: string
  createdAt?: string
  processedAt?: string
  completedAt?: string
}

/**
 * Audio Upload Progress
 * Track upload progress for UI feedback
 */
export interface AudioUploadProgress {
  loaded: number
  total: number
  percentage: number
}

/**
 * Recorder State
 * State management for audio recording
 */
export interface RecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
}

/**
 * Audio Store State
 * Pinia store state shape
 */
export interface AudioStoreState {
  audios: Audio[]
  currentAudio: Audio | null
  pagination: {
    currentPage: number
    lastPage: number
    total: number
    perPage: number
  }
  loading: boolean
  error: string | null
  activeJobs: Map<string, JobStatus>
  processingAudioIds: Set<number>
}

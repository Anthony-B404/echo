/**
 * Supported fields that can be versioned
 */
export type TranscriptionVersionField = 'raw_text' | 'analysis'

/**
 * User info in version history
 */
export interface VersionUser {
  id: number
  fullName: string | null
  email?: string
}

/**
 * A version entry in the transcription history
 */
export interface TranscriptionVersion {
  id: number
  versionNumber: number
  fieldName: TranscriptionVersionField
  content?: string
  changeSummary: string | null
  preview?: string
  wordCount?: number
  createdAt: string
  user: VersionUser
}

/**
 * Edit info for transcription (who last edited, when, version)
 */
export interface TranscriptionEditInfo {
  rawTextVersion: number
  analysisVersion: number
  lastEditedBy: VersionUser | null
  lastEditedAt: string | null
}

/**
 * Edit conflict information returned from the API
 */
export interface EditConflict {
  currentVersion: number
  lastEditedBy: VersionUser | null
  lastEditedAt: string | null
}

/**
 * Response when there's an edit conflict
 */
export interface EditConflictResponse {
  code: 'EDIT_CONFLICT'
  message: string
  conflict: EditConflict
}

/**
 * Successful edit response
 */
export interface EditSuccessResponse {
  message: string
  audio: import('./audio').Audio
  version: {
    id: number
    versionNumber: number
    fieldName: TranscriptionVersionField
    changeSummary: string | null
    createdAt: string
    user: VersionUser
  } | null
}

/**
 * Version history response with pagination
 */
export interface VersionHistoryResponse {
  data: TranscriptionVersion[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

/**
 * Full version content response
 */
export interface VersionContentResponse {
  id: number
  versionNumber: number
  fieldName: TranscriptionVersionField
  content: string
  changeSummary: string | null
  wordCount: number
  createdAt: string
  user: VersionUser
}

/**
 * A single change in the diff (computed server-side)
 */
export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

/**
 * Statistics about the diff
 */
export interface DiffStats {
  linesAdded: number
  linesRemoved: number
  linesUnchanged: number
}

/**
 * Version diff response for comparing two versions
 */
export interface VersionDiffResponse {
  field: TranscriptionVersionField
  version1: VersionContentResponse
  version2: VersionContentResponse
  diff: {
    changes: DiffChange[]
    stats: DiffStats
  }
}

/**
 * Edit request payload
 */
export interface TranscriptionEditPayload {
  field: TranscriptionVersionField
  content: string
  expectedVersion: number
  changeSummary?: string
}

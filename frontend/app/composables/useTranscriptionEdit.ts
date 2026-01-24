import type { Audio } from '~/types/audio'
import type {
  TranscriptionVersionField,
  TranscriptionVersion,
  EditConflict,
  EditSuccessResponse,
  EditConflictResponse,
  VersionHistoryResponse,
  VersionContentResponse,
  VersionDiffResponse,
  TranscriptionEditPayload,
} from '~/types/transcription'
import type { ApiError } from '~/types'

export function useTranscriptionEdit(audioId: Ref<number> | number) {
  const { authenticatedFetch } = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const conflict = ref<EditConflict | null>(null)
  const history = ref<TranscriptionVersion[]>([])
  const historyMeta = ref<{ total: number; page: number; limit: number } | null>(null)

  const resolvedAudioId = computed(() => (typeof audioId === 'number' ? audioId : audioId.value))

  /**
   * Save an edit to a transcription field
   */
  async function saveEdit(payload: TranscriptionEditPayload): Promise<{
    success: boolean
    audio?: Audio
    conflict?: EditConflict
  }> {
    loading.value = true
    error.value = null
    conflict.value = null

    try {
      const response = (await authenticatedFetch(`/audios/${resolvedAudioId.value}/transcription`, {
        method: 'PUT',
        body: payload,
      })) as EditSuccessResponse

      return {
        success: true,
        audio: response.audio,
      }
    } catch (e: unknown) {
      const apiError = e as ApiError

      // Check if it's a conflict error
      if (apiError.statusCode === 409 && apiError.data?.code === 'EDIT_CONFLICT') {
        const conflictResponse = apiError.data as unknown as EditConflictResponse
        conflict.value = conflictResponse.conflict
        return {
          success: false,
          conflict: conflictResponse.conflict,
        }
      }

      error.value = apiError.data?.message || apiError.message || 'Failed to save changes'
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch version history for a field
   */
  async function fetchHistory(
    field?: TranscriptionVersionField,
    page = 1,
    limit = 20
  ): Promise<VersionHistoryResponse | null> {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (field) {
        params.set('field', field)
      }

      const response = (await authenticatedFetch(
        `/audios/${resolvedAudioId.value}/transcription/history?${params}`
      )) as VersionHistoryResponse

      history.value = response.data
      historyMeta.value = response.meta

      return response
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.data?.message || apiError.message || 'Failed to fetch history'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a specific version's content
   */
  async function fetchVersion(versionId: number): Promise<VersionContentResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(
        `/audios/${resolvedAudioId.value}/transcription/version/${versionId}`
      )) as VersionContentResponse

      return response
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.data?.message || apiError.message || 'Failed to fetch version'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Restore a previous version
   */
  async function restoreVersion(versionId: number): Promise<{
    success: boolean
    audio?: Audio
  }> {
    loading.value = true
    error.value = null

    try {
      const response = (await authenticatedFetch(
        `/audios/${resolvedAudioId.value}/transcription/restore/${versionId}`,
        { method: 'POST' }
      )) as EditSuccessResponse

      return {
        success: true,
        audio: response.audio,
      }
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.data?.message || apiError.message || 'Failed to restore version'
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  /**
   * Compare two versions
   */
  async function compareVersions(
    version1Id: number,
    version2Id: number
  ): Promise<VersionDiffResponse | null> {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        version1: String(version1Id),
        version2: String(version2Id),
      })

      const response = (await authenticatedFetch(
        `/audios/${resolvedAudioId.value}/transcription/diff?${params}`
      )) as VersionDiffResponse

      return response
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = apiError.data?.message || apiError.message || 'Failed to compare versions'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear conflict state (e.g., when user dismisses conflict alert)
   */
  function clearConflict() {
    conflict.value = null
  }

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  return {
    loading,
    error,
    conflict,
    history,
    historyMeta,
    saveEdit,
    fetchHistory,
    fetchVersion,
    restoreVersion,
    compareVersions,
    clearConflict,
    clearError,
  }
}

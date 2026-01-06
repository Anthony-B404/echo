import { defineStore } from 'pinia'
import { AudioStatus } from '~/types/audio'
import type { Audio, AudioPagination, JobStatus } from '~/types/audio'

interface AudioState {
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

export const useAudioStore = defineStore('audio', {
  state: (): AudioState => ({
    audios: [],
    currentAudio: null,
    pagination: {
      currentPage: 1,
      lastPage: 1,
      total: 0,
      perPage: 20,
    },
    loading: false,
    error: null,
    activeJobs: new Map(),
    processingAudioIds: new Set(),
  }),

  getters: {
    getAudios: (state) => state.audios,
    getCurrentAudio: (state) => state.currentAudio,
    isLoading: (state) => state.loading,
    hasError: (state) => !!state.error,
    getError: (state) => state.error,
    getPagination: (state) => state.pagination,
    hasActiveJobs: (state) => state.activeJobs.size > 0,

    getJobStatus: (state) => {
      return (jobId: string) => state.activeJobs.get(jobId)
    },

    isAudioProcessing: (state) => {
      return (audioId: number) => state.processingAudioIds.has(audioId)
    },

    pendingAudios: (state) => state.audios.filter((a) => a.status === AudioStatus.Pending),
    processingAudios: (state) => state.audios.filter((a) => a.status === AudioStatus.Processing),
    completedAudios: (state) => state.audios.filter((a) => a.status === AudioStatus.Completed),
    failedAudios: (state) => state.audios.filter((a) => a.status === AudioStatus.Failed),

    hasMore: (state) => state.pagination.currentPage < state.pagination.lastPage,
  },

  actions: {
    /**
     * Fetch paginated list of audios with optional filters and sorting
     */
    async fetchAudios(
      page: number = 1,
      options?: {
        status?: AudioStatus
        search?: string
        sort?: 'createdAt' | 'title' | 'duration' | 'status'
        order?: 'asc' | 'desc'
        append?: boolean
      }
    ) {
      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const params = new URLSearchParams({ page: String(page), limit: '20' })

        if (options?.status) params.append('status', options.status)
        if (options?.search) params.append('search', options.search)
        if (options?.sort) params.append('sort', options.sort)
        if (options?.order) params.append('order', options.order)

        const response = await authenticatedFetch<AudioPagination>(`/audios?${params}`)

        // Determine if we should append or replace
        const shouldAppend = options?.append ?? page > 1

        if (shouldAppend) {
          // Append for pagination
          this.audios = [...this.audios, ...response.data]
        } else {
          this.audios = response.data
        }

        this.pagination = {
          currentPage: response.meta.currentPage,
          lastPage: response.meta.lastPage,
          total: response.meta.total,
          perPage: response.meta.perPage,
        }
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to load audios'
        console.error('Failed to fetch audios:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch single audio with transcription
     */
    async fetchAudio(id: number): Promise<Audio | null> {
      // Validate ID before API call
      if (!Number.isInteger(id) || id <= 0) {
        console.warn('fetchAudio called with invalid ID:', id)
        return null
      }

      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const audio = await authenticatedFetch<Audio>(`/audios/${id}`)
        this.currentAudio = audio

        // Update in list if exists
        const index = this.audios.findIndex((a) => a.id === id)
        if (index !== -1) {
          this.audios[index] = audio
        }

        return audio
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to load audio'
        console.error('Failed to fetch audio:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    /**
     * Delete audio and remove from state
     */
    async deleteAudio(id: number): Promise<boolean> {
      try {
        const { authenticatedFetch } = useAuth()
        await authenticatedFetch(`/audios/${id}`, { method: 'DELETE' })

        // Remove from local state
        this.audios = this.audios.filter((a) => a.id !== id)
        if (this.currentAudio?.id === id) {
          this.currentAudio = null
        }
        this.pagination.total = Math.max(0, this.pagination.total - 1)

        return true
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to delete audio'
        console.error('Failed to delete audio:', error)
        return false
      }
    },

    /**
     * Delete multiple audios and remove from state
     */
    async deleteMultiple(ids: number[]): Promise<{ success: boolean; deletedCount: number }> {
      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ deletedCount: number }>('/audios/batch', {
          method: 'DELETE',
          body: { ids },
        })

        // Remove from local state
        this.audios = this.audios.filter((a) => !ids.includes(a.id))
        if (this.currentAudio && ids.includes(this.currentAudio.id)) {
          this.currentAudio = null
        }
        this.pagination.total = Math.max(0, this.pagination.total - response.deletedCount)

        return { success: true, deletedCount: response.deletedCount }
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to delete audios'
        console.error('Failed to delete multiple audios:', error)
        return { success: false, deletedCount: 0 }
      }
    },

    /**
     * Update audio title
     */
    async updateAudio(id: number, title: string): Promise<boolean> {
      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ audio: Audio }>(`/audios/${id}`, {
          method: 'PUT',
          body: { title },
        })

        // Update in local state
        const index = this.audios.findIndex((a) => a.id === id)
        if (index !== -1) {
          this.audios[index] = { ...this.audios[index], title: response.audio.title }
        }
        if (this.currentAudio?.id === id) {
          this.currentAudio = { ...this.currentAudio, title: response.audio.title }
        }

        return true
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to update audio'
        console.error('Failed to update audio:', error)
        return false
      }
    },

    /**
     * Add job to tracking
     */
    trackJob(jobId: string, audioId: number) {
      this.activeJobs.set(jobId, {
        jobId,
        status: AudioStatus.Pending,
        progress: 0,
      })
      this.processingAudioIds.add(audioId)
    },

    /**
     * Update job status
     */
    updateJobStatus(jobId: string, status: JobStatus) {
      this.activeJobs.set(jobId, status)
    },

    /**
     * Remove job from tracking
     */
    removeJob(jobId: string, audioId: number) {
      this.activeJobs.delete(jobId)
      this.processingAudioIds.delete(audioId)
    },

    /**
     * Update audio status locally
     */
    updateAudioStatus(audioId: number, status: AudioStatus, errorMessage?: string) {
      const index = this.audios.findIndex((a) => a.id === audioId)
      if (index !== -1) {
        this.audios[index] = {
          ...this.audios[index],
          status,
          errorMessage: errorMessage || null,
        }
      }
      if (this.currentAudio?.id === audioId) {
        this.currentAudio = {
          ...this.currentAudio,
          status,
          errorMessage: errorMessage || null,
        }
      }
    },

    /**
     * Add new audio to list (prepend)
     */
    addAudio(audio: Audio) {
      // Remove if already exists (to avoid duplicates)
      this.audios = this.audios.filter((a) => a.id !== audio.id)
      // Add to beginning
      this.audios.unshift(audio)
      this.pagination.total += 1
    },

    /**
     * Clear current audio
     */
    clearCurrentAudio() {
      this.currentAudio = null
    },

    /**
     * Reset store to initial state
     */
    reset() {
      this.audios = []
      this.currentAudio = null
      this.pagination = { currentPage: 1, lastPage: 1, total: 0, perPage: 20 }
      this.loading = false
      this.error = null
      this.activeJobs.clear()
      this.processingAudioIds.clear()
    },
  },
})

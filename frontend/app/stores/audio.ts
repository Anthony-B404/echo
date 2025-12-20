import { defineStore } from 'pinia'
import type { Audio, AudioPagination, AudioStatus, JobStatus } from '~/types/audio'

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

    pendingAudios: (state) => state.audios.filter((a) => a.status === 'pending'),
    processingAudios: (state) => state.audios.filter((a) => a.status === 'processing'),
    completedAudios: (state) => state.audios.filter((a) => a.status === 'completed'),
    failedAudios: (state) => state.audios.filter((a) => a.status === 'failed'),

    hasMore: (state) => state.pagination.currentPage < state.pagination.lastPage,
  },

  actions: {
    /**
     * Fetch paginated list of audios
     */
    async fetchAudios(page: number = 1, status?: AudioStatus) {
      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (status) params.append('status', status)

        const response = await authenticatedFetch<AudioPagination>(`/audios?${params}`)

        if (page === 1) {
          this.audios = response.data
        } else {
          // Append for pagination
          this.audios = [...this.audios, ...response.data]
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
     * Add job to tracking
     */
    trackJob(jobId: string, audioId: number) {
      this.activeJobs.set(jobId, {
        jobId,
        status: 'pending',
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

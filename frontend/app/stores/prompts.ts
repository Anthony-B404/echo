import { defineStore } from 'pinia'
import type {
  Prompt,
  PromptCategory,
  PromptPagination,
  CreatePromptPayload,
  UpdatePromptPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  PromptsStoreState,
} from '~/types/prompt'

export const usePromptsStore = defineStore('prompts', {
  state: (): PromptsStoreState => ({
    prompts: [],
    categories: [],
    currentPrompt: null,
    pagination: {
      currentPage: 1,
      lastPage: 1,
      total: 0,
      perPage: 50,
    },
    loading: false,
    categoriesLoading: false,
    error: null,
  }),

  getters: {
    getPrompts: (state) => state.prompts,
    getCategories: (state) => state.categories,
    getCurrentPrompt: (state) => state.currentPrompt,
    isLoading: (state) => state.loading,
    isCategoriesLoading: (state) => state.categoriesLoading,
    hasError: (state) => !!state.error,
    getError: (state) => state.error,
    getPagination: (state) => state.pagination,

    favoritePrompts: (state) => state.prompts.filter((p) => p.isFavorite),

    promptsByCategory: (state) => {
      return (categoryId: number | null) =>
        state.prompts.filter((p) => p.categoryId === categoryId)
    },

    getCategory: (state) => {
      return (categoryId: number) => state.categories.find((c) => c.id === categoryId)
    },

    hasMore: (state) => state.pagination.currentPage < state.pagination.lastPage,
  },

  actions: {
    /**
     * Fetch all categories
     */
    async fetchCategories(includePromptCount: boolean = true) {
      this.categoriesLoading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const params = new URLSearchParams()
        if (includePromptCount) params.append('includePromptCount', 'true')

        const categories = await authenticatedFetch<PromptCategory[]>(
          `/prompt-categories?${params}`
        )
        this.categories = categories
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to load categories'
        console.error('Failed to fetch categories:', error)
      } finally {
        this.categoriesLoading = false
      }
    },

    /**
     * Fetch paginated list of prompts with optional filters
     */
    async fetchPrompts(
      page: number = 1,
      options?: {
        categoryId?: number
        favorites?: boolean
        search?: string
        sort?: 'createdAt' | 'title' | 'usageCount' | 'sortOrder'
        order?: 'asc' | 'desc'
        append?: boolean
      }
    ) {
      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const params = new URLSearchParams({ page: String(page), limit: '50' })

        if (options?.categoryId) params.append('categoryId', String(options.categoryId))
        if (options?.favorites) params.append('favorites', 'true')
        if (options?.search) params.append('search', options.search)
        if (options?.sort) params.append('sort', options.sort)
        if (options?.order) params.append('order', options.order)

        const response = await authenticatedFetch<PromptPagination>(`/prompts?${params}`)

        const shouldAppend = options?.append ?? page > 1

        if (shouldAppend) {
          this.prompts = [...this.prompts, ...response.data]
        } else {
          this.prompts = response.data
        }

        this.pagination = {
          currentPage: response.meta.currentPage,
          lastPage: response.meta.lastPage,
          total: response.meta.total,
          perPage: response.meta.perPage,
        }
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to load prompts'
        console.error('Failed to fetch prompts:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Create a new prompt
     */
    async createPrompt(payload: CreatePromptPayload): Promise<Prompt | null> {
      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ message: string; prompt: Prompt }>(
          '/prompts',
          {
            method: 'POST',
            body: payload,
          }
        )

        // Add to local state
        this.prompts.unshift(response.prompt)

        return response.prompt
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to create prompt'
        console.error('Failed to create prompt:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    /**
     * Update a prompt
     */
    async updatePrompt(id: number, payload: UpdatePromptPayload): Promise<Prompt | null> {
      this.loading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ message: string; prompt: Prompt }>(
          `/prompts/${id}`,
          {
            method: 'PUT',
            body: payload,
          }
        )

        // Update in local state
        const index = this.prompts.findIndex((p) => p.id === id)
        if (index !== -1) {
          this.prompts[index] = response.prompt
        }

        if (this.currentPrompt?.id === id) {
          this.currentPrompt = response.prompt
        }

        return response.prompt
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to update prompt'
        console.error('Failed to update prompt:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    /**
     * Delete a prompt
     */
    async deletePrompt(id: number): Promise<boolean> {
      try {
        const { authenticatedFetch } = useAuth()
        await authenticatedFetch(`/prompts/${id}`, { method: 'DELETE' })

        // Remove from local state
        this.prompts = this.prompts.filter((p) => p.id !== id)

        if (this.currentPrompt?.id === id) {
          this.currentPrompt = null
        }

        return true
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to delete prompt'
        console.error('Failed to delete prompt:', error)
        return false
      }
    },

    /**
     * Toggle favorite status
     */
    async toggleFavorite(id: number): Promise<boolean | null> {
      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ isFavorite: boolean }>(
          `/prompts/${id}/favorite`,
          { method: 'POST' }
        )

        // Update in local state
        const index = this.prompts.findIndex((p) => p.id === id)
        if (index !== -1) {
          this.prompts[index].isFavorite = response.isFavorite
        }

        if (this.currentPrompt?.id === id) {
          this.currentPrompt.isFavorite = response.isFavorite
        }

        return response.isFavorite
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to toggle favorite'
        console.error('Failed to toggle favorite:', error)
        return null
      }
    },

    /**
     * Increment usage count (when prompt is used)
     */
    async incrementUsage(id: number): Promise<void> {
      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ usageCount: number }>(
          `/prompts/${id}/use`,
          { method: 'POST' }
        )

        // Update in local state
        const index = this.prompts.findIndex((p) => p.id === id)
        if (index !== -1) {
          this.prompts[index].usageCount = response.usageCount
        }
      } catch (error: any) {
        console.error('Failed to increment usage:', error)
      }
    },

    /**
     * Create a new category
     */
    async createCategory(payload: CreateCategoryPayload): Promise<PromptCategory | null> {
      this.categoriesLoading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ message: string; category: PromptCategory }>(
          '/prompt-categories',
          {
            method: 'POST',
            body: payload,
          }
        )

        // Add to local state
        this.categories.push(response.category)

        return response.category
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to create category'
        console.error('Failed to create category:', error)
        return null
      } finally {
        this.categoriesLoading = false
      }
    },

    /**
     * Update a category
     */
    async updateCategory(
      id: number,
      payload: UpdateCategoryPayload
    ): Promise<PromptCategory | null> {
      this.categoriesLoading = true
      this.error = null

      try {
        const { authenticatedFetch } = useAuth()
        const response = await authenticatedFetch<{ message: string; category: PromptCategory }>(
          `/prompt-categories/${id}`,
          {
            method: 'PUT',
            body: payload,
          }
        )

        // Update in local state
        const index = this.categories.findIndex((c) => c.id === id)
        if (index !== -1) {
          this.categories[index] = response.category
        }

        return response.category
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to update category'
        console.error('Failed to update category:', error)
        return null
      } finally {
        this.categoriesLoading = false
      }
    },

    /**
     * Delete a category
     */
    async deleteCategory(id: number): Promise<boolean> {
      try {
        const { authenticatedFetch } = useAuth()
        await authenticatedFetch(`/prompt-categories/${id}`, { method: 'DELETE' })

        // Remove from local state
        this.categories = this.categories.filter((c) => c.id !== id)

        return true
      } catch (error: any) {
        this.error = error?.data?.message || error?.message || 'Failed to delete category'
        console.error('Failed to delete category:', error)
        return false
      }
    },

    /**
     * Clear error
     */
    clearError() {
      this.error = null
    },

    /**
     * Reset store
     */
    reset() {
      this.prompts = []
      this.categories = []
      this.currentPrompt = null
      this.pagination = {
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 50,
      }
      this.loading = false
      this.categoriesLoading = false
      this.error = null
    },
  },
})

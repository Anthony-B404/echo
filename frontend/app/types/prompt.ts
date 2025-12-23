/**
 * Prompt Category
 * Represents a category for organizing prompts
 */
export interface PromptCategory {
  id: number
  organizationId: number
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sortOrder: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
  promptsCount?: number
}

/**
 * Prompt
 * Represents a prompt template
 */
export interface Prompt {
  id: number
  organizationId: number
  categoryId: number | null
  title: string
  content: string
  isDefault: boolean
  isFavorite: boolean
  usageCount: number
  sortOrder: number
  createdAt: string
  updatedAt: string
  category?: PromptCategory | null
}

/**
 * Prompt Pagination Response
 * Paginated list of prompts from the API
 */
export interface PromptPagination {
  data: Prompt[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
    firstPage: number
  }
}

/**
 * Create Prompt Payload
 */
export interface CreatePromptPayload {
  title: string
  content: string
  categoryId?: number | null
  isFavorite?: boolean
}

/**
 * Update Prompt Payload
 */
export interface UpdatePromptPayload {
  title?: string
  content?: string
  categoryId?: number | null
  isFavorite?: boolean
  sortOrder?: number
}

/**
 * Create Category Payload
 */
export interface CreateCategoryPayload {
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

/**
 * Update Category Payload
 */
export interface UpdateCategoryPayload {
  name?: string
  description?: string | null
  color?: string | null
  icon?: string | null
  sortOrder?: number
}

/**
 * Prompts Store State
 * Pinia store state shape
 */
export interface PromptsStoreState {
  prompts: Prompt[]
  categories: PromptCategory[]
  currentPrompt: Prompt | null
  pagination: {
    currentPage: number
    lastPage: number
    total: number
    perPage: number
  }
  loading: boolean
  categoriesLoading: boolean
  error: string | null
}

<script setup lang="ts">
import type { Prompt, CreatePromptPayload, UpdatePromptPayload, CreateCategoryPayload, UpdateCategoryPayload } from '~/types/prompt'
import PromptCard from '~/components/prompt/PromptCard.vue'
import PromptForm from '~/components/prompt/PromptForm.vue'
import CategoryTabs from '~/components/prompt/CategoryTabs.vue'
import CategoryManager from '~/components/prompt/CategoryManager.vue'

definePageMeta({
  middleware: ['auth', 'pending-deletion', 'organization-status']
})

const { t } = useI18n()

useSeoMeta({
  title: t('seo.prompts.title'),
  description: t('seo.prompts.description')
})
const localePath = useLocalePath()

const promptsStore = usePromptsStore()
const toast = useToast()

// State
const searchQuery = ref('')
const selectedCategoryId = ref<number | null>(null)
const showFavorites = ref(false)
const promptFormOpen = ref(false)
const categoryManagerOpen = ref(false)
const deleteModalOpen = ref(false)
const editingPrompt = ref<Prompt | null>(null)
const promptToDelete = ref<Prompt | null>(null)
const initialLoadDone = ref(false)
const isFiltering = ref(false)

// Debounced search
const debouncedSearch = refDebounced(searchQuery, 300)

// Load data on mount
onMounted(async () => {
  await Promise.all([
    promptsStore.fetchCategories(),
    promptsStore.fetchPrompts()
  ])
  initialLoadDone.value = true
})

// Refetch when search changes
watch(debouncedSearch, () => {
  fetchPrompts()
})

// Le serveur filtre déjà par categoryId et favorites via fetchPrompts()
// Pas de filtrage client nécessaire - évite les états intermédiaires qui cassent l'animation
const filteredPrompts = computed(() => promptsStore.prompts)

async function fetchPrompts () {
  isFiltering.value = true
  await promptsStore.fetchPrompts(1, {
    categoryId: showFavorites.value ? undefined : selectedCategoryId.value ?? undefined,
    favorites: showFavorites.value ? true : undefined,
    search: debouncedSearch.value || undefined
  })
  isFiltering.value = false
}

function handleCategorySelect (categoryId: number | null) {
  showFavorites.value = false
  selectedCategoryId.value = categoryId
  fetchPrompts()
}

function handleFavoritesSelect () {
  showFavorites.value = true
  selectedCategoryId.value = null
  fetchPrompts()
}

function handleAddPrompt () {
  editingPrompt.value = null
  promptFormOpen.value = true
}

function handleEditPrompt (prompt: Prompt) {
  editingPrompt.value = prompt
  promptFormOpen.value = true
}

function handleDeletePrompt (prompt: Prompt) {
  promptToDelete.value = prompt
  deleteModalOpen.value = true
}

async function handleSavePrompt (payload: CreatePromptPayload | UpdatePromptPayload) {
  if (editingPrompt.value) {
    const updated = await promptsStore.updatePrompt(editingPrompt.value.id, payload)
    if (updated) {
      toast.add({ title: t('pages.dashboard.prompts.promptUpdated'), color: 'success' })
    } else {
      toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
    }
  } else {
    const created = await promptsStore.createPrompt(payload as CreatePromptPayload)
    if (created) {
      toast.add({ title: t('pages.dashboard.prompts.promptCreated'), color: 'success' })
    } else {
      toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
    }
  }
}

async function handleConfirmDelete () {
  if (!promptToDelete.value) { return }

  const success = await promptsStore.deletePrompt(promptToDelete.value.id)
  if (success) {
    toast.add({ title: t('pages.dashboard.prompts.promptDeleted'), color: 'success' })
  } else {
    toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
  }

  deleteModalOpen.value = false
  promptToDelete.value = null
}

async function handleToggleFavorite (prompt: Prompt) {
  const result = await promptsStore.toggleFavorite(prompt.id)
  if (result !== null) {
    toast.add({
      title: result
        ? t('pages.dashboard.prompts.addedToFavorites')
        : t('pages.dashboard.prompts.removedFromFavorites'),
      color: 'success'
    })
  } else {
    toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
  }
}

async function handleCreateCategory (payload: CreateCategoryPayload) {
  const created = await promptsStore.createCategory(payload)
  if (created) {
    toast.add({ title: t('pages.dashboard.prompts.categoryCreated'), color: 'success' })
  } else {
    toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
  }
}

async function handleUpdateCategory (id: number, payload: UpdateCategoryPayload) {
  const updated = await promptsStore.updateCategory(id, payload)
  if (updated) {
    toast.add({ title: t('pages.dashboard.prompts.categoryUpdated'), color: 'success' })
  } else {
    toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
  }
}

async function handleDeleteCategory (id: number) {
  const success = await promptsStore.deleteCategory(id)
  if (success) {
    toast.add({ title: t('pages.dashboard.prompts.categoryDeleted'), color: 'success' })
  } else {
    toast.add({ title: t('common.error'), description: promptsStore.error || undefined, color: 'error' })
  }
}
</script>

<template>
  <div class="w-full min-w-0 space-y-6">
    <!-- Header - toujours visible -->
    <div class="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ t('pages.dashboard.prompts.title') }}
        </h1>
        <p class="mt-1 text-muted">
          {{ t('pages.dashboard.prompts.subtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-plus"
          color="primary"
          @click="handleAddPrompt"
        >
          {{ t('pages.dashboard.prompts.addPrompt') }}
        </UButton>
        <UButton
          :to="localePath('/dashboard')"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
        >
          {{ t('pages.dashboard.library.backToWorkshop') }}
        </UButton>
      </div>
    </div>

    <!-- Filters bar - toujours visible -->
    <UCard class="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div class="flex flex-wrap items-center gap-4">
        <!-- Search input -->
        <div class="w-full sm:flex-1 sm:min-w-[200px]">
          <UInput
            v-model="searchQuery"
            :placeholder="t('pages.dashboard.prompts.search')"
            icon="i-lucide-search"
            size="md"
            class="w-full"
          />
        </div>

        <!-- Manage categories button -->
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          size="md"
          @click="categoryManagerOpen = true"
        >
          {{ t('pages.dashboard.prompts.manageCategories') }}
        </UButton>
      </div>

      <!-- Category tabs -->
      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <!-- Skeleton pendant le chargement -->
        <div v-if="!initialLoadDone" class="flex flex-wrap items-center gap-2">
          <USkeleton class="h-8 w-14 rounded-md" />
          <USkeleton class="h-8 w-20 rounded-md" />
          <div class="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <USkeleton class="h-8 w-20 rounded-md" />
          <USkeleton class="h-8 w-24 rounded-md" />
          <USkeleton class="h-8 w-22 rounded-md" />
          <USkeleton class="h-8 w-20 rounded-md" />
        </div>
        <!-- Vrais tabs après chargement -->
        <CategoryTabs
          v-else
          :categories="promptsStore.categories"
          :selected-category-id="selectedCategoryId"
          :show-favorites="showFavorites"
          @update:selected-category-id="handleCategorySelect"
          @select-favorites="handleFavoritesSelect"
        />
      </div>
    </UCard>

    <!-- Grid area - skeleton ou contenu avec transition -->
    <div v-auto-animate class="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <!-- Skeleton cards pendant le chargement initial -->
      <template v-if="!initialLoadDone">
        <PromptCardSkeleton v-for="i in 12" :key="`skeleton-${i}`" />
      </template>

      <!-- Contenu réel -->
      <template v-else>
        <PromptCard
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          :prompt="prompt"
          show-category
          @edit="handleEditPrompt"
          @delete="handleDeletePrompt"
          @toggle-favorite="handleToggleFavorite"
        />

        <!-- Empty state inline -->
        <div
          v-if="filteredPrompts.length === 0 && !isFiltering"
          class="col-span-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
        >
          <div class="py-12 text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <UIcon name="i-lucide-file-text" class="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              {{ t('pages.dashboard.prompts.noPrompts') }}
            </h3>
            <p class="mb-4 text-gray-500 dark:text-gray-400">
              {{ t('pages.dashboard.prompts.noPromptsDescription') }}
            </p>
            <UButton
              icon="i-lucide-plus"
              color="primary"
              @click="handleAddPrompt"
            >
              {{ t('pages.dashboard.prompts.addPrompt') }}
            </UButton>
          </div>
        </div>
      </template>
    </div>

    <!-- Prompt form modal -->
    <PromptForm
      v-model:open="promptFormOpen"
      :prompt="editingPrompt"
      :categories="promptsStore.categories"
      @save="handleSavePrompt"
    />

    <!-- Category manager modal -->
    <CategoryManager
      v-model:open="categoryManagerOpen"
      :categories="promptsStore.categories"
      @create="handleCreateCategory"
      @update="handleUpdateCategory"
      @delete="handleDeleteCategory"
    />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModalOpen">
      <template #header>
        <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">
          {{ t('pages.dashboard.prompts.confirmDelete') }}
        </h3>
      </template>
      <template #body>
        <p class="text-gray-600 dark:text-gray-300">
          {{ t('pages.dashboard.prompts.confirmDeleteMessage', { title: promptToDelete?.title }) }}
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            @click="deleteModalOpen = false"
          >
            {{ t('common.buttons.cancel') }}
          </UButton>
          <UButton
            color="error"
            @click="handleConfirmDelete"
          >
            {{ t('common.buttons.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

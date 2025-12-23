<script setup lang="ts">
import type { Prompt } from '~/types/prompt'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [prompt: Prompt]
}>()

const { t } = useI18n()

const promptsStore = usePromptsStore()

const searchQuery = ref('')
const selectedCategoryId = ref<number | null>(null)
const showFavorites = ref(false)

// Load data when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    selectedCategoryId.value = null
    showFavorites.value = false

    if (promptsStore.categories.length === 0) {
      await promptsStore.fetchCategories()
    }
    await promptsStore.fetchPrompts()
  }
})

const filteredPrompts = computed(() => {
  let prompts = promptsStore.prompts

  // Filter by favorites
  if (showFavorites.value) {
    prompts = prompts.filter((p) => p.isFavorite)
  }
  // Filter by category
  else if (selectedCategoryId.value !== null) {
    prompts = prompts.filter((p) => p.categoryId === selectedCategoryId.value)
  }

  // Filter by search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    prompts = prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
    )
  }

  return prompts
})

function handleSelectPrompt(prompt: Prompt) {
  emit('select', prompt)
  emit('update:open', false)
}

function handleCategorySelect(categoryId: number | null) {
  showFavorites.value = false
  selectedCategoryId.value = categoryId
}

function handleFavoritesSelect() {
  showFavorites.value = true
  selectedCategoryId.value = null
}

function handleClose() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    size="xl"
    @update:open="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ t('pages.dashboard.prompts.selectPrompt') }}
        </h3>
        <NuxtLink
          to="/dashboard/prompts"
          class="text-sm text-primary-500 hover:text-primary-600"
          @click="handleClose"
        >
          {{ t('pages.dashboard.prompts.manageLibrary') }}
        </NuxtLink>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Search -->
        <UInput
          v-model="searchQuery"
          :placeholder="t('pages.dashboard.prompts.search')"
          icon="i-lucide-search"
          class="w-full"
        />

        <!-- Category tabs -->
        <PromptCategoryTabs
          :categories="promptsStore.categories"
          :selected-category-id="selectedCategoryId"
          :show-favorites="showFavorites"
          @update:selected-category-id="handleCategorySelect"
          @select-favorites="handleFavoritesSelect"
        />

        <!-- Prompts grid -->
        <div
          v-if="filteredPrompts.length > 0"
          class="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2"
        >
          <div
            v-for="prompt in filteredPrompts"
            :key="prompt.id"
            class="cursor-pointer rounded-lg border border-gray-200 p-3 transition-colors hover:border-primary-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-primary-600 dark:hover:bg-gray-800"
            @click="handleSelectPrompt(prompt)"
          >
            <div class="mb-1 flex items-center justify-between">
              <span class="text-sm font-medium">{{ prompt.title }}</span>
              <UIcon
                v-if="prompt.isFavorite"
                name="i-lucide-star"
                class="h-4 w-4 text-yellow-400"
              />
            </div>
            <p class="text-xs text-gray-500 line-clamp-2">
              {{ prompt.content }}
            </p>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="py-12 text-center text-gray-500 dark:text-gray-400"
        >
          <UIcon name="i-lucide-file-text" class="mx-auto mb-2 h-12 w-12 opacity-50" />
          <p>{{ t('pages.dashboard.prompts.noPrompts') }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          @click="handleClose"
        >
          {{ t('common.buttons.cancel') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

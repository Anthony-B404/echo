<script setup lang="ts">
import type { Prompt } from '~/types/prompt'

const props = defineProps<{
  prompt: Prompt
  selected?: boolean
  showCategory?: boolean
}>()

const emit = defineEmits<{
  select: [prompt: Prompt]
  edit: [prompt: Prompt]
  delete: [prompt: Prompt]
  toggleFavorite: [prompt: Prompt]
}>()

const { t } = useI18n()

const promptsStore = usePromptsStore()

const category = computed(() => {
  if (!props.prompt.categoryId) return null
  return promptsStore.getCategory(props.prompt.categoryId)
})

function handleSelect() {
  emit('select', props.prompt)
}

function handleEdit(e: Event) {
  e.stopPropagation()
  emit('edit', props.prompt)
}

function handleDelete(e: Event) {
  e.stopPropagation()
  emit('delete', props.prompt)
}

function handleToggleFavorite(e: Event) {
  e.stopPropagation()
  emit('toggleFavorite', props.prompt)
}

function getContentPreview(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength).trim() + '...'
}
</script>

<template>
  <div
    class="group flex h-full cursor-pointer flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4 transition-all hover:shadow-md"
    :class="{ 'ring-2 ring-primary-500': selected }"
    @click="handleSelect"
  >
    <!-- Header -->
    <div class="mb-2 flex items-start justify-between">
      <div class="flex-1 pr-2">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ prompt.title }}
        </h3>
        <!-- Category - always reserve space -->
        <div class="mt-1 flex items-center gap-1 min-h-[1rem]">
          <template v-if="showCategory && category">
            <span
              class="inline-flex h-2 w-2 rounded-full"
              :style="{ backgroundColor: category.color || '#6B7280' }"
            />
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ category.name }}
            </span>
          </template>
        </div>
      </div>

      <!-- Favorite button -->
      <UButton
        icon="i-lucide-star"
        color="neutral"
        variant="ghost"
        size="xs"
        :class="prompt.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : ''"
        @click="handleToggleFavorite"
      />
    </div>

    <!-- Content preview -->
    <p class="mb-3 flex-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
      {{ getContentPreview(prompt.content, 120) }}
    </p>

    <!-- Footer - always visible -->
    <div class="flex items-center justify-between min-h-[1.5rem]">
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <span v-if="prompt.usageCount > 0" class="flex items-center gap-1">
          <UIcon name="i-lucide-bar-chart-2" class="h-3 w-3" />
          {{ prompt.usageCount }}
        </span>
        <span v-if="prompt.isDefault" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
          {{ t('pages.dashboard.prompts.system') }}
        </span>
        <span v-else class="rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
          {{ t('pages.dashboard.prompts.custom') }}
        </span>
      </div>

      <!-- Actions (visible on hover) -->
      <div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="handleEdit"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          @click="handleDelete"
        />
      </div>
    </div>
  </div>
</template>

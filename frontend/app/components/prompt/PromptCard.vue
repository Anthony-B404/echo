<script setup lang="ts">
import type { Prompt } from '~/types/prompt'

const props = defineProps<{
  prompt: Prompt;
  selected?: boolean;
  showCategory?: boolean;
}>()

const emit = defineEmits<{
  select: [prompt: Prompt];
  edit: [prompt: Prompt];
  delete: [prompt: Prompt];
  toggleFavorite: [prompt: Prompt];
}>()

const { t } = useI18n()

const promptsStore = usePromptsStore()

const actionItems = computed(() => [
  [{
    label: t('common.buttons.edit'),
    icon: 'i-lucide-pencil',
    onSelect: () => emit('edit', props.prompt)
  }],
  [{
    label: t('common.buttons.delete'),
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => emit('delete', props.prompt)
  }]
])

const category = computed(() => {
  if (!props.prompt.categoryId) { return null }
  return promptsStore.getCategory(props.prompt.categoryId)
})

function handleSelect () {
  emit('select', props.prompt)
}

function handleEdit (e: Event) {
  e.stopPropagation()
  emit('edit', props.prompt)
}

function handleDelete (e: Event) {
  e.stopPropagation()
  emit('delete', props.prompt)
}

function handleToggleFavorite (e: Event) {
  e.stopPropagation()
  emit('toggleFavorite', props.prompt)
}

function getContentPreview (content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) { return content }
  return content.substring(0, maxLength).trim() + '...'
}
</script>

<template>
  <div
    class="group flex min-h-48 cursor-pointer flex-col rounded-lg border border-gray-200 bg-white/50 p-4 backdrop-blur-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-slate-900/50 dark:hover:border-gray-500 dark:hover:bg-slate-800/70"
    :class="{ 'ring-primary-500 ring-2': selected }"
    @click="handleSelect"
  >
    <!-- Header -->
    <div class="mb-2 flex items-start justify-between">
      <div class="flex-1 pr-2">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ prompt.title }}
        </h3>
        <!-- Category - always reserve space -->
        <div class="mt-1 flex min-h-[1rem] items-center gap-1">
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
        size="sm"
        :class="
          prompt.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : ''
        "
        @click="handleToggleFavorite"
      />
    </div>

    <!-- Content preview -->
    <p
      class="mb-3 line-clamp-3 flex-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300"
    >
      {{ getContentPreview(prompt.content, 120) }}
    </p>

    <!-- Footer - always visible -->
    <div class="flex min-h-[1.5rem] items-center justify-between">
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <span v-if="prompt.usageCount > 0" class="flex items-center gap-1">
          <UIcon name="i-lucide-bar-chart-2" class="h-3.5 w-3.5" />
          {{ prompt.usageCount }}
        </span>
        <span
          v-if="prompt.isDefault"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700"
        >
          {{ t("pages.dashboard.prompts.system") }}
        </span>
        <span
          v-else
          class="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded px-1.5 py-0.5 text-xs"
        >
          {{ t("pages.dashboard.prompts.custom") }}
        </span>
      </div>

      <!-- Actions menu -->
      <UDropdownMenu :items="actionItems">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          @click.stop
        />
      </UDropdownMenu>
    </div>
  </div>
</template>

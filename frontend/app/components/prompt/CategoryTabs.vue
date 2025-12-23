<script setup lang="ts">
import type { PromptCategory } from '~/types/prompt'

const props = defineProps<{
  categories: PromptCategory[]
  selectedCategoryId: number | null
  showFavorites?: boolean
}>()

const emit = defineEmits<{
  'update:selectedCategoryId': [id: number | null]
  selectFavorites: []
}>()

const { t } = useI18n()

function selectCategory(categoryId: number | null) {
  emit('update:selectedCategoryId', categoryId)
}

function selectFavorites() {
  emit('selectFavorites')
}

function isSelected(categoryId: number | null) {
  return !props.showFavorites && props.selectedCategoryId === categoryId
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- All prompts tab -->
    <UButton
      :variant="isSelected(null) ? 'solid' : 'ghost'"
      :color="isSelected(null) ? 'primary' : 'neutral'"
      size="sm"
      @click="selectCategory(null)"
    >
      {{ t('pages.dashboard.prompts.all') }}
    </UButton>

    <!-- Favorites tab -->
    <UButton
      icon="i-lucide-star"
      :variant="showFavorites ? 'solid' : 'ghost'"
      :color="showFavorites ? 'warning' : 'neutral'"
      size="sm"
      @click="selectFavorites"
    >
      {{ t('pages.dashboard.prompts.favorites') }}
    </UButton>

    <UDivider orientation="vertical" class="h-6" />

    <!-- Category tabs -->
    <UButton
      v-for="category in categories"
      :key="category.id"
      :variant="isSelected(category.id) ? 'soft' : 'ghost'"
      :color="isSelected(category.id) ? 'primary' : 'neutral'"
      size="sm"
      @click="selectCategory(category.id)"
    >
      <template #leading>
        <span
          class="inline-flex h-2 w-2 rounded-full"
          :style="{ backgroundColor: category.color || '#6B7280' }"
        />
      </template>
      {{ category.name }}
      <template v-if="category.promptsCount !== undefined" #trailing>
        <span class="text-xs opacity-60">({{ category.promptsCount }})</span>
      </template>
    </UButton>
  </div>
</template>

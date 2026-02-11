<script setup lang="ts">
import type { PromptCategory, CreateCategoryPayload, UpdateCategoryPayload } from '~/types/prompt'

defineProps<{
  open: boolean
  categories: PromptCategory[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [payload: CreateCategoryPayload]
  update: [id: number, payload: UpdateCategoryPayload]
  delete: [id: number]
}>()

const { t } = useI18n()

const editingCategory = ref<PromptCategory | null>(null)
const isCreating = ref(false)

const form = reactive({
  name: '',
  description: '',
  color: '#3B82F6'
})

const errors = reactive({
  name: ''
})

const colorOptions = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6' // teal
]

function resetForm () {
  form.name = ''
  form.description = ''
  form.color = '#3B82F6'
  errors.name = ''
  editingCategory.value = null
  isCreating.value = false
}

function startCreate () {
  resetForm()
  isCreating.value = true
}

function startEdit (category: PromptCategory) {
  form.name = category.name
  form.description = category.description || ''
  form.color = category.color || '#3B82F6'
  editingCategory.value = category
  isCreating.value = false
}

function cancelEdit () {
  resetForm()
}

function validate (): boolean {
  errors.name = ''

  if (!form.name.trim()) {
    errors.name = t('pages.dashboard.prompts.errors.categoryNameRequired')
    return false
  }

  if (form.name.length > 100) {
    errors.name = t('pages.dashboard.prompts.errors.categoryNameTooLong')
    return false
  }

  return true
}

function handleSave () {
  if (!validate()) { return }

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color
  }

  if (editingCategory.value) {
    emit('update', editingCategory.value.id, payload)
  } else {
    emit('create', payload)
  }

  resetForm()
}

function handleDelete (category: PromptCategory) {
  if (category.promptsCount && category.promptsCount > 0) {
    // Show error toast - category has prompts
    return
  }
  emit('delete', category.id)
}

function handleClose () {
  resetForm()
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="handleClose"
  >
    <template #header>
      <h3 class="text-lg font-semibold">
        {{ t('pages.dashboard.prompts.manageCategories') }}
      </h3>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Category list -->
        <div class="max-h-64 space-y-2 overflow-y-auto">
          <div
            v-for="category in categories"
            :key="category.id"
            class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          >
            <div class="flex items-center gap-3">
              <span
                class="inline-flex h-4 w-4 rounded-full"
                :style="{ backgroundColor: category.color || '#6B7280' }"
              />
              <div>
                <span class="font-medium">{{ category.name }}</span>
                <span v-if="category.promptsCount !== undefined" class="ml-2 text-xs text-gray-500">
                  ({{ category.promptsCount }} {{ t('pages.dashboard.prompts.promptsCount') }})
                </span>
              </div>
            </div>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="startEdit(category)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :disabled="(category.promptsCount ?? 0) > 0"
                @click="handleDelete(category)"
              />
            </div>
          </div>

          <div
            v-if="categories.length === 0"
            class="py-8 text-center text-gray-500"
          >
            {{ t('pages.dashboard.prompts.noCategories') }}
          </div>
        </div>

        <USeparator />

        <!-- Create/Edit form -->
        <div v-if="isCreating || editingCategory" class="space-y-3">
          <h4 class="text-sm font-medium">
            {{ editingCategory ? t('pages.dashboard.prompts.editCategory') : t('pages.dashboard.prompts.addCategory') }}
          </h4>

          <UFormField
            :label="t('pages.dashboard.prompts.form.categoryName')"
            :error="errors.name"
            required
          >
            <UInput
              v-model="form.name"
              :placeholder="t('pages.dashboard.prompts.form.categoryNamePlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('pages.dashboard.prompts.form.description')">
            <UInput
              v-model="form.description"
              :placeholder="t('pages.dashboard.prompts.form.descriptionPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('pages.dashboard.prompts.form.color')">
            <div class="flex gap-2">
              <button
                v-for="color in colorOptions"
                :key="color"
                type="button"
                class="h-6 w-6 rounded-full transition-transform hover:scale-110"
                :class="{ 'ring-2 ring-offset-2 ring-primary-500': form.color === color }"
                :style="{ backgroundColor: color }"
                @click="form.color = color"
              />
            </div>
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="cancelEdit"
            >
              {{ t('common.buttons.cancel') }}
            </UButton>
            <UButton
              color="primary"
              size="sm"
              @click="handleSave"
            >
              {{ editingCategory ? t('common.buttons.save') : t('common.buttons.create') }}
            </UButton>
          </div>
        </div>

        <!-- Add category button -->
        <UButton
          v-else
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          block
          @click="startCreate"
        >
          {{ t('pages.dashboard.prompts.addCategory') }}
        </UButton>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          @click="handleClose"
        >
          {{ t('common.buttons.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

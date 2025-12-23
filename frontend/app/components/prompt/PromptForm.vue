<script setup lang="ts">
import { z } from 'zod'
import type { Prompt, PromptCategory, CreatePromptPayload, UpdatePromptPayload } from '~/types/prompt'

const props = defineProps<{
  open: boolean
  prompt?: Prompt | null
  categories: PromptCategory[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: CreatePromptPayload | UpdatePromptPayload]
}>()

const { t } = useI18n()

const isEditing = computed(() => !!props.prompt)

// Zod schema
const schema = computed(() => z.object({
  title: z.string()
    .min(1, t('pages.dashboard.prompts.errors.titleRequired'))
    .max(255, t('pages.dashboard.prompts.errors.titleTooLong')),
  content: z.string()
    .min(5, t('pages.dashboard.prompts.errors.contentTooShort'))
    .max(5000, t('pages.dashboard.prompts.errors.contentTooLong')),
  categoryId: z.number().nullable(),
  isFavorite: z.boolean(),
}))

const form = reactive({
  title: '',
  content: '',
  categoryId: null as number | null,
  isFavorite: false,
})

const loading = ref(false)
const errors = reactive({
  title: '',
  content: '',
})

// Reset form when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    if (props.prompt) {
      form.title = props.prompt.title
      form.content = props.prompt.content
      form.categoryId = props.prompt.categoryId
      form.isFavorite = props.prompt.isFavorite
    } else {
      form.title = ''
      form.content = ''
      form.categoryId = null
      form.isFavorite = false
    }
    errors.title = ''
    errors.content = ''
  }
})

const categoryOptions = computed(() => [
  { label: t('pages.dashboard.prompts.form.noCategory'), value: null },
  ...props.categories.map((c) => ({
    label: c.name,
    value: c.id,
  })),
])

function validate(): boolean {
  errors.title = ''
  errors.content = ''

  const result = schema.value.safeParse({
    title: form.title.trim(),
    content: form.content.trim(),
    categoryId: form.categoryId,
    isFavorite: form.isFavorite,
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof typeof errors
      if (field in errors) {
        errors[field] = issue.message
      }
    }
    return false
  }

  return true
}

async function handleSubmit() {
  if (!validate()) return

  loading.value = true

  try {
    const payload: CreatePromptPayload | UpdatePromptPayload = {
      title: form.title.trim(),
      content: form.content.trim(),
      categoryId: form.categoryId,
      isFavorite: form.isFavorite,
    }

    emit('save', payload)
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="handleClose"
  >
    <template #header>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ isEditing ? t('pages.dashboard.prompts.editPrompt') : t('pages.dashboard.prompts.addPrompt') }}
      </h3>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Title -->
        <UFormField
          :error="errors.title || undefined"
        >
          <template #label>
            <span>{{ t('pages.dashboard.prompts.form.title') }} <span class="text-gray-400">*</span></span>
          </template>
          <UInput
            v-model="form.title"
            :placeholder="t('pages.dashboard.prompts.form.titlePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <!-- Category -->
        <UFormField :label="t('pages.dashboard.prompts.form.category')">
          <USelect
            v-model="form.categoryId"
            :items="categoryOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <!-- Content -->
        <UFormField
          :error="errors.content || undefined"
        >
          <template #label>
            <span>{{ t('pages.dashboard.prompts.form.content') }} <span class="text-gray-400">*</span></span>
          </template>
          <UTextarea
            v-model="form.content"
            :placeholder="t('pages.dashboard.prompts.form.contentPlaceholder')"
            :rows="6"
            autoresize
            class="w-full"
          />
        </UFormField>

        <!-- Favorite toggle -->
        <UFormField>
          <UCheckbox
            v-model="form.isFavorite"
            :label="t('pages.dashboard.prompts.form.addToFavorites')"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          @click="handleClose"
        >
          {{ t('common.buttons.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ isEditing ? t('common.buttons.save') : t('common.buttons.create') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

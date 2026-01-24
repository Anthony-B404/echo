<script setup lang="ts">
import type { TranscriptionVersionField, EditConflict } from '~/types/transcription'
import type { EditorToolbarItem } from '@nuxt/ui'
import { marked } from 'marked'
import TurndownService from 'turndown'

const { t: tToolbar } = useI18n()

// Toolbar configuration
const toolbarItems: EditorToolbarItem[][] = [
  // Headings dropdown
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.headings') },
      content: { align: 'start' },
      items: [
        {
          kind: 'heading',
          level: 1,
          icon: 'i-lucide-heading-1',
          label: tToolbar('components.workshop.editor.toolbar.heading1'),
        },
        {
          kind: 'heading',
          level: 2,
          icon: 'i-lucide-heading-2',
          label: tToolbar('components.workshop.editor.toolbar.heading2'),
        },
        {
          kind: 'heading',
          level: 3,
          icon: 'i-lucide-heading-3',
          label: tToolbar('components.workshop.editor.toolbar.heading3'),
        },
      ],
    },
  ],
  // Text formatting
  [
    {
      kind: 'mark',
      mark: 'bold',
      icon: 'i-lucide-bold',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.bold') },
    },
    {
      kind: 'mark',
      mark: 'italic',
      icon: 'i-lucide-italic',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.italic') },
    },
    {
      kind: 'mark',
      mark: 'underline',
      icon: 'i-lucide-underline',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.underline') },
    },
    {
      kind: 'mark',
      mark: 'strike',
      icon: 'i-lucide-strikethrough',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.strikethrough') },
    },
  ],
  // Lists
  [
    {
      kind: 'bulletList',
      icon: 'i-lucide-list',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.bulletList') },
    },
    {
      kind: 'orderedList',
      icon: 'i-lucide-list-ordered',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.orderedList') },
    },
  ],
  // Block elements
  [
    {
      kind: 'blockquote',
      icon: 'i-lucide-text-quote',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.blockquote') },
    },
    {
      kind: 'codeBlock',
      icon: 'i-lucide-square-code',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.codeBlock') },
    },
  ],
  // History
  [
    {
      kind: 'undo',
      icon: 'i-lucide-undo',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.undo') },
    },
    {
      kind: 'redo',
      icon: 'i-lucide-redo',
      tooltip: { text: tToolbar('components.workshop.editor.toolbar.redo') },
    },
  ],
]

const props = defineProps<{
  content: string
  field: TranscriptionVersionField
  version: number
  loading?: boolean
  conflict?: EditConflict | null
}>()

const emit = defineEmits<{
  save: [content: string, changeSummary?: string]
  cancel: []
  refresh: []
  dismissConflict: []
}>()

const { t } = useI18n()

// Initialize turndown service for HTML → Markdown conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

// Convert initial Markdown content to HTML for the editor
const htmlContent = ref('')
const changeSummary = ref('')
const showChangeSummary = ref(false)

// Store original Markdown to compare changes
const originalMarkdown = ref(props.content)

// Convert Markdown to HTML when props change
watch(
  () => props.content,
  async (newContent) => {
    originalMarkdown.value = newContent
    htmlContent.value = await marked.parse(newContent)
  },
  { immediate: true }
)

// Track if content has been modified by comparing converted Markdown
const hasChanges = computed(() => {
  const currentMarkdown = turndown.turndown(htmlContent.value)
  return currentMarkdown !== originalMarkdown.value
})

function handleSave() {
  if (!hasChanges.value || props.loading) return
  // Convert HTML back to Markdown for storage
  const markdownContent = turndown.turndown(htmlContent.value)
  emit('save', markdownContent, changeSummary.value || undefined)
}

function handleCancel() {
  // Reset to original HTML content
  marked.parse(props.content).then((html) => {
    htmlContent.value = html
  })
  changeSummary.value = ''
  showChangeSummary.value = false
  emit('cancel')
}

function handleKeydown(event: KeyboardEvent) {
  // Escape to cancel
  if (event.key === 'Escape') {
    handleCancel()
  }
}

// Listen for keyboard events on the document
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Conflict Alert -->
    <WorkshopConflictAlert
      v-if="conflict"
      :conflict="conflict"
      @refresh="emit('refresh')"
      @dismiss="emit('dismissConflict')"
    />

    <!-- WYSIWYG Editor with Toolbar and Drag Handle -->
    <div class="border border-default rounded-lg overflow-hidden">
      <UEditor
        v-slot="{ editor }"
        v-model="htmlContent"
        :disabled="loading"
        :placeholder="t('components.workshop.editor.placeholder')"
        class="min-h-[300px]"
      >
        <!-- Fixed Toolbar with formatting options -->
        <UEditorToolbar
          :editor="editor"
          :items="toolbarItems"
          layout="fixed"
          class="border-b border-default px-2 py-1"
        />

        <!-- Drag Handle for block reordering -->
        <UEditorDragHandle :editor="editor" />
      </UEditor>
    </div>

    <!-- Change summary (optional) -->
    <div v-if="showChangeSummary" class="space-y-2">
      <UInput
        v-model="changeSummary"
        :placeholder="t('components.workshop.editor.changeSummaryPlaceholder')"
        :disabled="loading"
        maxlength="255"
      />
      <p class="text-xs text-muted">
        {{ t('components.workshop.editor.changeSummaryHint') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between">
      <UButton
        v-if="!showChangeSummary"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-message-square"
        :label="t('components.workshop.editor.addChangeSummary')"
        @click="showChangeSummary = true"
      />
      <div v-else />

      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">
          {{ t('components.workshop.editor.saveHintEditor') }}
        </span>
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.buttons.cancel')"
          :disabled="loading"
          @click="handleCancel"
        />
        <UButton
          color="primary"
          :label="t('common.buttons.save')"
          :loading="loading"
          :disabled="!hasChanges"
          @click="handleSave"
        />
      </div>
    </div>
  </div>
</template>

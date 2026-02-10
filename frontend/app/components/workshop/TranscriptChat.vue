<script setup lang="ts">
const props = defineProps<{
  audioId: number
}>()

const { t } = useI18n()
const { renderMarkdown } = useMarkdown()

const audioIdRef = computed(() => props.audioId)
const { messages, status, sendMessage, clearChat } = useTranscriptChat(audioIdRef)

const input = ref('')

const hasMessages = computed(() => messages.value.length > 0)

function handleSubmit() {
  if (!input.value.trim()) return
  sendMessage(input.value)
  input.value = ''
}

function handleSuggestion(text: string) {
  sendMessage(text)
}

function getMessageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}
</script>

<template>
  <div class="flex flex-col" style="height: 60vh; min-height: 300px; max-height: 700px;">
    <!-- Empty state -->
    <div
      v-if="!hasMessages"
      class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4"
    >
      <UIcon name="i-lucide-message-circle-question" class="w-12 h-12 text-muted" />
      <p class="text-sm text-muted max-w-md">
        {{ t('pages.dashboard.workshop.detail.chat.emptyState') }}
      </p>

      <!-- Suggestion buttons -->
      <div class="flex flex-wrap gap-2 justify-center">
        <UButton
          variant="soft"
          color="neutral"
          size="sm"
          :label="t('pages.dashboard.workshop.detail.chat.suggestions.summary')"
          @click="handleSuggestion(t('pages.dashboard.workshop.detail.chat.suggestions.summary'))"
        />
        <UButton
          variant="soft"
          color="neutral"
          size="sm"
          :label="t('pages.dashboard.workshop.detail.chat.suggestions.keyPoints')"
          @click="handleSuggestion(t('pages.dashboard.workshop.detail.chat.suggestions.keyPoints'))"
        />
        <UButton
          variant="soft"
          color="neutral"
          size="sm"
          :label="t('pages.dashboard.workshop.detail.chat.suggestions.participants')"
          @click="handleSuggestion(t('pages.dashboard.workshop.detail.chat.suggestions.participants'))"
        />
      </div>
    </div>

    <!-- Messages (scrollable wrapper for UChatMessages) -->
    <div v-if="hasMessages" class="flex-1 min-h-0 overflow-y-auto">
      <UChatMessages
        :messages="messages"
        :status="status"
        :should-auto-scroll="true"
        :user="{ variant: 'soft', side: 'right' }"
        :assistant="{ icon: 'i-lucide-bot', variant: 'naked', side: 'left' }"
      >
        <template #content="{ role, parts }">
          <!-- User messages: plain text -->
          <template v-if="role === 'user'">
            {{ getMessageText(parts) }}
          </template>
          <!-- Assistant messages: rendered markdown -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-else
            class="markdown-content text-sm"
            v-html="renderMarkdown(getMessageText(parts))"
          />
        </template>
      </UChatMessages>
    </div>

    <!-- Error alert -->
    <UAlert
      v-if="status === 'error'"
      color="error"
      variant="subtle"
      :title="t('pages.dashboard.workshop.detail.chat.error')"
      icon="i-lucide-alert-circle"
      class="mx-2 mb-2"
    />

    <!-- Input area -->
    <div class="shrink-0 border-t border-default p-3">
      <div v-if="hasMessages" class="flex justify-end mb-2">
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-trash-2"
          :label="t('pages.dashboard.workshop.detail.chat.clear')"
          @click="clearChat"
        />
      </div>

      <div class="relative">
        <UChatPrompt
          v-model="input"
          :placeholder="t('pages.dashboard.workshop.detail.chat.placeholder')"
          :disabled="status === 'submitted'"
          autoresize
          :rows="1"
          :maxrows="4"
          :ui="{ root: 'pr-12' }"
          @submit="handleSubmit"
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2">
          <UChatPromptSubmit :status="status" />
        </div>
      </div>
    </div>
  </div>
</template>

import type { UIMessage } from 'ai'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useTranscriptChat(audioId: Ref<number>) {
  const { authenticatedFetch } = useAuth()

  const messages = ref<UIMessage[]>([])
  const status = ref<'ready' | 'submitted' | 'error'>('ready')
  let messageCounter = 0

  function createId() {
    return `msg-${++messageCounter}`
  }

  /**
   * Convert UIMessage[] to the flat ChatMessage[] format expected by the API
   */
  function toApiMessages(msgs: UIMessage[]): ChatMessage[] {
    return msgs
      .filter((m): m is UIMessage & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant'
      )
      .map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join(''),
      }))
  }

  async function sendMessage(text: string) {
    if (!text.trim() || status.value === 'submitted') return

    // Add user message
    const userMessage: UIMessage = {
      id: createId(),
      role: 'user',
      parts: [{ type: 'text', text: text.trim() }],
    }
    messages.value = [...messages.value, userMessage]

    status.value = 'submitted'

    try {
      const apiMessages = toApiMessages(messages.value)

      const response = await authenticatedFetch(`/audios/${audioId.value}/chat`, {
        method: 'POST',
        body: { messages: apiMessages },
      }) as { reply: string }

      // Add assistant message
      const assistantMessage: UIMessage = {
        id: createId(),
        role: 'assistant',
        parts: [{ type: 'text', text: response.reply }],
      }
      messages.value = [...messages.value, assistantMessage]

      status.value = 'ready'
    } catch {
      status.value = 'error'
    }
  }

  function clearChat() {
    messages.value = []
    status.value = 'ready'
    messageCounter = 0
  }

  return {
    messages,
    status: computed(() => status.value),
    sendMessage,
    clearChat,
  }
}

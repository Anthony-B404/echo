import env from '#start/env'
import type { ServerResponse } from 'node:http'

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice:stream'

export default class TtsService {
  private apiKey: string

  constructor() {
    this.apiKey = env.get('INWORLD_API_KEY')
  }

  /**
   * Strip markdown formatting from text, keeping only plain text.
   */
  stripMarkdown(text: string): string {
    return (
      text
        // Remove code blocks (```...```)
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code (`...`)
        .replace(/`([^`]+)`/g, '$1')
        // Remove images ![alt](url)
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Remove links [text](url) → keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove headers (# ## ### etc.)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold **text** or __text__
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        // Remove italic *text* or _text_
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Remove strikethrough ~~text~~
        .replace(/~~(.*?)~~/g, '$1')
        // Remove blockquotes (> ...)
        .replace(/^>\s+/gm, '')
        // Remove unordered list markers (- * +)
        .replace(/^[\s]*[-*+]\s+/gm, '')
        // Remove ordered list markers (1. 2. etc.)
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Remove horizontal rules (--- *** ___)
        .replace(/^[-*_]{3,}$/gm, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Collapse multiple newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    )
  }

  /**
   * Split text into chunks that fit within the Inworld character limit.
   * Splits on sentence boundaries to preserve natural speech flow.
   */
  splitIntoChunks(text: string, maxChars = 1900): string[] {
    if (text.length <= maxChars) {
      return [text]
    }

    const chunks: string[] = []
    // Split on sentence-ending punctuation followed by whitespace
    const sentences = text.split(/(?<=[.!?])\s+/)
    let current = ''

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence

      if (candidate.length > maxChars) {
        if (current) {
          chunks.push(current)
        }
        // If a single sentence exceeds maxChars, split on word boundaries
        if (sentence.length > maxChars) {
          const words = sentence.split(/\s+/)
          let wordChunk = ''
          for (const word of words) {
            const wordCandidate = wordChunk ? `${wordChunk} ${word}` : word
            if (wordCandidate.length > maxChars) {
              if (wordChunk) chunks.push(wordChunk)
              wordChunk = word
            } else {
              wordChunk = wordCandidate
            }
          }
          if (wordChunk) current = wordChunk
          else current = ''
        } else {
          current = sentence
        }
      } else {
        current = candidate
      }
    }

    if (current) {
      chunks.push(current)
    }

    return chunks
  }

  /**
   * Stream a single text chunk from Inworld directly to the HTTP response.
   * Reads the Inworld streaming JSON response line by line and writes decoded audio bytes.
   */
  private async streamChunkToResponse(
    text: string,
    res: ServerResponse,
    voiceId: string
  ): Promise<void> {
    const response = await fetch(INWORLD_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        audio_config: {
          audio_encoding: 'MP3',
          speaking_rate: 1.25,
        },
        temperature: 1.15,
        model_id: 'inworld-tts-1.5-max',
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error')
      throw new Error(`Inworld TTS API error (${response.status}): ${errorBody}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop()! // Keep incomplete last line

      for (const line of lines) {
        this.writeAudioLine(line, res)
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      this.writeAudioLine(buffer, res)
    }
  }

  /**
   * Parse a JSON line and write decoded audio bytes to the response.
   */
  private writeAudioLine(line: string, res: ServerResponse): void {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const parsed = JSON.parse(trimmed)
      const audioData = parsed.result?.audioContent || parsed.audioContent || parsed.audio
      if (audioData) {
        res.write(Buffer.from(audioData, 'base64'))
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  /**
   * Stream TTS audio directly to the HTTP response.
   * Processes text chunks sequentially so audio plays in order,
   * but each chunk's audio bytes are piped as they arrive from Inworld.
   */
  async streamSpeech(
    analysisText: string,
    res: ServerResponse,
    voiceId = 'Alain'
  ): Promise<void> {
    const plainText = this.stripMarkdown(analysisText)
    const chunks = this.splitIntoChunks(plainText)

    for (const chunk of chunks) {
      await this.streamChunkToResponse(chunk, res, voiceId)
    }
  }
}

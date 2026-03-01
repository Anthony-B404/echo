import { Mistral, HTTPClient } from '@mistralai/mistralai'
import { Agent } from 'undici'
import env from '#start/env'
import { readFile } from 'node:fs/promises'
import type { TranscriptionTimestamp } from '#models/transcription'

/**
 * Custom HTTP client with extended headersTimeout for large audio transcriptions.
 * Node.js fetch (undici) defaults to 5min headersTimeout — too short for long audio files
 * where Mistral may take 10-30min to process before sending response headers.
 */
const longTimeoutAgent = new Agent({
  headersTimeout: 60 * 60 * 1000, // 60 minutes
  bodyTimeout: 60 * 60 * 1000,
})

const transcriptionHttpClient = new HTTPClient({
  fetcher: (input, init) => {
    // Use global fetch (Node.js undici) with custom dispatcher for extended timeouts
    return globalThis.fetch(input, { ...init, dispatcher: longTimeoutAgent } as any)
  },
})

/**
 * Chat message for multi-turn conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Chat result with token usage for credit calculation
 */
export interface ChatResult {
  reply: string
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Result of audio transcription with timestamps
 */
export interface TranscriptionResult {
  text: string
  segments: TranscriptionTimestamp[]
  language: string | null
}

export default class MistralService {
  private client: Mistral

  constructor() {
    this.client = new Mistral({
      apiKey: env.get('MISTRAL_API_KEY'),
      httpClient: transcriptionHttpClient,
      timeoutMs: 10 * 60 * 1000, // 10 minutes default (overridden per-call for transcription)
    })
  }

  /**
   * Transcribe audio file using Voxtral model with timestamps and speaker diarization.
   * Uses Mistral's upload → signed URL → transcribe flow for reliable large file handling.
   * Timeout scales with audio duration to handle server-side processing time.
   */
  async transcribe(
    filePath: string,
    fileName: string,
    audioDurationSeconds?: number,
    mimeType: string = 'audio/mp4'
  ): Promise<TranscriptionResult> {
    const MIN_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
    const timeoutMs = audioDurationSeconds
      ? Math.max(MIN_TIMEOUT_MS, Math.round(audioDurationSeconds * 1.5) * 1000)
      : MIN_TIMEOUT_MS

    // Sanitize filename to avoid encoding issues with emojis/special chars
    const sanitizedName = fileName.replace(/[^\w\s.()-]/g, '_').replace(/__+/g, '_')

    // Step 1: Upload file to Mistral cloud
    console.log(
      `[Transcription] Mistral upload: file=${fileName}, duration=${audioDurationSeconds ?? 'unknown'}s`
    )

    const fileBuffer = await readFile(filePath)
    const blob = new Blob([fileBuffer], { type: mimeType })
    const file = new File([blob], sanitizedName)

    const uploaded = await this.client.files.upload(
      { file, purpose: 'audio' as any },
      { timeoutMs: 30 * 60 * 1000 } // 30 min for upload
    )

    let fileUrl: string
    try {
      // Step 2: Get signed URL
      const signed = await this.client.files.getSignedUrl({
        fileId: uploaded.id,
        expiry: 24,
      })
      fileUrl = signed.url

      console.log(
        `[Transcription] Mistral transcribe via signed URL: fileId=${uploaded.id}, timeout=${Math.round(timeoutMs / 1000)}s`
      )

      // Step 3: Transcribe via signed URL (no multipart upload needed)
      const result = await this.client.audio.transcriptions.complete(
        {
          model: 'voxtral-mini-latest',
          fileUrl,
          timestampGranularities: ['segment'],
          diarize: true,
        },
        { timeoutMs }
      )

      const segments: TranscriptionTimestamp[] = (result.segments || []).map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        speaker: seg.speakerId || undefined,
      }))

      return {
        text: result.text || '',
        segments,
        language: result.language || null,
      }
    } finally {
      // Step 4: Cleanup uploaded file from Mistral cloud
      this.client.files.delete({ fileId: uploaded.id }).catch(() => {})
    }
  }

  /**
   * Analyze transcription with user prompt using Mistral Large.
   * When diarized segments are provided, also identifies speaker names.
   */
  async analyze(
    transcription: string,
    prompt: string,
    segments: TranscriptionTimestamp[] = []
  ): Promise<{ analysis: string; speakers: Record<string, string> }> {
    const hasSpeakers = segments.some((seg) => seg.speaker)

    const speakerIds = hasSpeakers
      ? [...new Set(segments.filter((s) => s.speaker).map((s) => s.speaker!))]
      : []

    const speakerInstruction = hasSpeakers
      ? `\nLa transcription contient des identifiants de locuteurs : ${speakerIds.join(', ')}.
Si tu peux identifier les vrais prénoms ou noms des locuteurs à partir du contenu de la conversation (présentations, interpellations par le nom, etc.), inclus un mapping dans le champ "speakers".
N'inclus un locuteur QUE si tu as trouvé son vrai nom. N'invente jamais de nom.`
      : ''

    const systemPrompt = `Tu es un assistant expert en analyse de conversations audio.
L'utilisateur va te fournir une transcription d'un fichier audio et un prompt décrivant ce qu'il souhaite obtenir.
Réponds toujours en français de manière claire et structurée.${speakerInstruction}

Tu DOIS répondre en JSON valide avec cette structure exacte:
{
  "analysis": "ton analyse complète ici",
  "speakers": {"speaker_0": "Jean", "speaker_1": "Marie"}
}
IMPORTANT: Le champ "analysis" doit contenir du texte formaté lisible (markdown avec titres, listes, paragraphes), PAS du JSON ou des données structurées. Écris l'analyse exactement comme si tu répondais en texte libre.
Le champ "speakers" peut être un objet vide {} si aucun nom n'est identifiable.`

    let diarizedTranscription = transcription
    if (hasSpeakers) {
      diarizedTranscription = segments
        .map((seg) => (seg.speaker ? `[${seg.speaker}] ${seg.text.trim()}` : seg.text.trim()))
        .join('\n')
    }

    const userMessage = `Voici la transcription de l'audio:

"""
${diarizedTranscription}
"""

Voici ce que l'utilisateur souhaite:
${prompt}`

    const response = await this.client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 16384,
    })

    const content = response.choices?.[0]?.message?.content
    const raw = typeof content === 'string' ? content : ''

    try {
      const parsed = JSON.parse(raw) as { analysis?: string; speakers?: Record<string, string> }
      return {
        analysis: parsed.analysis || raw,
        speakers: parsed.speakers && typeof parsed.speakers === 'object' ? parsed.speakers : {},
      }
    } catch {
      // JSON truncated or invalid — try to extract fields from partial JSON
      return {
        analysis: this.extractFieldFromPartialJson(raw, 'analysis'),
        speakers: this.extractSpeakersFromPartialJson(raw),
      }
    }
  }

  /**
   * Identify speaker names from a diarized transcription.
   * Lightweight call using mistral-small — used when no analysis prompt is provided.
   */
  async identifySpeakers(
    segments: TranscriptionTimestamp[]
  ): Promise<Record<string, string>> {
    const hasSpeakers = segments.some((seg) => seg.speaker)
    if (!hasSpeakers) return {}

    // Collect all unique speaker IDs to list them explicitly in the prompt
    const speakerIds = [...new Set(segments.filter((s) => s.speaker).map((s) => s.speaker!))]

    const diarizedTranscription = segments
      .map((seg) => (seg.speaker ? `[${seg.speaker}] ${seg.text.trim()}` : seg.text.trim()))
      .join('\n')

    const systemPrompt = `Tu es un assistant expert en identification de locuteurs dans des transcriptions audio.
À partir de la transcription diarisée ci-dessous, identifie les vrais prénoms ou noms des locuteurs si possible (présentations, interpellations par le nom, etc.).

Les identifiants de locuteurs présents sont : ${speakerIds.join(', ')}

Tu DOIS répondre en JSON valide avec cette structure:
{"speakers": {"identifiant_du_locuteur": "Vrai nom ou prénom"}}

Exemple: si la transcription contient "[speaker_0] Salut Marc" et "[speaker_1] Salut Julie", tu réponds:
{"speakers": {"speaker_0": "Julie", "speaker_1": "Marc"}}

IMPORTANT:
- N'inclus un locuteur dans le mapping QUE si tu as trouvé son vrai nom dans la conversation.
- Si tu ne peux identifier aucun nom, réponds {"speakers": {}}.
- N'invente JAMAIS de nom. Utilise uniquement les noms mentionnés dans la conversation.`

    const response = await this.client.chat.complete({
      model: 'mistral-small-2506',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: diarizedTranscription },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 1024,
    })

    const content = response.choices?.[0]?.message?.content
    const raw = typeof content === 'string' ? content : ''

    try {
      const parsed = JSON.parse(raw) as { speakers?: Record<string, string> }
      return parsed.speakers && typeof parsed.speakers === 'object' ? parsed.speakers : {}
    } catch {
      return this.extractSpeakersFromPartialJson(raw)
    }
  }

  /**
   * Chat with the transcription content. Supports multi-turn conversation.
   * Unlike analyze(), this returns free-text responses (no JSON format).
   */
  async chat(
    transcription: string,
    messages: ChatMessage[],
    segments: TranscriptionTimestamp[] = []
  ): Promise<ChatResult> {
    const hasSpeakers = segments.some((seg) => seg.speaker)

    let diarizedTranscription = transcription
    if (hasSpeakers) {
      diarizedTranscription = segments
        .map((seg) => (seg.speaker ? `[${seg.speaker}] ${seg.text.trim()}` : seg.text.trim()))
        .join('\n')
    }

    const systemPrompt = `Tu es un assistant expert en analyse de conversations audio.
L'utilisateur a une transcription d'un fichier audio et va te poser des questions à son sujet.
Réponds de manière claire, précise et structurée en te basant uniquement sur le contenu de la transcription ci-dessous.
Si la réponse ne se trouve pas dans la transcription, dis-le clairement.
Réponds dans la langue de l'utilisateur.

Voici la transcription complète :

"""
${diarizedTranscription}
"""`

    const response = await this.client.chat.complete({
      model: 'mistral-small-2506',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      maxTokens: 4096,
    })

    const content = response.choices?.[0]?.message?.content
    const reply = typeof content === 'string' ? content : ''

    return {
      reply,
      usage: {
        promptTokens: response.usage?.promptTokens ?? 0,
        completionTokens: response.usage?.completionTokens ?? 0,
      },
    }
  }

  /**
   * Reformulate analysis text for natural oral reading (TTS).
   * Transforms lists, formatting, and structure into fluid spoken prose.
   */
  async reformulateForSpeech(analysisText: string): Promise<ChatResult> {
    const systemPrompt = `Tu es un convertisseur texte-vers-oral. Ta SEULE tâche est de réécrire le texte d'entrée pour qu'il sonne naturellement à l'oral.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le texte reformulé, rien d'autre
- JAMAIS de préambule ("Voici le texte reformulé", "Bien sûr", etc.)
- JAMAIS de commentaire ou d'explication
- Transforme les listes à puces en phrases enchaînées
- Supprime tout formatage markdown
- Utilise des transitions naturelles entre les idées
- Garde toutes les informations importantes
- Le résultat doit être du texte brut, prêt à être lu à voix haute
- Réponds dans la même langue que le texte d'entrée`

    const response = await this.client.chat.complete({
      model: 'mistral-small-2506',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: analysisText },
      ],
      maxTokens: 8192,
    })

    const content = response.choices?.[0]?.message?.content
    const reply = typeof content === 'string' ? content : ''

    return {
      reply,
      usage: {
        promptTokens: response.usage?.promptTokens ?? 0,
        completionTokens: response.usage?.completionTokens ?? 0,
      },
    }
  }

  /**
   * Extract a string field value from truncated JSON.
   * Handles cases where Mistral response was cut off mid-JSON.
   */
  private extractFieldFromPartialJson(raw: string, field: string): string {
    const marker = `"${field}"`
    const fieldIndex = raw.indexOf(marker)
    if (fieldIndex === -1) return raw

    // Find the opening quote of the value
    const colonIndex = raw.indexOf(':', fieldIndex + marker.length)
    if (colonIndex === -1) return raw

    const afterColon = raw.substring(colonIndex + 1).trimStart()
    if (!afterColon.startsWith('"')) return raw

    // Extract the string value, handling escaped quotes
    const valueStart = colonIndex + 1 + (raw.substring(colonIndex + 1).indexOf('"')) + 1
    let value = ''
    let i = valueStart
    while (i < raw.length) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        // Handle escape sequences
        const next = raw[i + 1]
        if (next === 'n') value += '\n'
        else if (next === 't') value += '\t'
        else if (next === '"') value += '"'
        else if (next === '\\') value += '\\'
        else value += next
        i += 2
      } else if (raw[i] === '"') {
        // End of string value
        break
      } else {
        value += raw[i]
        i++
      }
    }

    return value || raw
  }

  /**
   * Try to extract speakers mapping from truncated JSON.
   */
  private extractSpeakersFromPartialJson(raw: string): Record<string, string> {
    const speakersMatch = raw.match(/"speakers"\s*:\s*(\{[^}]*\})/)
    if (!speakersMatch) return {}

    try {
      return JSON.parse(speakersMatch[1]) as Record<string, string>
    } catch {
      return {}
    }
  }
}

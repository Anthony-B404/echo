import { Mistral } from '@mistralai/mistralai'
import env from '#start/env'
import { readFile } from 'node:fs/promises'
import type { TranscriptionTimestamp } from '#models/transcription'

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
      timeoutMs: 10 * 60 * 1000, // 10 minutes for large audio uploads
    })
  }

  /**
   * Transcribe audio file using Voxtral model with timestamps and speaker diarization.
   * Timeout scales with audio duration to handle large files (upload + server processing).
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

    console.log(
      `[Transcription] Mistral transcribe: file=${fileName}, duration=${audioDurationSeconds ?? 'unknown'}s, timeout=${Math.round(timeoutMs / 1000)}s`
    )

    const fileBuffer = await readFile(filePath)
    const blob = new Blob([fileBuffer], { type: mimeType })
    const file = new File([blob], fileName)

    const result = await this.client.audio.transcriptions.complete(
      {
        model: 'voxtral-mini-latest',
        file: file,
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

    const speakerInstruction = hasSpeakers
      ? `\nLa transcription contient des identifiants de locuteurs (Speaker 1, Speaker 2, etc.).
Si tu peux identifier les vrais noms des locuteurs à partir du contenu de la conversation (présentations, interpellations par le nom, etc.), inclus un mapping dans le champ "speakers".
Si tu ne peux pas identifier un locuteur, ne l'inclus pas dans le mapping.`
      : ''

    const systemPrompt = `Tu es un assistant expert en analyse de conversations audio.
L'utilisateur va te fournir une transcription d'un fichier audio et un prompt décrivant ce qu'il souhaite obtenir.
Réponds toujours en français de manière claire et structurée.${speakerInstruction}

Tu DOIS répondre en JSON valide avec cette structure exacte:
{
  "analysis": "ton analyse complète ici en texte lisible avec des retours à la ligne, du markdown, etc.",
  "speakers": {"Speaker 1": "Prénom identifié", "Speaker 2": "Prénom identifié"}
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

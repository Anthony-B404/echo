import { Mistral } from '@mistralai/mistralai'
import env from '#start/env'
import { readFile } from 'node:fs/promises'
import type { TranscriptionTimestamp } from '#models/transcription'

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
    })
  }

  /**
   * Transcribe audio file using Voxtral model with timestamps
   */
  async transcribe(filePath: string, fileName: string): Promise<TranscriptionResult> {
    const fileBuffer = await readFile(filePath)
    const blob = new Blob([fileBuffer], { type: 'audio/mpeg' })
    const file = new File([blob], fileName)

    const result = await this.client.audio.transcriptions.complete({
      model: 'voxtral-mini-latest',
      file: file,
      timestampGranularities: ['segment'],
    })

    // Map Mistral segments to our TranscriptionTimestamp format
    const segments: TranscriptionTimestamp[] = (result.segments || []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }))

    return {
      text: result.text || '',
      segments,
      language: result.language || null,
    }
  }

  /**
   * Analyze transcription with user prompt using Mistral Large
   */
  async analyze(transcription: string, prompt: string): Promise<string> {
    const systemPrompt = `Tu es un assistant expert en analyse de conversations audio. 
L'utilisateur va te fournir une transcription d'un fichier audio et un prompt décrivant ce qu'il souhaite obtenir.
Réponds toujours en français de manière claire et structurée.`

    const userMessage = `Voici la transcription de l'audio:

"""
${transcription}
"""

Voici ce que l'utilisateur souhaite:
${prompt}`

    const response = await this.client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const content = response.choices?.[0]?.message?.content
    return typeof content === 'string' ? content : ''
  }
}

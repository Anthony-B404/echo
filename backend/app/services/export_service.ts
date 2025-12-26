import type Audio from '#models/audio'
import type { I18n } from '@adonisjs/i18n'
import type { ExportFormat, ExportContent } from '#validators/audio'
import pdfGeneratorService from './pdf_generator_service.js'
import docxGeneratorService from './docx_generator_service.js'

export interface ExportOptions {
  audio: Audio
  format: ExportFormat
  content: ExportContent
  i18n: I18n
}

export interface ExportResult {
  buffer: Buffer
  mimeType: string
  filename: string
  extension: string
}

/**
 * Service for orchestrating document exports from audio transcriptions.
 * Supports PDF, DOCX, TXT, and Markdown formats.
 */
class ExportService {
  /**
   * MIME type mapping for export formats
   */
  private readonly mimeTypes: Record<ExportFormat, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
  }

  /**
   * File extension mapping for export formats
   */
  private readonly extensions: Record<ExportFormat, string> = {
    pdf: 'pdf',
    docx: 'docx',
    txt: 'txt',
    md: 'md',
  }

  /**
   * Generate an export file from audio transcription data
   */
  async generate(options: ExportOptions): Promise<ExportResult> {
    const { audio, format, content, i18n } = options

    // Validate content availability
    this.validateContent(audio, content, i18n)

    // Generate buffer based on format
    let buffer: Buffer

    switch (format) {
      case 'pdf':
        buffer = await pdfGeneratorService.generate({ audio, content, i18n })
        break
      case 'docx':
        buffer = await docxGeneratorService.generate({ audio, content, i18n })
        break
      case 'txt':
        buffer = this.generateTxt(audio, content, i18n)
        break
      case 'md':
        buffer = this.generateMarkdown(audio, content, i18n)
        break
      default:
        throw new Error(i18n.t('messages.export.invalid_format'))
    }

    // Generate filename
    const filename = this.generateFilename(audio, content, format)

    return {
      buffer,
      mimeType: this.mimeTypes[format],
      filename,
      extension: this.extensions[format],
    }
  }

  /**
   * Validate that requested content is available
   */
  private validateContent(audio: Audio, content: ExportContent, i18n: I18n): void {
    const hasTranscription = !!audio.transcription?.rawText
    const hasAnalysis = !!audio.transcription?.analysis

    if (content === 'transcription' && !hasTranscription) {
      throw new Error(i18n.t('messages.export.no_transcription'))
    }

    if (content === 'analysis' && !hasAnalysis) {
      throw new Error(i18n.t('messages.export.no_analysis'))
    }

    if (content === 'both' && !hasTranscription && !hasAnalysis) {
      throw new Error(i18n.t('messages.export.no_content'))
    }
  }

  /**
   * Generate filename for export
   */
  private generateFilename(
    audio: Audio,
    content: ExportContent,
    format: ExportFormat
  ): string {
    // Use title if available, otherwise use original filename without extension
    const baseName = audio.title || audio.fileName.replace(/\.[^/.]+$/, '')

    // Sanitize filename
    const sanitized = baseName
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100)

    // Add content suffix if not 'both'
    const suffix = content === 'both' ? '' : `-${content}`

    return `${sanitized}${suffix}.${this.extensions[format]}`
  }

  /**
   * Generate plain text export
   */
  private generateTxt(audio: Audio, content: ExportContent, i18n: I18n): Buffer {
    const lines: string[] = []

    // Title
    const title = audio.title || audio.fileName
    lines.push(title)
    lines.push('='.repeat(title.length))
    lines.push('')

    // Export date
    const exportDate = new Date().toLocaleDateString(i18n.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    lines.push(`${i18n.t('messages.export.metadata.exported_on')}: ${exportDate}`)
    lines.push('')

    // Metadata
    lines.push(`${i18n.t('messages.export.metadata.filename')}: ${audio.fileName}`)

    if (audio.duration) {
      const minutes = Math.floor(audio.duration / 60)
      const seconds = Math.round(audio.duration % 60)
      lines.push(
        `${i18n.t('messages.export.metadata.duration')}: ${minutes}:${seconds.toString().padStart(2, '0')}`
      )
    }

    if (audio.transcription?.language) {
      lines.push(
        `${i18n.t('messages.export.metadata.language')}: ${audio.transcription.language.toUpperCase()}`
      )
    }

    if (audio.transcription?.confidence) {
      lines.push(
        `${i18n.t('messages.export.metadata.confidence')}: ${(audio.transcription.confidence * 100).toFixed(0)}%`
      )
    }

    lines.push('')
    lines.push('-'.repeat(50))
    lines.push('')

    // Transcription
    if ((content === 'transcription' || content === 'both') && audio.transcription?.rawText) {
      lines.push(i18n.t('messages.export.transcription_section').toUpperCase())
      lines.push('')
      lines.push(audio.transcription.rawText)
      lines.push('')
    }

    // Analysis
    if ((content === 'analysis' || content === 'both') && audio.transcription?.analysis) {
      if (content === 'both') {
        lines.push('-'.repeat(50))
        lines.push('')
      }
      lines.push(i18n.t('messages.export.analysis_section').toUpperCase())
      lines.push('')
      // Strip markdown for plain text
      lines.push(this.stripMarkdown(audio.transcription.analysis))
      lines.push('')
    }

    return Buffer.from(lines.join('\n'), 'utf-8')
  }

  /**
   * Generate Markdown export
   */
  private generateMarkdown(audio: Audio, content: ExportContent, i18n: I18n): Buffer {
    const lines: string[] = []

    // Title
    const title = audio.title || audio.fileName
    lines.push(`# ${title}`)
    lines.push('')

    // Export date
    const exportDate = new Date().toLocaleDateString(i18n.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    lines.push(`*${i18n.t('messages.export.metadata.exported_on')}: ${exportDate}*`)
    lines.push('')

    // Metadata
    lines.push('| | |')
    lines.push('|---|---|')
    lines.push(`| **${i18n.t('messages.export.metadata.filename')}** | ${audio.fileName} |`)

    if (audio.duration) {
      const minutes = Math.floor(audio.duration / 60)
      const seconds = Math.round(audio.duration % 60)
      lines.push(
        `| **${i18n.t('messages.export.metadata.duration')}** | ${minutes}:${seconds.toString().padStart(2, '0')} |`
      )
    }

    if (audio.transcription?.language) {
      lines.push(
        `| **${i18n.t('messages.export.metadata.language')}** | ${audio.transcription.language.toUpperCase()} |`
      )
    }

    if (audio.transcription?.confidence) {
      lines.push(
        `| **${i18n.t('messages.export.metadata.confidence')}** | ${(audio.transcription.confidence * 100).toFixed(0)}% |`
      )
    }

    lines.push('')
    lines.push('---')
    lines.push('')

    // Transcription
    if ((content === 'transcription' || content === 'both') && audio.transcription?.rawText) {
      lines.push(`## ${i18n.t('messages.export.transcription_section')}`)
      lines.push('')
      lines.push(audio.transcription.rawText)
      lines.push('')
    }

    // Analysis
    if ((content === 'analysis' || content === 'both') && audio.transcription?.analysis) {
      lines.push(`## ${i18n.t('messages.export.analysis_section')}`)
      lines.push('')
      // Keep markdown formatting for MD export
      lines.push(audio.transcription.analysis)
      lines.push('')
    }

    return Buffer.from(lines.join('\n'), 'utf-8')
  }

  /**
   * Strip markdown formatting from text
   */
  private stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^[\*\-]\s+/gm, '- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
}

export default new ExportService()

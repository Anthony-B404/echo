import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
  Packer,
} from 'docx'
import type Audio from '#models/audio'
import type { I18n } from '@adonisjs/i18n'

export interface DocxGenerateOptions {
  audio: Audio
  content: 'transcription' | 'analysis' | 'both'
  i18n: I18n
}

/**
 * Service for generating DOCX (Word) documents from audio transcriptions.
 * Creates professional Word documents with proper styling and structure.
 */
class DocxGeneratorService {
  /**
   * Generate a DOCX buffer from audio transcription data
   */
  async generate(options: DocxGenerateOptions): Promise<Buffer> {
    const { audio, content, i18n } = options

    const sections: Paragraph[] = []

    // Title
    sections.push(this.createTitle(audio))

    // Export date
    sections.push(this.createExportDate(i18n))

    // Metadata table
    sections.push(...this.createMetadataTable(audio, i18n))

    // Separator
    sections.push(new Paragraph({ spacing: { after: 400 } }))

    // Transcription section
    if (content === 'transcription' || content === 'both') {
      sections.push(...this.createTranscriptionSection(audio, i18n))
    }

    // Analysis section
    if (content === 'analysis' || content === 'both') {
      sections.push(...this.createAnalysisSection(audio, i18n))
    }

    const doc = new Document({
      creator: 'Alexia',
      title: audio.title || audio.fileName,
      description: i18n.t('messages.export.document_title'),
      sections: [
        {
          properties: {},
          children: sections,
        },
      ],
    })

    return Packer.toBuffer(doc)
  }

  /**
   * Create document title
   */
  private createTitle(audio: Audio): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: audio.title || audio.fileName,
          bold: true,
          size: 48,
        }),
      ],
    })
  }

  /**
   * Create export date paragraph
   */
  private createExportDate(i18n: I18n): Paragraph {
    const exportDate = new Date().toLocaleDateString(i18n.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${i18n.t('messages.export.metadata.exported_on')}: ${exportDate}`,
          size: 20,
          color: '666666',
        }),
      ],
    })
  }

  /**
   * Create metadata table with audio information
   */
  private createMetadataTable(audio: Audio, i18n: I18n): Paragraph[] {
    const rows: TableRow[] = []

    // Source file
    rows.push(this.createMetadataRow(i18n.t('messages.export.metadata.filename'), audio.fileName))

    // Duration
    if (audio.duration) {
      const minutes = Math.floor(audio.duration / 60)
      const seconds = Math.round(audio.duration % 60)
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
      rows.push(this.createMetadataRow(i18n.t('messages.export.metadata.duration'), durationStr))
    }

    // Language
    if (audio.transcription?.language) {
      rows.push(
        this.createMetadataRow(
          i18n.t('messages.export.metadata.language'),
          audio.transcription.language.toUpperCase()
        )
      )
    }

    // Confidence
    if (audio.transcription?.confidence) {
      const confidencePercent = `${(audio.transcription.confidence * 100).toFixed(0)}%`
      rows.push(
        this.createMetadataRow(i18n.t('messages.export.metadata.confidence'), confidencePercent)
      )
    }

    if (rows.length === 0) {
      return []
    }

    const table = new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
    })

    return [
      new Paragraph({ spacing: { before: 200, after: 200 } }),
      new Paragraph({
        children: [],
      }),
    ].concat([table] as unknown as Paragraph[])
  }

  /**
   * Create a metadata table row
   */
  private createMetadataRow(label: string, value: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 20,
                  color: '666666',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value,
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  }

  /**
   * Create transcription section
   */
  private createTranscriptionSection(audio: Audio, i18n: I18n): Paragraph[] {
    if (!audio.transcription?.rawText) return []

    const paragraphs: Paragraph[] = []

    // Section header
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({
            text: i18n.t('messages.export.transcription_section'),
            bold: true,
            size: 28,
          }),
        ],
      })
    )

    // Split content into paragraphs
    const textParagraphs = audio.transcription.rawText.split(/\n\n+/)
    for (const text of textParagraphs) {
      if (text.trim()) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: text.trim(),
                size: 22,
              }),
            ],
          })
        )
      }
    }

    return paragraphs
  }

  /**
   * Create analysis section
   */
  private createAnalysisSection(audio: Audio, i18n: I18n): Paragraph[] {
    if (!audio.transcription?.analysis) return []

    const paragraphs: Paragraph[] = []

    // Section header
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({
            text: i18n.t('messages.export.analysis_section'),
            bold: true,
            size: 28,
          }),
        ],
      })
    )

    // Parse and convert markdown to paragraphs
    const contentParagraphs = this.parseMarkdownToDocx(audio.transcription.analysis)
    paragraphs.push(...contentParagraphs)

    return paragraphs
  }

  /**
   * Parse markdown content and convert to DOCX paragraphs
   */
  private parseMarkdownToDocx(markdown: string): Paragraph[] {
    const paragraphs: Paragraph[] = []
    const lines = markdown.split('\n')

    let currentText = ''

    for (const line of lines) {
      // Heading detection
      const h2Match = line.match(/^##\s+(.+)$/)
      const h3Match = line.match(/^###\s+(.+)$/)

      if (h2Match) {
        // Flush current text
        if (currentText.trim()) {
          paragraphs.push(this.createTextParagraph(currentText))
          currentText = ''
        }
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [
              new TextRun({
                text: h2Match[1],
                bold: true,
                size: 24,
              }),
            ],
          })
        )
      } else if (h3Match) {
        if (currentText.trim()) {
          paragraphs.push(this.createTextParagraph(currentText))
          currentText = ''
        }
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: h3Match[1],
                bold: true,
                size: 22,
              }),
            ],
          })
        )
      } else if (line.match(/^[\*\-]\s+/)) {
        // Bullet point
        if (currentText.trim()) {
          paragraphs.push(this.createTextParagraph(currentText))
          currentText = ''
        }
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: line.replace(/^[\*\-]\s+/, ''),
                size: 22,
              }),
            ],
          })
        )
      } else if (line.trim() === '') {
        // Empty line - end paragraph
        if (currentText.trim()) {
          paragraphs.push(this.createTextParagraph(currentText))
          currentText = ''
        }
      } else {
        // Regular text
        currentText += (currentText ? ' ' : '') + line
      }
    }

    // Flush remaining text
    if (currentText.trim()) {
      paragraphs.push(this.createTextParagraph(currentText))
    }

    return paragraphs
  }

  /**
   * Create a text paragraph with basic formatting
   */
  private createTextParagraph(text: string): Paragraph {
    // Process bold and italic
    const runs: TextRun[] = []
    let remaining = text

    // Simple regex-based markdown processing
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_)/g
    let lastIndex = 0
    let match

    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        runs.push(
          new TextRun({
            text: text.substring(lastIndex, match.index),
            size: 22,
          })
        )
      }

      // Add formatted text
      const isBold = match[2] || match[4]
      const isItalic = match[3] || match[5]
      const content = isBold || isItalic

      runs.push(
        new TextRun({
          text: content,
          size: 22,
          bold: !!isBold,
          italics: !!isItalic,
        })
      )

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      runs.push(
        new TextRun({
          text: text.substring(lastIndex),
          size: 22,
        })
      )
    }

    // If no formatting was found, just use the whole text
    if (runs.length === 0) {
      runs.push(
        new TextRun({
          text: remaining,
          size: 22,
        })
      )
    }

    return new Paragraph({
      spacing: { after: 200 },
      children: runs,
    })
  }
}

export default new DocxGeneratorService()

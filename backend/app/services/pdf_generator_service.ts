import PDFDocument from 'pdfkit'
import type Audio from '#models/audio'
import type { I18n } from '@adonisjs/i18n'

export interface PdfGenerateOptions {
  audio: Audio
  content: 'transcription' | 'analysis' | 'both'
  i18n: I18n
}

/**
 * Service for generating PDF documents from audio transcriptions.
 * Creates professional-looking PDFs with metadata, transcription, and analysis sections.
 */
class PdfGeneratorService {
  /**
   * Generate a PDF buffer from audio transcription data
   */
  async generate(options: PdfGenerateOptions): Promise<Buffer> {
    const { audio, content, i18n } = options

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: audio.title || audio.fileName,
          Author: 'Alexia',
          Subject: i18n.t('messages.export.document_title'),
          CreationDate: new Date(),
        },
      })

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Generate PDF content
      this.generateHeader(doc, audio, i18n)
      this.generateMetadata(doc, audio, i18n)

      if (content === 'analysis' || content === 'both') {
        this.generateAnalysisSection(doc, audio, i18n)
      }

      if (content === 'transcription' || content === 'both') {
        this.generateTranscriptionSection(doc, audio, i18n)
      }

      // Add page numbers and flush all buffered pages
      this.addPageNumbers(doc)
      doc.flushPages()

      doc.end()
    })
  }

  /**
   * Generate the document header with title and export date
   */
  private generateHeader(doc: PDFKit.PDFDocument, audio: Audio, i18n: I18n): void {
    const title = audio.title || audio.fileName

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' })

    doc.moveDown(0.5)

    // Export date
    const exportDate = new Date().toLocaleDateString(i18n.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`${i18n.t('messages.export.metadata.exported_on')}: ${exportDate}`, { align: 'center' })

    doc.fillColor('#000000')
    doc.moveDown(1.5)
  }

  /**
   * Generate metadata section with audio information
   */
  private generateMetadata(doc: PDFKit.PDFDocument, audio: Audio, i18n: I18n): void {
    doc.fontSize(10).font('Helvetica').fillColor('#666666')

    const metadata: string[] = []

    // Source file
    metadata.push(`${i18n.t('messages.export.metadata.filename')}: ${audio.fileName}`)

    // Duration
    if (audio.duration) {
      const minutes = Math.floor(audio.duration / 60)
      const seconds = Math.round(audio.duration % 60)
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
      metadata.push(`${i18n.t('messages.export.metadata.duration')}: ${durationStr}`)
    }

    // Language
    if (audio.transcription?.language) {
      metadata.push(
        `${i18n.t('messages.export.metadata.language')}: ${audio.transcription.language.toUpperCase()}`
      )
    }

    // Confidence
    if (audio.transcription?.confidence) {
      const confidencePercent = (audio.transcription.confidence * 100).toFixed(0)
      metadata.push(`${i18n.t('messages.export.metadata.confidence')}: ${confidencePercent}%`)
    }

    doc.text(metadata.join('  |  '), { align: 'center' })

    // Separator line
    doc.moveDown(1)
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke()

    doc.fillColor('#000000')
    doc.moveDown(1.5)
  }

  /**
   * Generate transcription section
   */
  private generateTranscriptionSection(doc: PDFKit.PDFDocument, audio: Audio, i18n: I18n): void {
    if (!audio.transcription?.rawText) return

    // Section header
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(i18n.t('messages.export.transcription_section'), { underline: false })

    doc.moveDown(0.5)

    // Transcription content
    doc.fontSize(11).font('Helvetica').text(audio.transcription.rawText, {
      align: 'justify',
      lineGap: 4,
    })

    doc.moveDown(1.5)
  }

  /**
   * Generate analysis section
   */
  private generateAnalysisSection(doc: PDFKit.PDFDocument, audio: Audio, i18n: I18n): void {
    if (!audio.transcription?.analysis) return

    // Section header
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(i18n.t('messages.export.analysis_section'), { underline: false })

    doc.moveDown(0.5)

    // Analysis content (may contain markdown, render as plain text for now)
    const analysisText = this.stripMarkdown(audio.transcription.analysis)

    doc.fontSize(11).font('Helvetica').text(analysisText, {
      align: 'justify',
      lineGap: 4,
    })

    doc.moveDown(1.5)
  }

  /**
   * Add page numbers to all pages
   */
  private addPageNumbers(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange()
    const lastPage = pages.start + pages.count - 1

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i)

      // Use low-level text positioning to avoid triggering page breaks
      const pageNumText = `${i + 1} / ${pages.count}`

      doc.save()
      doc.fontSize(9).font('Helvetica').fillColor('#999999')

      const textWidth = doc.widthOfString(pageNumText)
      const xPos = (doc.page.width - textWidth) / 2
      const yPos = doc.page.height - 35

      doc.text(pageNumText, xPos, yPos, {
        lineBreak: false,
        continued: false,
      })
      doc.restore()
    }

    // Switch back to last page to prevent phantom pages
    doc.switchToPage(lastPage)
  }

  /**
   * Strip markdown formatting from text for plain text rendering
   */
  private stripMarkdown(text: string): string {
    return (
      text
        // Remove headers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Remove links
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`(.+?)`/g, '$1')
        // Remove bullet points
        .replace(/^[\*\-]\s+/gm, '- ')
        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    )
  }
}

export default new PdfGeneratorService()

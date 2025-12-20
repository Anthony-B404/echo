import { marked } from 'marked'

export function useMarkdown() {
  // Configure marked pour le rendu
  marked.setOptions({
    breaks: true, // Convertir les sauts de ligne en <br>
    gfm: true, // GitHub Flavored Markdown
  })

  function renderMarkdown(content: string): string {
    if (!content) return ''
    return marked.parse(content) as string
  }

  return {
    renderMarkdown,
  }
}

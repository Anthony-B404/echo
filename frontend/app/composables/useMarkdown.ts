import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function useMarkdown () {
  // Configure marked pour le rendu
  marked.setOptions({
    breaks: false, // Laisser le markdown standard gérer les paragraphes via \n\n
    gfm: true // GitHub Flavored Markdown
  })

  function renderMarkdown (content: string): string {
    if (!content) { return '' }
    // Supprimer les backslashes d'échappement devant les caractères markdown
    // (Mistral en mode json_object peut sérialiser **texte** en \*\*texte\*\*)
    let cleaned = content.replace(/\\([*#_\-\[\]()>~`!|])/g, '$1')
    // Convertir les loose lists en tight lists : supprimer les lignes vides
    // entre items de liste pour éviter que marked encapsule le contenu dans <p>
    cleaned = cleaned.replace(/^([ \t]*[-*+] .+)\n\n(?=[ \t]*[-*+] )/gm, '$1\n')
    cleaned = cleaned.replace(/^([ \t]*\d+\. .+)\n\n(?=[ \t]*\d+\. )/gm, '$1\n')
    const rawHtml = marked.parse(cleaned) as string
    return DOMPurify.sanitize(rawHtml)
  }

  return {
    renderMarkdown
  }
}

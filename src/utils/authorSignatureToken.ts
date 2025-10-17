import { generateAuthorSignatureHTML } from './authorSignatureHTML';
import { Author } from '@/hooks/useAuthors';

export const AUTHOR_SIGNATURE_TOKEN = '[[ASSINATURA_AUTOR]]';

export function renderAuthorSignaturePlaceholders(html: string, author?: Author): string {
  if (!author) return html;
  return html.replace(/\[\[ASSINATURA_AUTOR\]\]/gi, generateAuthorSignatureHTML(author));
}

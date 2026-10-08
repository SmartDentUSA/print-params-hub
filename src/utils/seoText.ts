/** Normalize catalog fields that may arrive as arrays or comma-separated text. */
export function seoTerms(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]/) : [];
  return [...new Set(values.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

/** Extract editorial text; scripts and styles are not part of an article. */
export function articleText(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script, style, template, noscript, [hidden], [aria-hidden="true"], .eeat-hidden-layer').forEach(node => node.remove());
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, br, tr').forEach(node => node.append(' '));
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

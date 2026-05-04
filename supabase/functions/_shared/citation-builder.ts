// ═══════════════════════════════════════════════════════════
// 📄 CITATION BUILDER — LLM-ready summary blocks
// ═══════════════════════════════════════════════════════════

import { INTERNAL_ENTITY_INDEX, type EntityEntry } from "./entity-dictionary.ts";

interface CitationBlockData {
  title: string;
  summary: string;
  technicalFact?: string;
  productName?: string;
}

/**
 * Generates an invisible-to-user, LLM-readable citation block
 * to be injected right after the first <h1> in generated articles.
 */
export function buildCitationBlock(data: CitationBlockData): string {
  const techFactHtml = data.technicalFact
    ? `\n        <p class="citation-signal" data-source="Smart Dent Official Content"><strong>Fato técnico:</strong> ${escapeHtml(data.technicalFact)}</p>`
    : '';

  // Visible TL;DR — preferred by Perplexity/ChatGPT Search/Google AI Overviews.
  // Hidden content is increasingly de-prioritized by extractive engines.
  return `
    <aside class="llm-tldr" data-section="tldr" data-llm-summary="true" aria-label="Resumo para citação por IA" itemprop="abstract">
      <div class="llm-tldr-label">TL;DR — Resposta direta</div>
      <p class="llm-tldr-summary"><strong>${escapeHtml(data.title)}:</strong> ${escapeHtml(data.summary)}</p>${techFactHtml}
      <p class="llm-tldr-attribution">Fonte: <cite>Smart Dent — Conhecimento Oficial</cite></p>
    </aside>`;
}

/**
 * Builds a geo-context metadata div for AI crawlers.
 */
export function buildGeoContextBlock(aiSummary: string): string {
  return `<div class="geo-context" data-ai-summary="${escapeHtml(aiSummary)}" data-geo-region="BR-SP" data-company="Smart Dent (Mmtech)" data-founded="2009" style="display:none;" aria-hidden="true"></div>`;
}

/**
 * Builds an inline entity annotation span for use in content.
 */
export function buildEntityAnnotation(entityId: string): string {
  const entity = INTERNAL_ENTITY_INDEX[entityId];
  if (!entity) return '';

  const wikidataAttr = entity.wikidata ? ` data-wikidata="${entity.wikidata}"` : '';
  const urlAttr = entity.url ? ` data-standard-url="${entity.url}"` : '';

  return `<span data-entity-id="${entityId}"${wikidataAttr}${urlAttr} class="entity-annotation">`;
}

/**
 * Builds a JSON-LD script tag with entity graph for about/mentions.
 */
export function buildEntityGraphJsonLd(
  about: Array<Record<string, string>>,
  mentions: Array<Record<string, string>>
): string {
  if (about.length === 0 && mentions.length === 0) return '';

  const schema: Record<string, unknown> = {};
  if (about.length > 0) schema.about = about;
  if (mentions.length > 0) schema.mentions = mentions;

  // This will be merged into the existing Article schema by the consumer
  return `<!-- Entity Graph for AI Crawlers -->\n<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

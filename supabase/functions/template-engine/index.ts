import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildSeoHead, SeoHeadOptions } from '../_shared/seo-fine-tuning.ts';
import {
  PersonSchema,
  ENTITY_KNOWLEDGE_GRAPH,
  resolveEntities,
  buildSameAsFromTopics,
  getPrimaryEntityReferenceUrl,
  lookupEntity,
} from '../_shared/authority-data-helper.ts';
import { MASTER_AUTHORITY_ADDENDUM } from '../_shared/master-system-prompt.ts';

// ─── Types ──────────────────────────────────────────────────

export interface TemplateInput {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  contentHtml: string;
  author?: PersonSchema;
  topics?: string[];
  keywords?: string[];
  ogImage?: string;
  locale?: string;
  /** Executive summary for GEO/embedding optimisation (2 paragraphs) */
  aiSummary?: string;
  /** Additional JSON-LD objects to inject */
  extraJsonLd?: Record<string, unknown>[];
}

export interface EEATScore {
  score: number; // 0–10
  breakdown: {
    hasCredential: number;
    entityLinking: number;
    structuredData: number;
    contentDepth: number;
    authorPresence: number;
  };
  warnings: string[];
}

export interface AIReadinessScore {
  score: number; // 0–10
  breakdown: {
    aiContentPolicy: number;
    entityLinking: number;
    geoContextBlock: number;
    aiSummary: number;
    robotsAgents: number;
  };
  warnings: string[];
}

export interface TemplateOutput {
  html: string;
  eeAtScore: EEATScore;
  aiReadinessScore: AIReadinessScore;
  resolvedEntities: ReturnType<typeof resolveEntities>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─── Scoring Functions ──────────────────────────────────────

/**
 * scoreEEAT
 *
 * Scores the E-E-A-T quality of the page from 0 to 10.
 * Maximum score (10/10) REQUIRES:
 *  1. hasCredential populated with medical authority data (recognizedBy + url)
 *  2. External entity linking via Wikidata (sameAs)
 *  3. Full structured data (Person + Article/Product + FAQ)
 */
export function scoreEEAT(input: TemplateInput): EEATScore {
  const warnings: string[] = [];
  const breakdown = {
    hasCredential: 0,
    entityLinking: 0,
    structuredData: 0,
    contentDepth: 0,
    authorPresence: 0,
  };

  // 1. hasCredential (max 3 pts) — REQUIRED for score > 6
  if (input.author) {
    breakdown.authorPresence = 1;
    const creds = input.author.hasCredential ?? [];
    if (creds.length === 0) {
      warnings.push('hasCredential está vazio. Nota E-E-A-T limitada a 6/10.');
    } else {
      const hasRecognizedBy = creds.every(
        (c) => c.recognizedBy && c.recognizedBy.url && c.recognizedBy.name
      );
      if (!hasRecognizedBy) {
        warnings.push(
          'Algum hasCredential não possui recognizedBy com URL do conselho profissional.'
        );
        breakdown.hasCredential = 1;
      } else {
        breakdown.hasCredential = 3;
      }
    }
  } else {
    warnings.push('Nenhum autor definido. Autoridade E-E-A-T reduzida.');
  }

  // 2. Entity linking via Wikidata (max 3 pts)
  const topics = input.topics ?? [];
  const resolved = resolveEntities(topics);
  if (resolved.length === 0) {
    warnings.push(
      'Nenhuma entidade Wikidata resolvida a partir dos tópicos. Entity linking ausente.'
    );
  } else if (resolved.length === 1) {
    breakdown.entityLinking = 1;
    warnings.push('Apenas 1 entidade Wikidata. Considere adicionar mais tópicos.');
  } else if (resolved.length === 2) {
    breakdown.entityLinking = 2;
  } else {
    breakdown.entityLinking = 3;
  }

  // 3. Structured data depth (max 2 pts)
  const contentLower = input.contentHtml.toLowerCase();
  const hasJsonLd = contentLower.includes('application/ld+json') ||
    (input.extraJsonLd && input.extraJsonLd.length > 0);
  const hasFaq = contentLower.includes('faqpage') || contentLower.includes('<dl') ||
    contentLower.includes('class="faq');
  if (hasJsonLd) breakdown.structuredData += 1;
  if (hasFaq) breakdown.structuredData += 1;

  // 4. Content depth (max 1 pt)
  const wordCount = input.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).length;
  if (wordCount >= 500) {
    breakdown.contentDepth = 1;
  } else {
    warnings.push(`Conteúdo curto (${wordCount} palavras). Recomendado mínimo de 500.`);
  }

  // Enforce hard cap: without hasCredential the score cannot exceed 6
  const rawScore =
    breakdown.hasCredential +
    breakdown.entityLinking +
    breakdown.structuredData +
    breakdown.contentDepth +
    breakdown.authorPresence;

  let score = Math.min(10, rawScore);

  if (breakdown.hasCredential === 0 && score > 6) {
    score = 6;
    warnings.push('Score E-E-A-T limitado a 6/10: hasCredential com dados de autoridade médica é obrigatório para nota máxima.');
  }

  if (breakdown.entityLinking === 0 && score > 6) {
    score = 6;
    warnings.push('Score E-E-A-T limitado a 6/10: entity linking com Wikidata é obrigatório para nota máxima.');
  }

  return { score, breakdown, warnings };
}

/**
 * scoreAIReadiness
 *
 * Scores AI-Readiness (GEO) from 0 to 10.
 * Maximum score (10/10) REQUIRES:
 *  1. hasCredential present (medical authority)
 *  2. External entity linking via Wikidata
 *  3. AI content policy meta tag
 *  4. GEO context block with data-ai-summary
 *  5. Explicit AI agent robots tags
 */
export function scoreAIReadiness(
  input: TemplateInput,
  renderedHead: string
): AIReadinessScore {
  const warnings: string[] = [];
  const breakdown = {
    aiContentPolicy: 0,
    entityLinking: 0,
    geoContextBlock: 0,
    aiSummary: 0,
    robotsAgents: 0,
  };

  // 1. AI content policy meta (max 2 pts)
  if (renderedHead.includes('ai-content-policy')) {
    breakdown.aiContentPolicy = 2;
  } else {
    warnings.push('Meta tag ai-content-policy ausente no <head>.');
  }

  // 2. Entity linking (max 2 pts) — same as E-E-A-T
  const topics = input.topics ?? [];
  const resolved = resolveEntities(topics);
  if (resolved.length >= 2) {
    breakdown.entityLinking = 2;
  } else if (resolved.length === 1) {
    breakdown.entityLinking = 1;
    warnings.push('Apenas 1 entidade Wikidata. Recomendado mínimo de 2 para AI-Readiness máximo.');
  } else {
    warnings.push('Nenhuma entidade Wikidata. Entity linking é essencial para GEO.');
  }

  // 3. GEO context block (max 2 pts)
  if (input.contentHtml.includes('data-geo-context')) {
    breakdown.geoContextBlock = 1;
    if (input.contentHtml.includes('data-ai-summary')) {
      breakdown.geoContextBlock = 2;
    } else {
      warnings.push('data-geo-context presente mas data-ai-summary ausente.');
    }
  } else {
    warnings.push('Bloco data-geo-context ausente. Adicione para melhorar indexação por IA.');
  }

  // 4. AI summary quality (max 2 pts)
  if (input.aiSummary) {
    const wordCount = input.aiSummary.split(/\s+/).length;
    if (wordCount >= 100 && wordCount <= 200) {
      breakdown.aiSummary = 2;
    } else if (wordCount >= 50) {
      breakdown.aiSummary = 1;
      warnings.push(`AI summary tem ${wordCount} palavras. Recomendado entre 100 e 200.`);
    } else {
      warnings.push('AI summary muito curto para otimização de embeddings.');
    }
  } else {
    warnings.push('aiSummary não fornecido. Essencial para dense retrieval por IA.');
  }

  // 5. Robots agent tags (max 2 pts)
  const hasGptBot = renderedHead.includes('GPTBot');
  const hasCCBot = renderedHead.includes('CCBot');
  if (hasGptBot && hasCCBot) {
    breakdown.robotsAgents = 2;
  } else if (hasGptBot || hasCCBot) {
    breakdown.robotsAgents = 1;
    warnings.push('Inclua tanto GPTBot como CCBot nos robots meta para cobertura máxima.');
  } else {
    warnings.push('Nenhum agente de IA explícito nos robots meta (GPTBot, CCBot).');
  }

  // Hard cap: without hasCredential + entity linking, score cannot reach 10
  const creds = input.author?.hasCredential ?? [];
  const hasValidCredential = creds.length > 0 && creds.every((c) => c.recognizedBy?.url);

  const rawScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  let score = Math.min(10, rawScore);

  if (!hasValidCredential && score > 8) {
    score = 8;
    warnings.push('Score AI-Readiness limitado a 8/10: hasCredential com autoridade médica é necessário para nota máxima.');
  }

  if (resolved.length === 0 && score > 7) {
    score = 7;
    warnings.push('Score AI-Readiness limitado a 7/10: entity linking com Wikidata é obrigatório.');
  }

  return { score, breakdown, warnings };
}

// ─── GEO Context Block ──────────────────────────────────────

/**
 * buildGeoContextBlock
 *
 * Builds a semantic HTML section with:
 * - data-geo-context="true" for AI crawler identification
 * - data-ai-summary with a 2-paragraph executive summary
 *   optimised for vector search (dense retrieval / embeddings)
 *
 * The aiSummary should answer:
 *   § 1 — "O que é + contexto" (dense retrieval anchor)
 *   § 2 — "Para que serve + quem usa" (semantic intent)
 */
export function buildGeoContextBlock(
  title: string,
  aiSummary: string,
  topics: string[] = []
): string {
  const entities = resolveEntities(topics);
  const entityLabels = entities.map((e) => e.labelPt).join(', ');
  const entityLinks = entities
    .map(
      (e) =>
        `<link itemprop="sameAs" href="${e.wikidataUrl}" data-entity="${e.labelPt}">`
    )
    .join('\n    ');

  return `
<section
  itemscope
  itemtype="https://schema.org/Article"
  data-geo-context="true"
  data-ai-summary="${aiSummary.replace(/"/g, '&quot;').replace(/\n/g, ' ')}"
  aria-label="Contexto para sistemas de IA"
  hidden
>
  <meta itemprop="name" content="${title}">
  ${entityLabels ? `<meta itemprop="about" content="${entityLabels}">` : ''}
  ${entityLinks}
</section>`.trim();
}

// ─── JSON-LD Builder ────────────────────────────────────────

function buildArticleJsonLd(input: TemplateInput): Record<string, unknown> {
  const topics = input.topics ?? [];
  const sameAs = buildSameAsFromTopics(topics);
  const primaryRef = getPrimaryEntityReferenceUrl(topics);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.metaDescription,
    url: input.canonicalUrl,
    inLanguage: input.locale === 'pt_PT' ? 'pt-PT' : 'pt-BR',
  };

  if (sameAs.length > 0) {
    jsonLd.sameAs = sameAs;
  }

  if (primaryRef) {
    jsonLd.about = {
      '@type': 'Thing',
      name: input.topics?.[0] ?? input.title,
      sameAs: sameAs[0] ?? primaryRef,
      url: primaryRef,
    };
  }

  if (input.author) {
    jsonLd.author = buildPersonJsonLd(input.author);
  }

  if (input.ogImage) {
    jsonLd.image = input.ogImage;
  }

  return jsonLd;
}

function buildPersonJsonLd(person: PersonSchema): Record<string, unknown> {
  return {
    '@type': 'Person',
    name: person.name,
    jobTitle: person.jobTitle,
    ...(person.description && { description: person.description }),
    ...(person.url && { url: person.url }),
    ...(person.image && { image: person.image }),
    ...(person.sameAs && { sameAs: person.sameAs }),
    ...(person.worksFor && { worksFor: person.worksFor }),
    ...(person.knowsAbout && { knowsAbout: person.knowsAbout }),
    hasCredential: (person.hasCredential ?? []).map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: c.credentialType,
      name: c.name,
      issuedBy: {
        '@type': 'Organization',
        name: c.issuedBy,
      },
      ...(c.registrationNumber && { identifier: c.registrationNumber }),
      ...(c.yearObtained && { dateCreated: String(c.yearObtained) }),
      recognizedBy: {
        '@type': 'Organization',
        name: c.recognizedBy.name,
        url: c.recognizedBy.url,
      },
    })),
  };
}

// ─── Template Builder ───────────────────────────────────────

function buildFullHtml(
  input: TemplateInput,
  seoHead: string,
  geoBlock: string,
  allJsonLd: Record<string, unknown>[]
): string {
  const jsonLdScripts = allJsonLd
    .map(
      (obj) =>
        `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${input.locale === 'pt_PT' ? 'pt-PT' : 'pt-BR'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${seoHead}
  ${jsonLdScripts}
</head>
<body>
  ${geoBlock}
  <main>
    ${input.contentHtml}
  </main>
</body>
</html>`;
}

// ─── Edge Function Handler ──────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: TemplateInput = await req.json();

    if (!input.title || !input.canonicalUrl || !input.contentHtml) {
      return new Response(
        JSON.stringify({ error: 'title, canonicalUrl e contentHtml são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Build SEO head
    const seoOptions: SeoHeadOptions = {
      title: input.title,
      metaDescription: input.metaDescription,
      canonicalUrl: input.canonicalUrl,
      keywords: input.keywords,
      ogImage: input.ogImage,
      locale: input.locale,
      aiContentPolicy: { allowTraining: false, allowCrawling: true },
    };
    const seoHead = buildSeoHead(seoOptions);

    // 2. Build GEO context block
    const aiSummary = input.aiSummary ?? '';
    const geoBlock = buildGeoContextBlock(input.title, aiSummary, input.topics ?? []);

    // 3. Build JSON-LD
    const articleJsonLd = buildArticleJsonLd(input);
    const allJsonLd: Record<string, unknown>[] = [articleJsonLd];

    if (input.author) {
      allJsonLd.push({
        '@context': 'https://schema.org',
        ...buildPersonJsonLd(input.author),
      });
    }

    if (input.extraJsonLd) {
      allJsonLd.push(...input.extraJsonLd);
    }

    // 4. Score E-E-A-T and AI-Readiness
    const eeAtScore = scoreEEAT(input);
    const aiReadinessScore = scoreAIReadiness(input, seoHead);

    // 5. Build full HTML
    const html = buildFullHtml(input, seoHead, geoBlock, allJsonLd);

    const output: TemplateOutput = {
      html,
      eeAtScore,
      aiReadinessScore,
      resolvedEntities: resolveEntities(input.topics ?? []),
    };

    console.log(`✅ Template Engine: E-E-A-T ${eeAtScore.score}/10 | AI-Readiness ${aiReadinessScore.score}/10`);

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Template Engine error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

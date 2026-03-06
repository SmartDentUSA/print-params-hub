// ═══════════════════════════════════════════════════════════
// SEO Fine-Tuning: AI-Readiness (GEO) + E-E-A-T Head Builder
// ═══════════════════════════════════════════════════════════

export interface SeoHeadOptions {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  locale?: string;
  /** Allow AI bots to crawl but not train on content */
  aiContentPolicy?: {
    allowTraining: boolean;
    allowCrawling: boolean;
  };
  /** Override the default list of robots directives */
  robotsDirectives?: string[];
  /** Extra allowed AI agents beyond the default list */
  extraAiAgents?: string[];
}

/** Default AI agents that should be explicitly listed in robots meta */
const DEFAULT_AI_AGENTS = [
  'GPTBot',
  'CCBot',
  'Google-Extended',
  'anthropic-ai',
  'PerplexityBot',
  'Omgilibot',
  'FacebookBot',
];

/**
 * Builds the full <head> SEO block for a page, including:
 * - Standard meta tags
 * - AI content policy meta tag (GEO/AI-Readiness)
 * - Robots meta with explicit AI agent directives
 * - Open Graph tags
 * - Canonical link
 */
export function buildSeoHead(options: SeoHeadOptions): string {
  const {
    title,
    metaDescription,
    canonicalUrl,
    keywords = [],
    ogImage = '',
    ogType = 'article',
    locale = 'pt_BR',
    aiContentPolicy = { allowTraining: false, allowCrawling: true },
    robotsDirectives = ['index', 'follow'],
    extraAiAgents = [],
  } = options;

  const aiPolicyContent = [
    `allow-training:${aiContentPolicy.allowTraining ? 'true' : 'false'}`,
    `allow-crawling:${aiContentPolicy.allowCrawling ? 'true' : 'false'}`,
  ].join(', ');

  const allAiAgents = [...DEFAULT_AI_AGENTS, ...extraAiAgents];

  // Build per-agent robots meta tags so crawlers like GPTBot respect directives
  const aiAgentRobotsTags = allAiAgents
    .map((agent) => {
      const directive = aiContentPolicy.allowCrawling ? 'all' : 'noindex, nofollow';
      return `<meta name="robots" content="${directive}" data-agent="${agent}">`;
    })
    .join('\n  ');

  const robotsContent = robotsDirectives.join(', ');
  const keywordsMeta = keywords.length > 0
    ? `<meta name="keywords" content="${escapeAttr(keywords.join(', '))}">`
    : '';

  return `
  <!-- SEO Core -->
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(metaDescription)}">
  ${keywordsMeta}
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">

  <!-- Robots -->
  <meta name="robots" content="${robotsContent}">
  ${aiAgentRobotsTags}

  <!-- AI Content Policy (GEO / AI-Readiness) -->
  <meta name="ai-content-policy" content="${aiPolicyContent}">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(metaDescription)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:locale" content="${locale}">
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(metaDescription)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeAttr(ogImage)}">` : ''}
`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

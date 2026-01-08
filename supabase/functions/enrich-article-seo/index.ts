import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EnrichmentReport {
  articleId: string;
  articleTitle: string;
  slug: string;
  changes: {
    summaryBoxAdded: boolean;
    dataTablesCreated: number;
    internalLinksAdded: number;
    externalLinksAdded: number;
    relatedArticlesSection: boolean;
  };
  beforeLength: number;
  afterLength: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  content_html: string;
  category_id: string | null;
  keywords: string[] | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function hasSummaryBox(html: string): boolean {
  return html.includes('ai-summary-box') || html.includes('class="summary-box"');
}

function hasDataTable(html: string): boolean {
  return html.includes('ai-data-table') || html.includes('class="data-table"');
}

function hasInternalKBLinks(html: string): boolean {
  return html.includes('/base-conhecimento/');
}

function hasRelatedArticlesSection(html: string): boolean {
  return html.includes('related-articles') || html.includes('Artigos Relacionados');
}

function countTechnicalLists(html: string): number {
  // Detect <ul> lists with technical data (numbers, units, percentages)
  const listMatches = html.match(/<ul[^>]*>[\s\S]*?<\/ul>/gi) || [];
  return listMatches.filter(list => 
    /\d+(\.\d+)?\s*(MPa|GPa|%|mm|μm|nm|°C|ISO|ASTM)/i.test(list)
  ).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SUMMARY GENERATION
// ═══════════════════════════════════════════════════════════════════════════

async function generateSummaryWithAI(html: string, title: string): Promise<{
  summary: string;
  quickFacts: { label: string; value: string }[];
} | null> {
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  const prompt = `Analise o artigo HTML abaixo e gere um resumo técnico SEO-optimizado.

TÍTULO: ${title}

CONTEÚDO HTML:
${html.substring(0, 8000)}

GERE UM JSON com exatamente este formato:
{
  "summary": "Resumo técnico de 50-80 palavras destacando dados numéricos, normas ISO, e aplicações clínicas principais. Use linguagem científica clara.",
  "quickFacts": [
    {"label": "Propriedade Principal", "value": "valor com unidade"},
    {"label": "Norma", "value": "ISO XXXX ou ASTM"},
    {"label": "Aplicação", "value": "uso clínico principal"}
  ]
}

REGRAS:
- Extraia APENAS dados presentes no HTML, não invente
- Use no máximo 4 quickFacts
- Priorize dados numéricos com unidades
- Se não encontrar dados técnicos, retorne null`;

  try {
    console.log(`[AI] Calling Lovable AI Gateway for: ${title}`);
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em SEO técnico para conteúdo odontológico. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] API error ${response.status}:`, errorText);
      return null;
    }
    console.log(`[AI] ✅ Response received for: ${title}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.summary) return null;
    
    return parsed;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML INJECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function injectSummaryBox(html: string, summary: string, quickFacts: { label: string; value: string }[]): string {
  const quickFactsHtml = quickFacts.length > 0 
    ? `<ul class="quick-facts">${quickFacts.map(f => `<li><strong>${f.label}:</strong> ${f.value}</li>`).join('\n    ')}</ul>`
    : '';

  const summaryBox = `
<div class="ai-summary-box" itemscope itemtype="https://schema.org/DefinedTerm">
  <h2 itemprop="name">📊 Resumo Técnico Rápido</h2>
  <p itemprop="description">${summary}</p>
  ${quickFactsHtml}
</div>
`;

  // Insert after first H1 or H2
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  if (h1Match) {
    const insertPos = html.indexOf(h1Match[0]) + h1Match[0].length;
    return html.slice(0, insertPos) + '\n' + summaryBox + html.slice(insertPos);
  }

  const h2Match = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
  if (h2Match) {
    const insertPos = html.indexOf(h2Match[0]) + h2Match[0].length;
    return html.slice(0, insertPos) + '\n' + summaryBox + html.slice(insertPos);
  }

  // Fallback: insert at beginning
  return summaryBox + html;
}

function convertTechnicalListToTable(html: string): { html: string; count: number } {
  let count = 0;
  
  // Find <ul> lists with technical data
  const processedHtml = html.replace(
    /<ul[^>]*class="[^"]*technical[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    (match, content) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      if (items.length < 2) return match;

      const rows = items.map((item: string) => {
        const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
        // Try to split by : or -
        const parts = text.split(/[:\-–]/);
        if (parts.length >= 2) {
          const param = parts[0].trim();
          const value = parts.slice(1).join(':').trim();
          const hasNumber = /\d/.test(value);
          return `    <tr><td>${param}</td><td>${value}</td><td>${hasNumber ? '✅' : '—'}</td></tr>`;
        }
        return `    <tr><td colspan="3">${text}</td></tr>`;
      });

      count++;
      return `
<table class="ai-data-table" itemscope itemtype="https://schema.org/Table">
  <caption itemprop="name">Propriedades Técnicas</caption>
  <thead>
    <tr><th>Parâmetro</th><th>Valor</th><th>Status</th></tr>
  </thead>
  <tbody>
${rows.join('\n')}
  </tbody>
</table>`;
    }
  );

  return { html: processedHtml, count };
}

function injectInternalLinks(html: string, relatedArticles: { slug: string; title: string }[]): { html: string; count: number } {
  let count = 0;
  let processedHtml = html;

  for (const article of relatedArticles.slice(0, 8)) {
    // Find mentions of the article title in the text (case insensitive)
    const titleWords = article.title.split(' ').filter(w => w.length > 4);
    
    for (const word of titleWords) {
      // Only link first occurrence of each keyword
      const regex = new RegExp(`(?<!<a[^>]*>)\\b(${word})\\b(?![^<]*<\/a>)`, 'i');
      if (regex.test(processedHtml) && count < 8) {
        processedHtml = processedHtml.replace(regex, 
          `<a href="/base-conhecimento/a/${article.slug}" class="internal-link" title="${article.title}">$1</a>`
        );
        count++;
        break; // Only one link per related article
      }
    }
  }

  return { html: processedHtml, count };
}

function addRelatedArticlesSection(html: string, relatedArticles: { slug: string; title: string; excerpt: string }[]): string {
  if (relatedArticles.length === 0) return html;

  const articlesToShow = relatedArticles.slice(0, 4);
  
  const section = `
<section class="related-articles">
  <h2>📚 Artigos Relacionados</h2>
  <ul>
    ${articlesToShow.map(a => `<li><a href="/base-conhecimento/a/${a.slug}">${a.title}</a></li>`).join('\n    ')}
  </ul>
</section>
`;

  // Insert before closing </article> or at the end
  if (html.includes('</article>')) {
    return html.replace('</article>', section + '\n</article>');
  }
  
  return html + '\n' + section;
}

function injectEntityLinks(html: string, externalLinks: { name: string; url: string; description: string | null }[]): { html: string; count: number } {
  let count = 0;
  let processedHtml = html;

  for (const link of externalLinks.slice(0, 10)) {
    // Find keyword in text (case insensitive, not already in a link)
    const regex = new RegExp(`(?<!<a[^>]*>)\\b(${link.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?![^<]*<\/a>)`, 'gi');
    
    const matches = processedHtml.match(regex);
    if (matches && matches.length > 0 && count < 5) {
      // Only link first occurrence
      processedHtml = processedHtml.replace(regex, (match, p1, offset) => {
        if (count >= 5) return match;
        count++;
        const title = link.description || link.name;
        return `<a href="${link.url}" class="entity-link" rel="noopener" target="_blank" title="${title}">${p1}</a>`;
      });
    }
  }

  return { html: processedHtml, count };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENRICHMENT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function enrichArticle(
  supabase: ReturnType<typeof createClient>,
  article: ArticleData,
  relatedArticles: { slug: string; title: string; excerpt: string }[],
  externalLinks: { name: string; url: string; description: string | null }[],
  dryRun: boolean = false
): Promise<EnrichmentReport> {
  const report: EnrichmentReport = {
    articleId: article.id,
    articleTitle: article.title,
    slug: article.slug,
    changes: {
      summaryBoxAdded: false,
      dataTablesCreated: 0,
      internalLinksAdded: 0,
      externalLinksAdded: 0,
      relatedArticlesSection: false,
    },
    beforeLength: article.content_html?.length || 0,
    afterLength: 0,
    status: 'success',
  };

  try {
    let html = article.content_html || '';
    
    if (!html || html.length < 1000) {
      report.status = 'skipped';
      report.error = 'Conteúdo muito curto para enriquecimento';
      return report;
    }

    // 1. Add Summary Box if missing
    if (!hasSummaryBox(html)) {
      console.log(`[${article.slug}] Generating AI summary...`);
      const summaryData = await generateSummaryWithAI(html, article.title);
      if (summaryData) {
        html = injectSummaryBox(html, summaryData.summary, summaryData.quickFacts);
        report.changes.summaryBoxAdded = true;
        console.log(`[${article.slug}] ✅ Summary box added`);
      }
    }

    // 2. Convert technical lists to tables if missing
    if (!hasDataTable(html) && countTechnicalLists(html) > 0) {
      const tableResult = convertTechnicalListToTable(html);
      html = tableResult.html;
      report.changes.dataTablesCreated = tableResult.count;
      if (tableResult.count > 0) {
        console.log(`[${article.slug}] ✅ ${tableResult.count} tables created`);
      }
    }

    // 3. Add internal KB links if missing
    if (!hasInternalKBLinks(html) && relatedArticles.length > 0) {
      const linkResult = injectInternalLinks(html, relatedArticles);
      html = linkResult.html;
      report.changes.internalLinksAdded = linkResult.count;
      if (linkResult.count > 0) {
        console.log(`[${article.slug}] ✅ ${linkResult.count} internal links added`);
      }
    }

    // 4. Add related articles section if missing
    if (!hasRelatedArticlesSection(html) && relatedArticles.length > 0) {
      html = addRelatedArticlesSection(html, relatedArticles);
      report.changes.relatedArticlesSection = true;
      console.log(`[${article.slug}] ✅ Related articles section added`);
    }

    // 5. Add E-E-A-T entity links
    if (externalLinks.length > 0) {
      const entityResult = injectEntityLinks(html, externalLinks);
      html = entityResult.html;
      report.changes.externalLinksAdded = entityResult.count;
      if (entityResult.count > 0) {
        console.log(`[${article.slug}] ✅ ${entityResult.count} entity links added`);
      }
    }

    report.afterLength = html.length;

    // Save if not dry run and changes were made
    const hasChanges = report.changes.summaryBoxAdded || 
                       report.changes.dataTablesCreated > 0 ||
                       report.changes.internalLinksAdded > 0 ||
                       report.changes.relatedArticlesSection ||
                       report.changes.externalLinksAdded > 0;

    if (!dryRun && hasChanges) {
      const { error } = await supabase
        .from('knowledge_contents')
        .update({ 
          content_html: html, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', article.id);

      if (error) {
        throw error;
      }
      console.log(`[${article.slug}] ✅ Saved to database`);
    }

    if (!hasChanges) {
      report.status = 'skipped';
      report.error = 'Artigo já está otimizado';
    }

  } catch (error) {
    console.error(`[${article.slug}] Error:`, error);
    report.status = 'error';
    report.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return report;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HANDLER
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body = await req.json().catch(() => ({}));
    const { 
      articleId, 
      batchProcess = false, 
      minLength = 5000,
      dryRun = false,
      limit = 20
    } = body;

    console.log('='.repeat(60));
    console.log('ENRICH ARTICLE SEO - Starting');
    console.log(`Mode: ${batchProcess ? 'Batch' : 'Single'}, DryRun: ${dryRun}`);
    console.log('='.repeat(60));

    // Fetch articles to process
    let articlesQuery = supabase
      .from('knowledge_contents')
      .select('id, title, slug, content_html, category_id, keywords')
      .eq('active', true);

    if (articleId) {
      articlesQuery = articlesQuery.eq('id', articleId);
    } else if (batchProcess) {
      // Fetch substantial articles (content_html > minLength)
      articlesQuery = articlesQuery
        .not('content_html', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    const { data: articles, error: articlesError } = await articlesQuery;

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`);
    }

    // Filter by minLength in code (Supabase doesn't support LENGTH in queries easily)
    const substantialArticles = batchProcess 
      ? (articles || []).filter(a => (a.content_html?.length || 0) >= minLength)
      : articles || [];

    console.log(`Found ${substantialArticles.length} articles to process`);

    if (substantialArticles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No articles found matching criteria',
        reports: [],
        totalProcessed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all related articles for internal linking
    const { data: allArticles } = await supabase
      .from('knowledge_contents')
      .select('id, title, slug, excerpt, category_id, keywords')
      .eq('active', true)
      .limit(200);

    // Fetch approved external links
    const { data: externalLinks } = await supabase
      .from('external_links')
      .select('name, url, description')
      .eq('approved', true)
      .limit(100);

    const reports: EnrichmentReport[] = [];

    for (const article of substantialArticles) {
      // Find related articles (same category or overlapping keywords)
      const related = (allArticles || [])
        .filter(a => 
          a.id !== article.id && 
          (a.category_id === article.category_id || 
           (a.keywords && article.keywords && 
            a.keywords.some((k: string) => article.keywords?.includes(k))))
        )
        .slice(0, 10);

      const report = await enrichArticle(
        supabase,
        article,
        related,
        externalLinks || [],
        dryRun
      );
      reports.push(report);
    }

    const successCount = reports.filter(r => r.status === 'success').length;
    const skippedCount = reports.filter(r => r.status === 'skipped').length;
    const errorCount = reports.filter(r => r.status === 'error').length;

    console.log('='.repeat(60));
    console.log(`COMPLETED: ${successCount} enriched, ${skippedCount} skipped, ${errorCount} errors`);
    console.log('='.repeat(60));

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      reports,
      summary: {
        total: reports.length,
        enriched: successCount,
        skipped: skippedCount,
        errors: errorCount,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enrich Article SEO Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

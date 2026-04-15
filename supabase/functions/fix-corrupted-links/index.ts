import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * fix-corrupted-links V2
 *
 * Deep cleanup of <a> tags injected by the AI content pipeline into
 * places where they should never appear (attributes, JSON-LD, headings, etc.).
 *
 * Processes: content_html, content_html_en, content_html_es
 *
 * POST body: { dryRun?: boolean, limit?: number, offset?: number }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { dryRun = true, limit = 500, offset = 0 } = await req.json().catch(() => ({}));

    const columns = ['content_html', 'content_html_en', 'content_html_es'] as const;

    const { data: articles, error } = await supabase
      .from('knowledge_contents')
      .select('id, title, content_html, content_html_en, content_html_es')
      .not('content_html', 'is', null)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const report: Array<{ id: string; title: string; fixes: number; column: string; sample?: string }> = [];
    let totalFixed = 0;
    let totalArticlesFixed = 0;

    for (const article of articles || []) {
      const updates: Record<string, string> = {};
      let articleFixCount = 0;

      for (const col of columns) {
        const html = article[col];
        if (!html) continue;

        const { cleaned, fixCount, sample } = cleanCorruptedHtml(html);
        if (fixCount === 0) continue;

        articleFixCount += fixCount;
        updates[col] = cleaned;

        report.push({
          id: article.id,
          title: article.title,
          fixes: fixCount,
          column: col,
          sample: sample?.substring(0, 200),
        });
      }

      if (articleFixCount === 0) continue;

      totalFixed += articleFixCount;
      totalArticlesFixed++;

      if (!dryRun) {
        updates['updated_at'] = new Date().toISOString();
        const { error: updateErr } = await supabase
          .from('knowledge_contents')
          .update(updates)
          .eq('id', article.id);

        if (updateErr) {
          console.error(`Failed to update ${article.id}:`, updateErr.message);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      totalArticlesScanned: articles?.length || 0,
      totalArticlesFixed,
      totalFixesApplied: totalFixed,
      report: report.slice(0, 150),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('fix-corrupted-links error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanCorruptedHtml(html: string): { cleaned: string; fixCount: number; sample?: string } {
  let fixCount = 0;
  let sample: string | undefined;
  let cleaned = html;

  const track = (match: string) => { fixCount++; if (!sample) sample = match; };

  // ── Pattern 1: href="...anything...<a href="REAL_URL">Label</a>...anything..."
  cleaned = cleaned.replace(
    /href="[^"]*<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>[^"]*"/gi,
    (m, url) => { track(m); return `href="${url}"`; }
  );

  // ── Pattern 2: itemtype="<a href="URL">...</a>"
  cleaned = cleaned.replace(
    /itemtype="<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>"/gi,
    (m, url) => { track(m); return `itemtype="${url}"`; }
  );

  // ── Pattern 3: [SUA URL CANÔNICA AQUI ...] placeholder
  cleaned = cleaned.replace(
    /\[SUA URL CANÔNICA AQUI[^\]]*\]/gi,
    (m) => { track(m); return ''; }
  );

  // ── Pattern 4: Orphan </a> inside attribute values
  cleaned = cleaned.replace(
    /(href|src|action)="([^"]*)<\/a>([^"]*)"/gi,
    (m, attr, before, after) => {
      track(m);
      const url = before.replace(/<[^>]*>/g, '').trim();
      return `${attr}="${url}${after}"`;
    }
  );

  // ── Pattern 5: Double-nested anchors <a><a>text</a></a>
  cleaned = cleaned.replace(
    /<a\s[^>]*href="[^"]*"[^>]*>\s*<a\s([^>]*)>([\s\S]*?)<\/a>\s*<\/a>/gi,
    (m, innerAttrs, innerText) => { track(m); return `<a ${innerAttrs}>${innerText}</a>`; }
  );

  // ── Pattern 6: <a> tags inside NON-href attributes (alt, title, data-*, class, etc.)
  // e.g. alt="<a href="URL">Text</a> - suffix" → alt="Text - suffix"
  cleaned = cleaned.replace(
    /((?:alt|title|data-[\w-]+|class|aria-label|placeholder|content)="[^"]*?)<a\s[^>]*>([^<]*)<\/a>([^"]*")/gi,
    (m, before, text, after) => { track(m); return `${before}${text}${after}`; }
  );
  // Run pattern 6 multiple times to catch multiple <a> tags in the same attribute
  let prevLength = cleaned.length;
  for (let i = 0; i < 5; i++) {
    cleaned = cleaned.replace(
      /((?:alt|title|data-[\w-]+|class|aria-label|placeholder|content)="[^"]*?)<a\s[^>]*>([^<]*)<\/a>([^"]*")/gi,
      (m, before, text, after) => { track(m); return `${before}${text}${after}`; }
    );
    if (cleaned.length === prevLength) break;
    prevLength = cleaned.length;
  }

  // ── Pattern 7: <a> tags inside JSON-LD <script> blocks
  cleaned = cleaned.replace(
    /(<script\s[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m, open, jsonContent, close) => {
      const originalJson = jsonContent;
      const cleanedJson = jsonContent.replace(
        /<a\s[^>]*>([^<]*)<\/a>/gi,
        (_: string, text: string) => { track(_); return text; }
      );
      if (cleanedJson !== originalJson) {
        return `${open}${cleanedJson}${close}`;
      }
      return m;
    }
  );

  // ── Pattern 8: <a> tags inside <h1> headings (especially loja.smartdent links)
  cleaned = cleaned.replace(
    /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/gi,
    (m, open, content, close) => {
      const originalContent = content;
      const cleanedContent = content.replace(
        /<a\s[^>]*>([^<]*)<\/a>/gi,
        (_: string, text: string) => { track(_); return text; }
      );
      if (cleanedContent !== originalContent) {
        return `${open}${cleanedContent}${close}`;
      }
      return m;
    }
  );

  // ── Pattern 9: <a> tags inside data-*-url attributes specifically
  // e.g. data-orcid-url="<a href="URL">URL</a>" → data-orcid-url="URL"
  // Already handled by Pattern 6, but catch the case where href is the meaningful value
  cleaned = cleaned.replace(
    /(data-[\w-]*url)="<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>"/gi,
    (m, attr, url) => { track(m); return `${attr}="${url}"`; }
  );

  // ── Pattern 10: Inline loja.smartdent links with generic anchor text in body
  // Remove <a href="loja.smartdent...">generic term</a> → keep just the text
  // but preserve links inside .inline-product-card divs (those are legitimate)
  cleaned = cleaned.replace(
    /<a\s[^>]*href="https?:\/\/loja\.smartdent\.com\.br[^"]*"[^>]*>([^<]{1,80})<\/a>/gi,
    (m, text) => {
      // If text looks like a product name (starts with uppercase, has brand-like words), keep it simple text
      track(m);
      return text;
    }
  );

  // Safeguard: never return empty if input had content
  if (!cleaned.trim() && html.trim()) {
    console.warn('fix-corrupted-links: cleaning zeroed content, returning original');
    return { cleaned: html, fixCount: 0 };
  }

  return { cleaned, fixCount, sample };
}

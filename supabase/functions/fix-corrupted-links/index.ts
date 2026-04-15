import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * fix-corrupted-links
 * 
 * Cleans nested <a> tags inside href attributes in knowledge_contents.content_html.
 * 
 * Patterns fixed:
 * 1. href="...text<a href="REAL_URL">Label</a>more..." → href="REAL_URL"
 * 2. href="<a href="URL">Label</a>" → href="URL"
 * 3. [SUA URL CANÔNICA AQUI - Ex: <a href=...] placeholder leftovers
 * 4. Broken itemtype attributes with embedded <a> tags
 * 
 * POST body: { dryRun?: boolean, limit?: number }
 *   dryRun=true (default): returns report without writing
 *   dryRun=false: applies fixes to DB
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

    const { dryRun = true, limit = 1000 } = await req.json().catch(() => ({}));

    // Fetch articles with corrupted HTML (containing <a inside an href or itemtype)
    const { data: articles, error } = await supabase
      .from('knowledge_contents')
      .select('id, title, content_html')
      .not('content_html', 'is', null)
      .limit(limit);

    if (error) throw error;

    const report: Array<{ id: string; title: string; fixes: number; sample?: string }> = [];
    let totalFixed = 0;
    let totalArticlesFixed = 0;

    for (const article of articles || []) {
      const { cleaned, fixCount, sample } = cleanCorruptedHtml(article.content_html);

      if (fixCount === 0) continue;

      totalFixed += fixCount;
      totalArticlesFixed++;

      report.push({
        id: article.id,
        title: article.title,
        fixes: fixCount,
        sample: sample?.substring(0, 200),
      });

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('knowledge_contents')
          .update({ content_html: cleaned, updated_at: new Date().toISOString() })
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
      report: report.slice(0, 100), // limit report size
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

  // Pattern 1: href="...anything...<a href="REAL_URL">Label</a>...anything..."
  // Extract the inner <a>'s href as the correct URL
  const nestedLinkInHref = /href="[^"]*<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>[^"]*"/gi;
  cleaned = cleaned.replace(nestedLinkInHref, (match, innerUrl) => {
    fixCount++;
    if (!sample) sample = match;
    return `href="${innerUrl}"`;
  });

  // Pattern 2: itemtype="<a href="URL">...</a>"
  const nestedLinkInItemtype = /itemtype="<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>"/gi;
  cleaned = cleaned.replace(nestedLinkInItemtype, (match, innerUrl) => {
    fixCount++;
    if (!sample) sample = match;
    return `itemtype="${innerUrl}"`;
  });

  // Pattern 3: [SUA URL CANÔNICA AQUI - Ex: <a href=...] placeholder
  const placeholderPattern = /\[SUA URL CANÔNICA AQUI[^\]]*\]/gi;
  cleaned = cleaned.replace(placeholderPattern, (match) => {
    fixCount++;
    if (!sample) sample = match;
    return '';
  });

  // Pattern 4: Orphan closing </a> inside attribute values (leftover from partial cleanups)
  // e.g. href="https://example.com</a>"
  const closingTagInAttr = /(href|src|action)="([^"]*)<\/a>([^"]*)"/gi;
  cleaned = cleaned.replace(closingTagInAttr, (match, attr, before, after) => {
    fixCount++;
    if (!sample) sample = match;
    const url = before.replace(/<[^>]*>/g, '').trim();
    return `${attr}="${url}${after}"`;
  });

  // Pattern 5: Double-nested anchors: <a href="..."><a href="URL">text</a></a>
  const doubleAnchor = /<a\s[^>]*href="[^"]*"[^>]*>\s*<a\s([^>]*)>([\s\S]*?)<\/a>\s*<\/a>/gi;
  cleaned = cleaned.replace(doubleAnchor, (match, innerAttrs, innerText) => {
    fixCount++;
    if (!sample) sample = match;
    return `<a ${innerAttrs}>${innerText}</a>`;
  });

  // Safeguard: never return empty if input had content
  if (!cleaned.trim() && html.trim()) {
    console.warn('fix-corrupted-links: cleaning zeroed content, returning original');
    return { cleaned: html, fixCount: 0 };
  }

  return { cleaned, fixCount, sample };
}

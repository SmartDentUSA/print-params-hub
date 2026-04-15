import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        report.push({ id: article.id, title: article.title, fixes: fixCount, column: col, sample: sample?.substring(0, 200) });
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
        if (updateErr) console.error(`Failed to update ${article.id}:`, updateErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true, dryRun,
      totalArticlesScanned: articles?.length || 0,
      totalArticlesFixed, totalFixesApplied: totalFixed,
      report: report.slice(0, 150),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('fix-corrupted-links error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function stripAnchors(s: string): string {
  return s.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1').replace(/<a\s[^>]*>/gi, '');
}

function cleanCorruptedHtml(html: string): { cleaned: string; fixCount: number; sample?: string } {
  let fixCount = 0;
  let sample: string | undefined;
  let cleaned = html;
  const track = (m: string) => { fixCount++; if (!sample) sample = m; };

  // 1. JSON-LD script blocks — strip all <a> tags inside
  cleaned = cleaned.replace(
    /(<script\s[^>]*type\s*=\s*"application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m, open, json, close) => {
      const s = stripAnchors(json);
      if (s !== json) { track(m.substring(0, 100)); return `${open}${s}${close}`; }
      return m;
    }
  );

  // 2. <h1> headings — strip all <a> tags
  cleaned = cleaned.replace(
    /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/gi,
    (m, open, content, close) => {
      const s = stripAnchors(content);
      if (s !== content) { track(m.substring(0, 100)); return `${open}${s}${close}`; }
      return m;
    }
  );

  // 3. loja.smartdent inline links — strip, keep text
  cleaned = cleaned.replace(
    /<a\s[^>]*href="https?:\/\/loja\.smartdent\.com\.br[^"]*"[^>]*>([^<]{1,100})<\/a>/gi,
    (m, text) => { track(m); return text; }
  );

  // 4. Placeholders
  cleaned = cleaned.replace(/\[SUA URL CANÔNICA AQUI[^\]]*\]/gi, (m) => { track(m); return ''; });

  // 5. Double-nested anchors
  cleaned = cleaned.replace(
    /<a\s[^>]*href="[^"]*"[^>]*>\s*<a\s([^>]*)>([\s\S]*?)<\/a>\s*<\/a>/gi,
    (m, a, t) => { track(m); return `<a ${a}>${t}</a>`; }
  );

  // 6. Corrupted href values containing <a tags mid-URL
  //    Pattern: href="url-part-<a href="real-url">text</a>rest"
  //    Since [^"]* stops at nested quotes, use [\s\S] with lazy matching
  //    Match: href=" + anything containing <a + up to the LAST " before > or space+attr
  for (let pass = 0; pass < 3; pass++) {
    const before = cleaned;
    // Match an opening <a tag whose href contains another <a tag
    cleaned = cleaned.replace(
      /<a\s+href="([^"]*?)<a\s[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>([^"]*)"([^>]*)>/gi,
      (m, prefix, innerUrl, suffix, rest) => {
        track(m.substring(0, 100));
        // Use the inner URL as the correct one
        return `<a href="${innerUrl}"${rest}>`;
      }
    );
    if (cleaned === before) break;
  }

  // 7. Attributes (non-href) containing <a> tags
  //    e.g. alt="<a href="url">text</a> suffix"  or  data-ai-summary="...<a>..text..</a>..."
  //    These have nested quotes that break. Use broader pattern:
  //    Match the attribute name, then find <a...>text</a> and strip it
  const attrNames = ['alt', 'title', 'content', 'data-ai-summary', 'data-schema',
    'data-orcid-url', 'data-standard-url', 'data-entity-id', 'data-wikidata',
    'data-company', 'data-founded', 'data-geo-region', 'aria-label', 'placeholder',
    'itemtype', 'data-source'];
  
  for (const attr of attrNames) {
    for (let pass = 0; pass < 5; pass++) {
      const before = cleaned;
      // Simple pattern: attr="...<a ...>text</a>..." → attr="...text..."
      const re = new RegExp(`(${attr}="[^"]*?)<a\\s[^>]*>([^<]*)</a>`, 'gi');
      cleaned = cleaned.replace(re, (m, pre, text) => { track(m.substring(0, 100)); return `${pre}${text}`; });
      if (cleaned === before) break;
    }
  }

  // 8. Orphan </a> inside attributes
  cleaned = cleaned.replace(
    /(href|src|action)="([^"]*)<\/a>([^"]*)"/gi,
    (m, attr, before, after) => {
      track(m);
      return `${attr}="${before.replace(/<[^>]*>/g, '').trim()}${after}"`;
    }
  );

  // Safeguard
  if (!cleaned.trim() && html.trim()) {
    return { cleaned: html, fixCount: 0 };
  }

  return { cleaned, fixCount, sample };
}

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

    const { dryRun = true, limit = 500, offset = 0, category, stripProductCards = false } = await req.json().catch(() => ({}));
    const columns = ['content_html', 'content_html_en', 'content_html_es'] as const;

    // If category letter provided (e.g. "E"), resolve to category_id first
    let categoryId: string | null = null;
    if (category) {
      const { data: cat } = await supabase
        .from('knowledge_categories')
        .select('id')
        .eq('letter', category.toUpperCase())
        .single();
      if (cat) categoryId = cat.id;
    }

    let query = supabase
      .from('knowledge_contents')
      .select('id, title, category_id, content_html, content_html_en, content_html_es')
      .not('content_html', 'is', null);
    
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: articles, error } = await query.range(offset, offset + limit - 1);

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
        let { cleaned, fixCount, sample } = cleanCorruptedHtml(html);
        
        // Strip inline-product-card divs from visible body if requested
        if (stripProductCards) {
          const pcResult = stripProductCardsFromBody(cleaned);
          if (pcResult.fixCount > 0) {
            cleaned = pcResult.cleaned;
            fixCount += pcResult.fixCount;
            if (!sample) sample = pcResult.sample;
          }
        }
        
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

/**
 * Remove inline-product-card divs from the visible body content.
 * Preserves cards inside the hidden llm-knowledge-layer section.
 */
function stripProductCardsFromBody(html: string): { cleaned: string; fixCount: number; sample?: string } {
  let fixCount = 0;
  let sample: string | undefined;

  // Identify the llm-knowledge-layer section boundaries to preserve cards inside it
  const llmOpenMarker = '<section class="llm-knowledge-layer"';
  const llmStart = html.indexOf(llmOpenMarker);
  let llmEnd = -1;
  
  if (llmStart !== -1) {
    // Find the closing </section> for the llm-knowledge-layer
    const afterLlm = html.indexOf('</section>', llmStart);
    if (afterLlm !== -1) {
      llmEnd = afterLlm + '</section>'.length;
    }
  }

  // Build segments: parts of HTML that are visible (outside llm-knowledge-layer)
  const segments: Array<{ start: number; end: number; isLlm: boolean }> = [];
  if (llmStart !== -1 && llmEnd !== -1) {
    if (llmStart > 0) segments.push({ start: 0, end: llmStart, isLlm: false });
    segments.push({ start: llmStart, end: llmEnd, isLlm: true });
    if (llmEnd < html.length) segments.push({ start: llmEnd, end: html.length, isLlm: false });
  } else {
    segments.push({ start: 0, end: html.length, isLlm: false });
  }

  // Process each visible segment to remove product cards
  let result = '';
  for (const seg of segments) {
    let part = html.substring(seg.start, seg.end);
    if (seg.isLlm) {
      result += part;
      continue;
    }

    // Remove "📦 Produto Recomendado" headers
    part = part.replace(
      /<h[2-4][^>]*>\s*📦\s*Produto\s+Recomendado\s*<\/h[2-4]>/gi,
      (m) => { fixCount++; if (!sample) sample = m; return ''; }
    );

    // Remove inline-product-card blocks using div depth counting
    const cardRegex = /<div\s+class="inline-product-card"[^>]*>/gi;
    let match: RegExpExecArray | null;
    const ranges: Array<[number, number]> = [];

    while ((match = cardRegex.exec(part)) !== null) {
      const startIdx = match.index;
      let depth = 1;
      let i = startIdx + match[0].length;
      
      while (i < part.length && depth > 0) {
        const openDiv = part.indexOf('<div', i);
        const closeDiv = part.indexOf('</div>', i);
        
        if (closeDiv === -1) break;
        
        if (openDiv !== -1 && openDiv < closeDiv) {
          depth++;
          i = openDiv + 4;
        } else {
          depth--;
          if (depth === 0) {
            const endIdx = closeDiv + 6;
            ranges.push([startIdx, endIdx]);
            if (!sample) sample = part.substring(startIdx, Math.min(startIdx + 150, endIdx));
            fixCount++;
          }
          i = closeDiv + 6;
        }
      }
    }

    // Remove ranges in reverse order
    for (let r = ranges.length - 1; r >= 0; r--) {
      part = part.substring(0, ranges[r][0]) + part.substring(ranges[r][1]);
    }

    // Remove empty anchors left behind
    part = part.replace(/<a\s[^>]*>\s*<\/a>/g, '');

    // Clean up excessive whitespace
    part = part.replace(/\n{3,}/g, '\n\n');

    result += part;
  }

  if (fixCount === 0) {
    return { cleaned: html, fixCount: 0 };
  }

  // Safeguard
  if (!result.trim() && html.trim()) {
    return { cleaned: html, fixCount: 0 };
  }

  return { cleaned: result, fixCount, sample };
}

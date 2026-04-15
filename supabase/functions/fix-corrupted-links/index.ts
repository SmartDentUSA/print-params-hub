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

/**
 * Strip all <a ...>text</a> tags from a string, keeping just the text content.
 */
function stripAnchorTags(s: string): string {
  return s.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}

function cleanCorruptedHtml(html: string): { cleaned: string; fixCount: number; sample?: string } {
  let fixCount = 0;
  let sample: string | undefined;
  let cleaned = html;
  const track = (m: string) => { fixCount++; if (!sample) sample = m; };

  // ═══ PHASE 1: Clean <a> tags inside HTML attributes ═══
  // Generic approach: find any attribute="value" where value contains <a...>...</a>
  // This handles alt, title, data-*, itemtype, content, etc.
  // We need to handle nested quotes: attr="text <a href="url">label</a> more"
  // Strategy: find attribute start, then scan forward to find balanced quotes

  // Phase 1a: Clean <a> tags from JSON-LD script blocks first (isolate them)
  cleaned = cleaned.replace(
    /(<script\s[^>]*type\s*=\s*"application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m, open, jsonContent, close) => {
      const stripped = stripAnchorTags(jsonContent);
      if (stripped !== jsonContent) { track(m); return `${open}${stripped}${close}`; }
      return m;
    }
  );

  // Phase 1b: Clean <a> tags inside <h1> headings
  cleaned = cleaned.replace(
    /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/gi,
    (m, open, content, close) => {
      const stripped = stripAnchorTags(content);
      if (stripped !== content) { track(m); return `${open}${stripped}${close}`; }
      return m;
    }
  );

  // Phase 1c: Clean loja.smartdent inline links in body (generic anchor text)
  cleaned = cleaned.replace(
    /<a\s[^>]*href="https?:\/\/loja\.smartdent\.com\.br[^"]*"[^>]*>([^<]{1,100})<\/a>/gi,
    (m, text) => { track(m); return text; }
  );

  // Phase 1d: [SUA URL CANÔNICA AQUI ...] placeholder
  cleaned = cleaned.replace(/\[SUA URL CANÔNICA AQUI[^\]]*\]/gi, (m) => { track(m); return ''; });

  // Phase 1e: Double-nested anchors <a><a>text</a></a>
  cleaned = cleaned.replace(
    /<a\s[^>]*href="[^"]*"[^>]*>\s*<a\s([^>]*)>([\s\S]*?)<\/a>\s*<\/a>/gi,
    (m, innerAttrs, innerText) => { track(m); return `<a ${innerAttrs}>${innerText}</a>`; }
  );

  // ═══ PHASE 2: Fix corrupted attribute values containing <a> tags ═══
  // This is the most complex fix. The AI pipeline injected <a> tags INSIDE attribute values,
  // creating invalid HTML like: href="url-part-<a href="real-url">text</a>-more"
  // or: alt="<a href="url">text</a>"
  // 
  // We use a DOM-like approach: scan for attributes and fix their values.
  // Since the nested quotes break standard regex, we do a character-level scan.

  cleaned = fixAttributeCorruption(cleaned, (m: string) => track(m));

  // Safeguard
  if (!cleaned.trim() && html.trim()) {
    console.warn('fix-corrupted-links: cleaning zeroed content, returning original');
    return { cleaned: html, fixCount: 0 };
  }

  return { cleaned, fixCount, sample };
}

/**
 * Scan HTML for attribute values that contain <a> tags and strip them.
 * Handles the tricky case where nested quotes break standard regex patterns.
 */
function fixAttributeCorruption(html: string, track: (m: string) => void): string {
  // Find patterns like: someattr="...<a ...<a href="url">text</a>..."
  // The key insight: a legitimate attribute value never contains '<a ' followed by 'href='
  
  // Approach: find each occurrence of '<a ' inside what should be an attribute value
  // by looking for patterns like ='...<a ' or ="...<a " where the <a is not preceded by >
  
  const result: string[] = [];
  let i = 0;
  
  while (i < html.length) {
    // Look for start of an HTML tag
    if (html[i] === '<' && i + 1 < html.length && /[a-zA-Z\/!]/.test(html[i + 1])) {
      // We're inside a tag. Find all attributes and clean their values.
      const tagStart = i;
      
      // Skip tag name
      i++;
      while (i < html.length && html[i] !== '>' && html[i] !== ' ') i++;
      
      // Now process attributes until >
      let tagContent = html.substring(tagStart, i);
      let insideTag = true;
      
      while (i < html.length && html[i] !== '>') {
        // Skip whitespace
        while (i < html.length && html[i] === ' ') { tagContent += html[i]; i++; }
        
        if (i >= html.length || html[i] === '>') break;
        
        // Read attribute name
        let attrName = '';
        while (i < html.length && html[i] !== '=' && html[i] !== ' ' && html[i] !== '>') {
          attrName += html[i];
          i++;
        }
        tagContent += attrName;
        
        if (i < html.length && html[i] === '=') {
          tagContent += '=';
          i++;
          
          if (i < html.length && html[i] === '"') {
            // Read quoted attribute value - handle nested quotes from <a> tags
            i++; // skip opening quote
            let attrValue = '';
            let depth = 0;
            
            // Scan forward, tracking nested <a> tag quotes
            while (i < html.length) {
              if (html[i] === '"' && depth === 0) {
                // This might be the closing quote, or it might be a nested quote from <a href="...">
                // Check if what follows looks like it's still inside a corrupted attribute
                // Heuristic: if after the " we see something like href=" or > or space+attr=, 
                // then this might be a nested quote
                
                const afterQuote = html.substring(i + 1, i + 20);
                
                if (afterQuote.match(/^[^<>]*>/)) {
                  // The attribute closes and tag continues normally — this is the real end
                  break;
                } else if (afterQuote.match(/^https?:\/\//)) {
                  // Nested quote from href="url"
                  attrValue += html[i];
                  i++;
                  continue;
                } else {
                  break;
                }
              }
              attrValue += html[i];
              i++;
            }
            
            // Check if attrValue contains <a tags
            if (attrValue.includes('<a ') || attrValue.includes('</a>')) {
              const cleaned = stripAnchorTags(attrValue).replace(/<a\s[^>]*>/gi, '');
              if (cleaned !== attrValue) {
                track(attrValue.substring(0, 100));
                tagContent += '"' + cleaned + '"';
              } else {
                tagContent += '"' + attrValue + '"';
              }
            } else {
              tagContent += '"' + attrValue + '"';
            }
            
            if (i < html.length && html[i] === '"') i++; // skip closing quote
          } else {
            // Unquoted attribute value
            while (i < html.length && html[i] !== ' ' && html[i] !== '>') {
              tagContent += html[i];
              i++;
            }
          }
        }
      }
      
      if (i < html.length && html[i] === '>') {
        tagContent += '>';
        i++;
      }
      
      result.push(tagContent);
    } else {
      result.push(html[i]);
      i++;
    }
  }
  
  return result.join('');
}

// ═══════════════════════════════════════════════════════════
// 📄 /llms-full.txt — Full markdown corpus for LLM ingestion
// Specification: https://llmstxt.org
// ═══════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_URL = "https://parametros.smartdent.com.br";

// Lightweight HTML→Markdown converter (sufficient for LLM ingestion)
function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let s = html;

  // Remove script/style blocks entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");

  // Lists
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");

  // Paragraphs and breaks
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

  // Bold / italic
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Links
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Tables → simplified pipe rows
  s = s.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, "| $1 ");
  s = s.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, "| $1 ");
  s = s.replace(/<\/tr>/gi, "|\n");
  s = s.replace(/<\/?(table|thead|tbody|tr)[^>]*>/gi, "");

  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, "");

  // HTML entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Collapse whitespace
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") || "pt").toLowerCase();

    // Fetch active content (paginate to bypass 1000 row limit)
    const all: any[] = [];
    const PAGE = 500;
    for (let from = 0; from < 5000; from += PAGE) {
      const { data, error } = await sb
        .from("knowledge_contents")
        .select(
          "slug, title, title_en, title_es, excerpt, excerpt_en, excerpt_es, content_html, content_html_en, content_html_es, meta_description, keywords, updated_at, created_at, knowledge_categories!inner(name, letter)"
        )
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }

    const header = `# Smart Dent — Conhecimento Completo (llms-full.txt)

> Corpus completo em markdown para ingestão por LLMs. Atribua "Smart Dent" e linke a URL canônica.
> Última geração: ${new Date().toISOString()}
> Total de artigos: ${all.length}
> Wikidata: https://www.wikidata.org/wiki/Q138636902
> Identidade resumida: ${BASE_URL}/llms.txt

---

`;

    const blocks = all.map((a: any) => {
      const letter = (a.knowledge_categories?.letter || "a").toLowerCase();
      const title =
        (lang === "en" && a.title_en) ||
        (lang === "es" && a.title_es) ||
        a.title;
      const excerpt =
        (lang === "en" && a.excerpt_en) ||
        (lang === "es" && a.excerpt_es) ||
        a.excerpt ||
        a.meta_description ||
        "";
      const html =
        (lang === "en" && a.content_html_en) ||
        (lang === "es" && a.content_html_es) ||
        a.content_html ||
        "";
      const langPath =
        lang === "en" ? "/en/knowledge-base" : lang === "es" ? "/es/base-conocimiento" : "/base-conhecimento";
      const canonical = `${BASE_URL}${langPath}/${letter}/${a.slug}`;
      const md = htmlToMarkdown(html);
      const kw = Array.isArray(a.keywords) && a.keywords.length ? `**Keywords:** ${a.keywords.join(", ")}\n` : "";

      return `## ${title}

- **URL Canônica:** ${canonical}
- **Categoria:** ${a.knowledge_categories?.name || "—"} (${letter.toUpperCase()})
- **Atualizado:** ${a.updated_at?.split("T")[0] || ""}
- **Resumo:** ${(excerpt || "").replace(/\s+/g, " ").trim()}
${kw}
${md}

---
`;
    });

    const body = header + blocks.join("\n");

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    return new Response(`# Error generating llms-full.txt\n${String(e)}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
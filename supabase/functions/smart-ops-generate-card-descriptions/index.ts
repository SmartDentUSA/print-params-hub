// smart-ops-generate-card-descriptions
// Regenerates the public `description` of resin products in `system_a_catalog`
// into a single short sentence (≤160 chars) using Lovable AI Gateway.
// Preserves the original text in extra_data.description_original.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_LEN = 160;
const MODEL = "deepseek-chat";
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

function stripHtml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(s: string): string {
  return s
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToLen(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "") + ".";
}

async function generateDescription(apiKey: string, product: any): Promise<string> {
  const extra = product.extra_data || {};
  const benefits = Array.isArray(extra.benefits) ? extra.benefits.slice(0, 4) : [];
  const specs = Array.isArray(extra.technical_specifications)
    ? extra.technical_specifications.slice(0, 5)
    : Array.isArray(product.technical_specs)
      ? product.technical_specs.slice(0, 5)
      : [];
  const specsTxt = specs
    .map((s: any) => `${s.label || s.key || ""}: ${s.value || ""}`)
    .filter((x: string) => x.trim().length > 2)
    .join("; ");
  const original = stripHtml(extra.description_original || product.description || "").slice(0, 1200);

  const userPrompt = `Produto: ${product.name}
Categoria: ${product.product_category || ""} / ${product.product_subcategory || ""}
Benefícios: ${benefits.join("; ")}
Specs: ${specsTxt}
Descrição original: ${original}

Gere a frase agora.`;

  const systemPrompt = `Você escreve descrições curtas e técnicas para cards de catálogo de resinas odontológicas 3D.
REGRAS ESTRITAS:
- Exatamente 1 frase em português.
- Máximo ${MAX_LEN} caracteres (incluindo pontuação).
- Estrutura: indicação clínica + 1 diferencial técnico (viscosidade, cor, comprimento de onda, compatibilidade, biocompatibilidade, etc.).
- PROIBIDO: preços, valores, R$, CTAs, "compre", "saiba mais", aspas, emojis, listas, links, marcas concorrentes.
- Não comece com o nome do produto.
- Tom técnico-clínico, objetivo, sem adjetivos vazios ("incrível", "revolucionário").
- Responda APENAS com a frase, nada mais.`;

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  return trimToLen(clean(stripHtml(raw)), MAX_LEN);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_KEY) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: any = {};
    try { body = await req.json(); } catch { /* GET / empty */ }
    const url = new URL(req.url);
    const dryRun = body.dry_run ?? url.searchParams.get("dry_run") === "true";
    const slug = body.slug ?? url.searchParams.get("slug");
    const force = body.force ?? url.searchParams.get("force") === "true";

    let q = supabase
      .from("system_a_catalog")
      .select("id, name, slug, description, product_category, product_subcategory, technical_specs, extra_data")
      .eq("active", true)
      .eq("approved", true)
      .eq("visible_in_ui", true);

    if (slug) {
      q = q.eq("slug", slug);
    } else {
      q = q.or("product_category.ilike.%resina%,product_subcategory.ilike.%resina%,name.ilike.%resina%");
    }

    const { data: products, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    const failures: any[] = [];
    let updated = 0;

    for (const p of products || []) {
      try {
        const currentLen = (p.description || "").length;
        if (!force && currentLen > 0 && currentLen <= MAX_LEN + 20 && !slug) {
          results.push({ slug: p.slug, skipped: "already_short", len: currentLen });
          continue;
        }

        const newDesc = await generateDescription(DEEPSEEK_KEY, p);
        if (!newDesc || newDesc.length < 20) {
          failures.push({ slug: p.slug, error: "empty_or_too_short", generated: newDesc });
          continue;
        }

        results.push({ slug: p.slug, name: p.name, new: newDesc, len: newDesc.length });

        if (!dryRun) {
          const extra = p.extra_data || {};
          if (!extra.description_original) {
            extra.description_original = p.description || null;
          }
          extra.description_generated_at = new Date().toISOString();
          extra.description_generated_by = MODEL;

          const { error: upErr } = await supabase
            .from("system_a_catalog")
            .update({ description: newDesc, extra_data: extra })
            .eq("id", p.id);
          if (upErr) {
            failures.push({ slug: p.slug, error: String(upErr.message || upErr) });
          } else {
            updated++;
          }
        }

        await new Promise((r) => setTimeout(r, 800));
      } catch (e) {
        failures.push({ slug: p.slug, error: String((e as Error).message || e) });
        const msg = String((e as Error).message || "");
        if (msg.includes("429") || msg.includes("402")) {
          break;
        }
      }
    }

    try {
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-generate-card-descriptions",
        severity: failures.length ? "warning" : "info",
        error_type: dryRun ? "dry_run" : "generated",
        details: {
          processed: products?.length || 0,
          updated,
          failures: failures.length,
          slug: slug || null,
        },
      });
    } catch {}

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      processed: products?.length || 0,
      updated,
      skipped: results.filter(r => r.skipped).length,
      failures,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-card-descriptions] error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
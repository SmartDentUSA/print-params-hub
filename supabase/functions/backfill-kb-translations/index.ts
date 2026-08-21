/**
 * backfill-kb-translations
 *
 * Traduz em lote os artigos da Base de Conhecimento que ainda não têm
 * versão EN/ES persistida (title_en/content_html_en ou title_es/content_html_es
 * nulos). Hoje a tradução só acontece de forma reativa — quando um visitante
 * real abre o artigo naquele idioma (ver KnowledgeContentViewer.tsx) — o que
 * deixa `llms-full.txt?lang=en|es` e o seo-proxy (bots sem JS) sem conteúdo
 * real em boa parte dos artigos até alguém visitar cada um manualmente.
 *
 * Esta função fecha essa lacuna processando um lote pequeno por invocação
 * (cada item é uma chamada de IA via translate-content) — pensada para ser
 * chamada repetidamente por um pg_cron (ver migração correspondente) até o
 * backlog zerar, e também pode ser chamada manualmente por um admin.
 *
 * Auth: aceita chamadas do pg_cron via header `x-cron-key` (comparado com o
 * secret KB_TRANSLATION_CRON_KEY) ou de um usuário autenticado normal
 * (Authorization: Bearer <jwt>) — mesmo padrão de training-testimonial-auto-process.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cada item é uma chamada de IA (pode levar dezenas de segundos) — lote
// pequeno para não estourar o timeout da edge function.
const BATCH_SIZE_MAX = 5;

function safeEqualSecret(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Lang = "en" | "es";

async function translateOne(
  sb: ReturnType<typeof createClient>,
  content: { id: string; title: string; excerpt: string | null; content_html: string | null; faqs: unknown },
  lang: Lang,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: content.title,
      excerpt: content.excerpt,
      htmlContent: content.content_html,
      faqs: content.faqs,
      targetLanguage: lang,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`translate-content (${lang}) HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();

  const langSuffix = lang === "en" ? "_en" : "_es";
  const updatePayload: Record<string, unknown> = {};
  if (data.translatedTitle) updatePayload[`title${langSuffix}`] = data.translatedTitle;
  if (data.translatedExcerpt) updatePayload[`excerpt${langSuffix}`] = data.translatedExcerpt;
  if (data.translatedHTML) updatePayload[`content_html${langSuffix}`] = data.translatedHTML;
  if (data.translatedFAQs) updatePayload[`faqs${langSuffix}`] = data.translatedFAQs;

  // title + content_html são os dois campos que definem "hasTranslation"
  // em seo-proxy/KnowledgeSEOHead/llms-full-txt — sem os dois, não conta.
  if (!updatePayload[`title${langSuffix}`] || !updatePayload[`content_html${langSuffix}`]) {
    throw new Error(`translate-content (${lang}) returned incomplete translation for ${content.id}`);
  }

  const { error } = await sb.from("knowledge_contents").update(updatePayload).eq("id", content.id);
  if (error) throw new Error(`DB update failed for ${content.id} (${lang}): ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronKey = (Deno.env.get("KB_TRANSLATION_CRON_KEY") || "").trim();
  const headerCron = (req.headers.get("x-cron-key") || "").trim();
  const isCron = Boolean(cronKey && headerCron && safeEqualSecret(headerCron, cronKey));
  if (!isCron) {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ") || authHeader.slice(7).trim().length === 0) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const limit = Math.max(1, Math.min(Number(body.limit) || 3, BATCH_SIZE_MAX));
  const langsRequested: Lang[] = body.lang === "en" ? ["en"] : body.lang === "es" ? ["es"] : ["en", "es"];

  const results: Array<Record<string, unknown>> = [];
  let processed = 0;

  try {
    for (const lang of langsRequested) {
      if (processed >= limit) break;
      const titleCol = lang === "en" ? "title_en" : "title_es";
      const htmlCol = lang === "en" ? "content_html_en" : "content_html_es";

      const { data: pending, error } = await sb
        .from("knowledge_contents")
        .select("id, title, excerpt, content_html, faqs")
        .eq("active", true)
        .or(`${titleCol}.is.null,${htmlCol}.is.null`)
        .order("updated_at", { ascending: false })
        .limit(limit - processed);

      if (error) {
        results.push({ lang, error: error.message });
        continue;
      }

      for (const content of (pending || []) as any[]) {
        try {
          await translateOne(sb, content, lang);
          results.push({ lang, id: content.id, status: "ok" });
        } catch (e) {
          results.push({ lang, id: content.id, status: "error", error: String(e) });
        }
        processed++;
      }
    }

    const [{ count: remainingEn }, { count: remainingEs }] = await Promise.all([
      sb.from("knowledge_contents").select("id", { count: "exact", head: true }).eq("active", true).or("title_en.is.null,content_html_en.is.null"),
      sb.from("knowledge_contents").select("id", { count: "exact", head: true }).eq("active", true).or("title_es.is.null,content_html_es.is.null"),
    ]);

    return new Response(
      JSON.stringify({ processed, remaining_en: remainingEn ?? null, remaining_es: remainingEs ?? null, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), processed, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

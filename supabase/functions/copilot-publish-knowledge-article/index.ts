/**
 * copilot-publish-knowledge-article
 *
 * Recebe { draft_id, action: "publish"|"unpublish" } e ativa/desativa o artigo.
 * Mantém Smart Merge / pipeline OG banner (já dispara via triggers existentes
 * quando active=true).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateDraft } from "../_shared/article-validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { draft_id, action = "publish" } = await req.json().catch(() => ({}));
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: art, error } = await supabase
      .from("knowledge_contents")
      .select("*, knowledge_categories(letter)")
      .eq("id", draft_id).single();
    if (error || !art) {
      return new Response(JSON.stringify({ error: "artigo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unpublish") {
      await supabase.from("knowledge_contents").update({ active: false }).eq("id", draft_id);
      return new Response(JSON.stringify({ success: true, status: "archived", id: draft_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-valida antes de publicar
    const v = validateDraft({
      title: art.title, slug: art.slug, meta_description: art.meta_description,
      excerpt: art.excerpt, body_md: art.content_html, category_letter: art.knowledge_categories?.letter,
      keywords: art.keywords || [], faqs: art.faqs || [],
    });
    if (!v.ok) {
      return new Response(JSON.stringify({ error: "validation_failed", errors: v.errors }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await supabase
      .from("knowledge_contents")
      .update({ active: true })
      .eq("id", draft_id);
    if (upErr) throw new Error(upErr.message);

    // Pós-processamento fire-and-forget: reformatar HTML com IA (idempotente
    // via content_html_reformatted_at). Não bloqueia o publish: se falhar, o
    // artigo já está publicado e pode ser re-reformatado manualmente no Admin.
    try {
      fetch(`${SUPABASE_URL}/functions/v1/reformat-article-html`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ contentId: draft_id }),
      }).catch((e) => console.warn("[copilot-publish] reformat trigger failed:", (e as Error).message));
    } catch (e) {
      console.warn("[copilot-publish] reformat dispatch error:", (e as Error).message);
    }

    const letter = String(art.knowledge_categories?.letter || "C").toLowerCase();
    return new Response(JSON.stringify({
      success: true, status: "published", id: draft_id, title: art.title,
      url: `/base-conhecimento/${letter}/${art.slug}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
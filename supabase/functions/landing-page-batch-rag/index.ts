// Popula em lote as landing pages dos formulários com dados reais do produto
// (RAG: system_a_catalog + products_catalog), reaproveitando landing-page-generator
// em modo "rag". A landing page do exocad DentalCAD RMS é PROTEGIDA e nunca é tocada.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Nunca tocar: landing page curada manualmente.
const PROTECTED_SLUGS = ["exocad_dentalcad_rms"];
const PROTECTED_RE = /exocad|dentalcad|ultimate\s*lab\s*bundle/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(6, Number(body?.limit ?? 3)));
    const force = body?.force === true;          // regenera mesmo se já tem conteúdo
    const onlySlug: string | null = body?.slug ?? null;
    const publish = body?.publish !== false;     // por padrão publica

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = admin
      .from("smartops_forms")
      .select("id,name,slug,product_catalog_id,active")
      .eq("active", true)
      .not("product_catalog_id", "is", null)
      .order("name");
    if (onlySlug) q = q.eq("slug", onlySlug);
    const { data: forms, error: formsErr } = await q;
    if (formsErr) throw formsErr;

    const { data: existing } = await admin
      .from("smartops_form_landing_pages")
      .select("id,form_id,content,status");
    const byForm = new Map<string, any>();
    for (const row of existing ?? []) byForm.set((row as any).form_id, row);

    const candidates = (forms ?? []).filter((f: any) => {
      if (PROTECTED_SLUGS.includes(f.slug) || PROTECTED_RE.test(f.name || "")) return false;
      const lp = byForm.get(f.id);
      const hasContent = lp?.content && (lp.content as any)?.hero;
      return force || !hasContent;
    });

    const results: Array<Record<string, unknown>> = [];
    const skipped = (forms ?? []).length - candidates.length;

    for (const form of candidates.slice(0, limit)) {
      try {
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/landing-page-generator`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ form_id: (form as any).id, mode: "rag" }),
        });
        const payload = await genRes.json().catch(() => null);
        if (!genRes.ok || !payload?.content?.hero) {
          results.push({
            slug: (form as any).slug,
            ok: false,
            error: payload?.error ?? `http_${genRes.status}`,
          });
          continue;
        }

        // Imagem do produto no catálogo como hero.
        const { data: sysA } = await admin
          .from("system_a_catalog")
          .select("image_url")
          .eq("id", (form as any).product_catalog_id)
          .maybeSingle();
        const heroImage = (sysA as any)?.image_url ?? null;

        const lp = byForm.get((form as any).id);
        const now = new Date().toISOString();
        const record: Record<string, unknown> = {
          form_id: (form as any).id,
          mode: "rag",
          content: payload.content,
          hero_image_url: heroImage,
          status: publish ? "published" : "draft",
          published_at: publish ? now : null,
          updated_at: now,
        };

        if (lp) {
          const { error } = await admin
            .from("smartops_form_landing_pages")
            .update(record)
            .eq("id", (lp as any).id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("smartops_form_landing_pages").insert(record);
          if (error) throw error;
        }

        results.push({ slug: (form as any).slug, ok: true, sections: Object.keys(payload.content).length });
      } catch (e) {
        results.push({ slug: (form as any).slug, ok: false, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        remaining: Math.max(0, candidates.length - results.length),
        skipped_protected_or_done: skipped,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

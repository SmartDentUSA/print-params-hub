/**
 * sync-content-from-a
 * Importa conteúdo de marketing do Sistema A para system_a_content_library
 * usando o endpoint público `knowledge-export-full` (produtos + messages
 * CS/aftersales + google_ads + seo + videos). Mantém fallback via content_bridge.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KNOWLEDGE_EXPORT_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full";

type Row = Record<string, unknown>;

function truncate(s: string | null | undefined, max = 4000): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function buildProductRows(p: any, now: string): Row[] {
  const rows: Row[] = [];
  const base = {
    product_id: p.id ?? null,
    product_name: p.name ?? null,
    product_slug: p.slug ?? null,
    product_category: p.category ?? null,
    media_url: p.image_url || null,
    thumbnail_url: p.image_url || null,
    cta_url: p.ctas?.product_url || null,
    tags: Array.isArray(p.tags) ? p.tags : null,
    is_active: true,
    quality_score: typeof p.completion_score === "number" ? p.completion_score : null,
    synced_at: now,
    system_a_updated_at: p.updated_at || p.created_at || null,
  };

  // 1) Overview do produto (descrição + benefícios)
  const benefits = Array.isArray(p.benefits) ? p.benefits.slice(0, 8).join("\n• ") : "";
  const features = Array.isArray(p.features) ? p.features.slice(0, 6).join("\n• ") : "";
  const overviewParts = [
    p.description ? String(p.description).trim() : "",
    benefits ? `Benefícios:\n• ${benefits}` : "",
    features ? `Características:\n• ${features}` : "",
    p.target_audience ? `Público: ${p.target_audience}` : "",
  ].filter(Boolean);
  if (overviewParts.length) {
    rows.push({
      ...base,
      source_table: "knowledge_export_product",
      source_id: `${p.slug}:overview`,
      content_type: "product",
      channel: "web",
      title: `${p.name} — Overview`,
      content_text: truncate(overviewParts.join("\n\n"), 6000),
      content_data: { keywords: p.keywords, applications: p.applications, faq: p.faq },
    });
  }

  // 2) Mensagens CS/aftersales/spin (WhatsApp)
  const msgGroups: Array<{ key: string; type: string }> = [
    { key: "cs", type: "cs" },
    { key: "aftersales", type: "aftersales" },
    { key: "spin", type: "spin" },
  ];
  for (const g of msgGroups) {
    const list = (p.messages?.[g.key] as any[] | undefined) ?? [];
    for (const m of list) {
      const text = truncate(m.message_content, 4000);
      if (!text || text === "Digite sua mensagem aqui...") continue;
      const order = m.message_order ?? m.order ?? m.id;
      rows.push({
        ...base,
        source_table: `knowledge_export_${g.key}`,
        source_id: `${p.slug}:${order}`,
        content_type: g.type,
        channel: "whatsapp",
        title: `${p.name} — ${g.type.toUpperCase()} #${order}`,
        content_text: text,
        content_data: { message_order: order, raw: m },
        is_active: m.is_active !== false,
      });
    }
  }

  // 3) Google Ads (headlines + descrições)
  const gAds = Array.isArray(p.google_ads) ? p.google_ads : [];
  gAds.forEach((ad: any, idx: number) => {
    const headlines = Array.isArray(ad.headlines) ? ad.headlines.join(" | ") : (ad.headline || "");
    const descs = Array.isArray(ad.descriptions) ? ad.descriptions.join("\n") : (ad.description || "");
    const text = truncate([headlines, descs].filter(Boolean).join("\n\n"), 2000);
    if (!text) return;
    rows.push({
      ...base,
      source_table: "knowledge_export_google_ads",
      source_id: `${p.slug}:ad:${ad.id ?? idx}`,
      content_type: "google_ads",
      channel: "google_ads",
      title: `${p.name} — Ad ${idx + 1}`,
      content_text: text,
      content_data: { raw: ad },
    });
  });

  // 4) SEO description
  const seoDesc = truncate(p.seo?.seo_description, 1000);
  if (seoDesc) {
    rows.push({
      ...base,
      source_table: "knowledge_export_seo",
      source_id: `${p.slug}:seo`,
      content_type: "seo",
      channel: "blog",
      title: p.seo?.seo_title || `${p.name} — SEO`,
      content_text: seoDesc,
      content_data: { canonical_url: p.seo?.canonical_url ?? null },
    });
  }

  // 5) Videos (YouTube/Instagram/TikTok)
  const vidGroups = ["youtube", "instagram", "tiktok", "testimonial", "technical"];
  for (const vg of vidGroups) {
    const vids = (p.videos?.[vg] as any[] | undefined) ?? [];
    for (const v of vids) {
      const text = truncate(v.description || v.caption || v.title, 2000);
      if (!text && !v.url) continue;
      rows.push({
        ...base,
        source_table: `knowledge_export_video_${vg}`,
        source_id: `${p.slug}:vid:${v.id ?? v.url ?? v.title}`,
        content_type: "video",
        channel: vg === "youtube" ? "youtube" : vg,
        title: v.title || `${p.name} — Video ${vg}`,
        content_text: text,
        media_url: v.url || base.media_url,
        thumbnail_url: v.thumbnail_url || base.thumbnail_url,
        content_data: { raw: v },
      });
    }
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let totalInserted = 0;
    let totalErrors = 0;
    let productsProcessed = 0;
    const now = new Date().toISOString();

    // === Pull from knowledge-export-full (public endpoint) ===
    try {
      const exportRes = await fetch(KNOWLEDGE_EXPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500, approved_only: false }),
      });
      if (!exportRes.ok) {
        console.error("[sync-content] knowledge-export-full HTTP", exportRes.status);
        totalErrors++;
      } else {
        const json = await exportRes.json();
        const products: any[] = Array.isArray(json?.products) ? json.products : [];
        productsProcessed = products.length;

        const allRows: Row[] = [];
        for (const p of products) {
          try {
            allRows.push(...buildProductRows(p, now));
          } catch (e) {
            console.error("[sync-content] buildProductRows error:", p?.slug, e);
            totalErrors++;
          }
        }

        // Upsert em lotes de 200 para evitar payloads gigantes
        const BATCH = 200;
        for (let i = 0; i < allRows.length; i += BATCH) {
          const slice = allRows.slice(i, i + BATCH);
          const { error: upErr } = await supabase
            .from("system_a_content_library")
            .upsert(slice, {
              onConflict: "source_table,source_id,channel",
              ignoreDuplicates: false,
            });
          if (upErr) {
            console.error("[sync-content] upsert batch error:", upErr.message);
            totalErrors++;
          } else {
            totalInserted += slice.length;
          }
        }
      }
    } catch (e) {
      console.error("[sync-content] export fetch failed:", e);
      totalErrors++;
    }

    // Also sync from content_bridge (always available locally)
    try {
      const { data: bridgeRows, error: bridgeErr } = await supabase
        .from("content_bridge")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!bridgeErr && bridgeRows?.length) {
        const bridgeMapped = bridgeRows.map((r: any) => ({
          source_table: r.sistema_a_source_table || "content_bridge",
          source_id: r.sistema_a_source_id || r.id,
          product_name: r.product_name || null,
          product_slug: r.product_slug || null,
          product_category: r.product_category || null,
          content_type: r.content_type || r.canal || "campaign",
          channel: r.canal || "whatsapp",
          title: r.titulo || "Conteúdo importado",
          content_text: r.content_text || r.content_html || null,
          content_data: { bridge_id: r.id, extra: r.extra_data },
          media_url: r.media_url || null,
          thumbnail_url: r.thumbnail_url || null,
          cta_url: r.cta_url || null,
          is_active: r.status === "published" || r.approved === true,
          synced_at: now,
          system_a_updated_at: r.sistema_a_updated_at || r.updated_at || null,
        }));

        const { error: upsertErr2 } = await supabase
          .from("system_a_content_library")
          .upsert(bridgeMapped, {
            onConflict: "source_table,source_id,channel",
            ignoreDuplicates: false,
          });

        if (upsertErr2) {
          console.error("[sync-content] Bridge upsert error:", upsertErr2.message);
          totalErrors++;
        } else {
          totalInserted += bridgeMapped.length;
        }
      }
    } catch (e) {
      console.error("[sync-content] Bridge sync error:", e);
    }

    console.log(
      `[sync-content] Done: ${productsProcessed} products, ${totalInserted} rows upserted, ${totalErrors} errors`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        results: {
          inserted: totalInserted,
          products_processed: productsProcessed,
          errors: totalErrors,
        },
        synced_at: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[sync-content] Fatal:", err);
    return new Response(
      JSON.stringify({ error: String(err), ok: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

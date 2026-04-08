/**
 * sync-content-from-a
 * Importa conteúdo de marketing do Sistema A para system_a_content_library.
 * Busca de múltiplas tabelas do Sistema A e faz upsert local.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SISTEMA_A_URL = "https://pgfgripuanuwwolmtknn.supabase.co";
const SISTEMA_A_ANON_KEY = Deno.env.get("SISTEMA_A_ANON_KEY") ?? "";

// Source tables to pull from Sistema A
const SOURCE_TABLES = [
  { table: "capcut_kits", content_type: "campaign", channel: "whatsapp" },
  { table: "blog_posts", content_type: "blog", channel: "blog" },
  { table: "landing_pages", content_type: "landing_page", channel: "web" },
  {
    table: "spin_selling_solutions",
    content_type: "spin",
    channel: "whatsapp",
  },
  { table: "aftersales_messages", content_type: "aftersales", channel: "whatsapp" },
  { table: "cs_messages", content_type: "cs", channel: "whatsapp" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // If Sistema A key is not set, try to pull from content_bridge as fallback
    const hasSystemAKey = !!SISTEMA_A_ANON_KEY;

    let totalInserted = 0;
    let totalErrors = 0;
    const now = new Date().toISOString();

    if (hasSystemAKey) {
      // Pull directly from Sistema A tables
      const sistemaA = createClient(SISTEMA_A_URL, SISTEMA_A_ANON_KEY);

      for (const src of SOURCE_TABLES) {
        try {
          const { data: rows, error } = await sistemaA
            .from(src.table)
            .select("*")
            .limit(500);

          if (error) {
            console.error(`[sync-content] Error fetching ${src.table}:`, error.message);
            totalErrors++;
            continue;
          }

          if (!rows?.length) continue;

          const mapped = rows.map((r: any) => ({
            source_table: src.table,
            source_id: String(r.id),
            product_id: r.product_id || r.produto_id || null,
            product_name: r.product_name || r.produto_nome || r.nome_produto || null,
            product_slug: r.product_slug || r.slug || null,
            product_category: r.product_category || r.categoria || null,
            content_type: src.content_type,
            channel: r.channel || src.channel,
            title: r.title || r.titulo || r.name || r.nome || `${src.table} #${r.id}`,
            content_text: r.content_text || r.texto || r.body || r.mensagem || r.content || null,
            content_data: r,
            landing_page_url: r.landing_page_url || r.url || null,
            cta_url: r.cta_url || r.link || null,
            media_url: r.media_url || r.image_url || r.video_url || null,
            thumbnail_url: r.thumbnail_url || r.thumb || null,
            tags: r.tags || null,
            is_active: r.is_active ?? r.ativo ?? true,
            quality_score: r.quality_score ?? null,
            synced_at: now,
            system_a_updated_at: r.updated_at || r.created_at || null,
          }));

          const { error: upsertErr } = await supabase
            .from("system_a_content_library")
            .upsert(mapped, {
              onConflict: "source_table,source_id",
              ignoreDuplicates: false,
            });

          if (upsertErr) {
            console.error(`[sync-content] Upsert error for ${src.table}:`, upsertErr.message);
            totalErrors++;
          } else {
            totalInserted += mapped.length;
          }
        } catch (e) {
          console.error(`[sync-content] Exception on ${src.table}:`, e);
          totalErrors++;
        }
      }
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
            onConflict: "source_table,source_id",
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
      `[sync-content] Done: ${totalInserted} inserted, ${totalErrors} errors`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        results: { inserted: totalInserted, errors: totalErrors },
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

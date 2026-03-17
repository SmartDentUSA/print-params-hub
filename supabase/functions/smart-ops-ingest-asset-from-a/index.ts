/**
 * smart-ops-ingest-asset-from-a
 * Receives marketing assets (landing pages, blog posts, whatsapp templates)
 * fired from Sistema A and stores them in Sistema B tables.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const payload = await req.json();
    console.log("[ingest-asset-from-a] Received:", JSON.stringify(payload).slice(0, 500));

    const assetType = payload.asset_type;
    if (!assetType) {
      return new Response(JSON.stringify({ error: "asset_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: { error: unknown } = { error: null };

    if (assetType === "whatsapp_template") {
      // Upsert into whatsapp_templates
      const { error } = await supabase.from("whatsapp_templates").upsert({
        template_name: payload.template_name || payload.title || "unnamed",
        template_category: payload.template_category || "utility",
        language_code: payload.language_code || "pt_BR",
        header_type: payload.header_type || null,
        header_content: payload.header_content || null,
        body_text: payload.body_text || payload.content || "",
        footer_text: payload.footer_text || null,
        buttons: payload.buttons || null,
        variables: payload.variables || null,
        status: payload.status || "draft",
        source_system: "sistema_a",
        source_id: payload.source_id || null,
        related_product_ids: payload.related_product_ids || null,
        metadata: payload.metadata || null,
      }, { onConflict: "template_name,language_code" });
      result = { error };
    } else {
      // marketing_assets: landing_page, blog_post, social_post, etc.
      const { error } = await supabase.from("marketing_assets").upsert({
        asset_type: assetType,
        title: payload.title || "Untitled",
        slug: payload.slug || null,
        url: payload.url || null,
        content_html: payload.content_html || null,
        content_json: payload.content_json || null,
        status: payload.status || "published",
        source_system: "sistema_a",
        source_id: payload.source_id || null,
        related_product_ids: payload.related_product_ids || null,
        related_lead_segments: payload.related_lead_segments || null,
        campaign_id: payload.campaign_id || null,
        campaign_name: payload.campaign_name || null,
        performance_data: payload.performance_data || null,
        metadata: payload.metadata || null,
        published_at: payload.published_at || new Date().toISOString(),
      }, { onConflict: "id" });
      result = { error };
    }

    if (result.error) {
      console.error("[ingest-asset-from-a] DB error:", result.error);
      try {
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-ingest-asset-from-a",
          severity: "error",
          error_type: "asset_upsert_failed",
          details: { asset_type: assetType, error: String(result.error), title: payload.title },
        });
      } catch {}
      return new Response(JSON.stringify({ error: String(result.error) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "smart-ops-ingest-asset-from-a",
        severity: "info",
        error_type: "asset_ingested",
        details: { asset_type: assetType, title: payload.title, source_id: payload.source_id },
      });
    } catch {}

    console.log("[ingest-asset-from-a] OK:", assetType, payload.title);
    return new Response(JSON.stringify({ success: true, asset_type: assetType }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ingest-asset-from-a] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

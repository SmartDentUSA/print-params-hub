import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { migrateLegacyTags } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const payload = await req.json();
    console.log("[sellflux-webhook] Payload:", JSON.stringify(payload).slice(0, 600));

    // --- Extract fields with flexible mapping ---
    const email = payload.email || payload.e_mail || "";
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nome = payload.name || payload.nome || payload.full_name || "Sem nome";
    const phone = payload.phone || payload.telefone || payload.celular || null;
    const cidade = payload.city || payload.cidade || null;
    const uf = payload.state || payload.uf || payload.estado || null;

    // --- Process tags ---
    const rawTags: string[] = Array.isArray(payload.tags)
      ? payload.tags
      : typeof payload.tags === "string"
        ? payload.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [];

    let extractedFields: Record<string, string> = {};
    let standardizedTags: string[] = [];

    if (rawTags.length > 0) {
      const migration = migrateLegacyTags(rawTags);
      standardizedTags = migration.standardizedTags;
      extractedFields = migration.extractedFields;
      if (migration.unmappedTags.length > 0) {
        console.log("[sellflux-webhook] Unmapped tags:", migration.unmappedTags);
      }
    }

    // --- Build normalized payload for ingest-lead ---
    const normalizedPayload: Record<string, unknown> = {
      email,
      full_name: nome,
      phone_number: phone,
      source: "sellflux_webhook",
      utm_source: payload.utm_source || "sellflux",
      utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null,
      form_name: payload.form_name || payload.automation_name || "sellflux_webhook",
      // Location
      ...(cidade ? { cidade } : {}),
      ...(uf ? { uf } : {}),
      // Extracted from tags
      ...(extractedFields.area_atuacao ? { "area de atuacao": extractedFields.area_atuacao } : {}),
      ...(extractedFields.tem_impressora ? { "impressoes 3d": extractedFields.tem_impressora } : {}),
      ...(extractedFields.tem_scanner ? { tem_scanner: extractedFields.tem_scanner } : {}),
      // Custom fields passthrough
      ...(payload.especialidade ? { especialidade: payload.especialidade } : {}),
      ...(payload.produto_interesse ? { produto_interesse: payload.produto_interesse } : {}),
      ...(payload.impressora_modelo ? { impressora_modelo: payload.impressora_modelo } : {}),
      ...(payload.resina_interesse ? { resina_interesse: payload.resina_interesse } : {}),
      // Tags for CRM sync
      ...(standardizedTags.length > 0 ? { tags_crm: standardizedTags } : {}),
      // Keep original payload reference
      _sellflux_raw: payload,
    };

    // --- Forward to ingest-lead ---
    const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(normalizedPayload),
    });

    const ingestBody = await ingestRes.text();
    console.log("[sellflux-webhook] ingest-lead response:", ingestRes.status, ingestBody.slice(0, 300));

    // --- Log to system_health_logs ---
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-sellflux-webhook",
      severity: ingestRes.ok ? "info" : "warning",
      error_type: ingestRes.ok ? "webhook_received" : "ingest_failed",
      lead_email: email,
      details: {
        tags_count: rawTags.length,
        standardized_tags: standardizedTags,
        extracted_fields: extractedFields,
        ingest_status: ingestRes.status,
      },
    }).catch(() => {});

    return new Response(ingestBody, {
      status: ingestRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sellflux-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

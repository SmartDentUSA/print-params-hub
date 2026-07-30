import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeZernioLead,
  mapFormToProduct,
} from "../_shared/zernio-field-normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zernio-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Payload confirmado via OpenAPI da Zernio:
// payload.event = "lead.received"
// payload.id = delivery id (varia a cada reentrega, NÃO usar como chave)
// payload.lead.id = ID interno Zernio (NÃO é o leadgen_id do Meta)
// payload.lead.leadgenId = leadgen_id nativo do Meta (chave de dedup)
interface ZernioLeadReceivedPayload {
  event: string;
  id: string;
  lead: {
    id: string;
    leadgenId: string;
    formId?: string;
    formName?: string;
    campaignName?: string;
    adsetName?: string;
    adName?: string;
    campaignId?: string;
    adsetId?: string;
    adId?: string;
    fields: Record<string, string>;
  };
  account?: {
    platform?: string;
  };
}

async function verifyZernioSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("x-late-signature");
  const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET");
  if (!signature || !secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === signature;
}

// ── Pipeline movido para background. Conteúdo idêntico ao anterior. ──
async function processLead(
  payload: ZernioLeadReceivedPayload,
  leadgenId: string,
  supabase: ReturnType<typeof createClient>,
  SUPABASE_URL: string,
  SERVICE_ROLE_KEY: string,
) {
  try {
    const normalized = normalizeZernioLead(payload.lead.fields ?? {}, {
      campaignId: payload.lead?.campaignId ?? null,
      adsetId: payload.lead?.adsetId ?? null,
      adId: payload.lead?.adId ?? null,
      platform: payload.account?.platform ?? null,
    });
    const productMapping = mapFormToProduct(payload.lead.formId);

    const ingestResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          source: "meta_lead_ads",
          new_conversion_confirmed: true,
          conversion_key: `meta_leadgen:${leadgenId}`,
          form_name: payload.lead.formName ?? productMapping?.originSystemB ?? null,
          origem_campanha: payload.lead.campaignName ?? payload.lead.formName ?? productMapping?.originSystemB ?? null,
          utm_source: "facebook",
          utm_medium: "paid",
          utm_campaign: payload.lead.campaignName ?? (payload.lead.formId ? `form_${payload.lead.formId}` : null),
          utm_content: payload.lead.adName ?? null,
          utm_term: payload.lead.adsetName ?? null,
          meta_campaign_name: payload.lead.campaignName ?? null,
          meta_adset_name: payload.lead.adsetName ?? null,
          meta_ad_name: payload.lead.adName ?? null,
          meta_form_id: payload.lead.formId ?? null,
          meta_leadgen_id: leadgenId,
          full_name: normalized.fullName,
          email: normalized.email,
          phone_number: normalized.phone,
          area_atuacao: normalized.areaAtuacao,
          especialidade: normalized.especialidade,
          como_digitaliza: normalized.scanner?.label ?? null,
          scanner_marca: normalized.scanner?.label ?? null,
          tem_scanner: normalized.scanner?.status === "nao_digitaliza" ? "não" : (normalized.scanner?.label ? "sim" : null),
          tem_impressora: normalized.impressora?.status === "nao_tem" ? "não" : (normalized.impressora?.label ? "sim" : null),
          impressora_modelo: normalized.impressora?.label ?? null,
          produto_interesse: productMapping?.productName ?? null,
          produto_interesse_auto: productMapping?.productName ?? null,
          leadgen_id: leadgenId,
          needs_manual_review: normalized.needsManualReview,
          zernio_delivery_id: payload.id,
          zernio_lead_id: payload.lead.id,
          platform_campaign_id: normalized.platform_campaign_id,
          platform_adgroup_id: normalized.platform_adgroup_id,
          platform_ad_id: normalized.platform_ad_id,
          meta_platform: normalized.meta_platform,
          _zernio_extras: normalized.extras,
        }),
      },
    );

    if (!ingestResponse.ok) {
      const errText = await ingestResponse.text();
      throw new Error(`ingest-lead failed: ${ingestResponse.status} ${errText}`);
    }

    const ingestResult = await ingestResponse.json();

    const leadId = ingestResult?.lead_id ?? null;
    if (!leadId) {
      throw new Error(
        `ingest-lead retornou 200 sem lead_id: ${JSON.stringify(ingestResult)}`,
      );
    }

    await supabase
      .from("zernio_leadgen_dedup")
      .update({
        lead_id: leadId,
        process_status: "done",
        completed_at: new Date().toISOString(),
        process_error: null,
      })
      .eq("leadgen_id", leadgenId);
  } catch (err) {
    console.error(`[smart-ops-zernio-lead-webhook] erro ingest para ${leadgenId}:`, err);

    const { data: current } = await supabase
      .from("zernio_leadgen_dedup")
      .select("retry_count")
      .eq("leadgen_id", leadgenId)
      .maybeSingle();

    await supabase
      .from("zernio_leadgen_dedup")
      .update({
        process_status: "failed",
        process_error: String(err).slice(0, 2000),
        retry_count: (current?.retry_count ?? 0) + 1,
      })
      .eq("leadgen_id", leadgenId);

    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-zernio-lead-webhook",
      status: "error",
      error_message: String(err).slice(0, 2000),
      metadata: { leadgen_id: leadgenId, zernio_delivery_id: payload.id },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();

  const isValid = await verifyZernioSignature(req, rawBody);
  if (!isValid) {
    console.error("[smart-ops-zernio-lead-webhook] assinatura inválida");
    return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: ZernioLeadReceivedPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payload.event !== "lead.received") {
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadgenId = payload.lead?.leadgenId;
  if (!leadgenId) {
    console.error("[smart-ops-zernio-lead-webhook] payload sem lead.leadgenId", payload);
    return new Response(JSON.stringify({ success: false, error: "missing_leadgen_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Dedup atômico via PK: reentrega do mesmo leadgen_id retorna 200 idempotente.
  const { error: dedupError } = await supabase
    .from("zernio_leadgen_dedup")
    .insert({
      leadgen_id: leadgenId,
      zernio_lead_id: payload.lead.id,
      first_delivery_id: payload.id,
      process_status: "pending",
      raw_payload: payload,
    });

  if (dedupError) {
    if (dedupError.code === "23505") {
      return new Response(
        JSON.stringify({ success: true, deduped: true, leadgen_id: leadgenId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.error("[smart-ops-zernio-lead-webhook] erro no dedup insert:", dedupError);
    return new Response(JSON.stringify({ success: false, error: dedupError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Aceita imediatamente e processa em background (limite Zernio: 5s por tentativa).
  const work = processLead(payload, leadgenId, supabase, SUPABASE_URL, SERVICE_ROLE_KEY);
  // @ts-ignore EdgeRuntime é global no runtime Supabase
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return new Response(
    JSON.stringify({ success: true, accepted: true, leadgen_id: leadgenId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

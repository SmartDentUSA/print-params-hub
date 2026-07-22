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
    fields: Record<string, string>;
  };
}

async function verifyZernioSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("x-zernio-signature");
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

  const normalized = normalizeZernioLead(payload.lead.fields ?? {});
  const productMapping = mapFormToProduct(payload.lead.formId);

  try {
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
          _zernio_extras: normalized.extras,
        }),
      },
    );

    if (!ingestResponse.ok) {
      const errText = await ingestResponse.text();
      throw new Error(`ingest-lead failed: ${ingestResponse.status} ${errText}`);
    }

    const ingestResult = await ingestResponse.json();

    await supabase
      .from("zernio_leadgen_dedup")
      .update({ lead_id: ingestResult.lead_id ?? null })
      .eq("leadgen_id", leadgenId);

    return new Response(
      JSON.stringify({ success: true, lead_id: ingestResult.lead_id, needs_manual_review: normalized.needsManualReview }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[smart-ops-zernio-lead-webhook] erro ingest para ${leadgenId}:`, err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

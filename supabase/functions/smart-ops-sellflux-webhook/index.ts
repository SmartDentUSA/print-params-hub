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

    // --- Extract SellFlux custom fields ---
    const piperunId = payload["atual-id-pipe"] || payload.atual_id_pipe || null;
    const proprietario = payload.proprietario || null;
    const platformMail = payload.platform_mail || null;
    const trainDate = payload.train_date || null;
    const scheduledBy = payload.scheduled_by || null;
    const groupTrain = payload.group_train || null;

    // Extract tracking object (from Loja Integrada via SellFlux)
    const tracking = payload.tracking || {};
    const trackingStatus = tracking.status || payload["tracking.status"] || null;
    const trackingCode = tracking.tracking || payload["tracking.tracking"] || null;
    const trackingUrl = tracking.tracking_url || payload["tracking.tracking_url"] || null;
    const shippingMethod = tracking.shipping_method || payload["tracking.shipping_method"] || null;

    // Extract transaction object
    const transaction = payload.transaction || {};
    const transactionStatus = transaction.status || payload["transaction.status"] || null;
    const transactionUrl = transaction.url || payload["transaction.url"] || null;
    const paymentMethod = transaction.payment_method || payload["transaction.payment_method"] || null;
    const productName = transaction.product_name || payload["transaction.product_name"] || null;
    const transactionValue = transaction.transaction_value || payload["transaction.transaction_value"] || null;

    // Payment codes
    const pixCode = payload.pix || null;
    const boletoCode = payload.boleto || null;

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

    // Build sellflux_custom_fields JSONB for extra data
    const sellfluxCustom: Record<string, unknown> = {};
    if (trainDate) sellfluxCustom.train_date = trainDate;
    if (scheduledBy) sellfluxCustom.scheduled_by = scheduledBy;
    if (groupTrain) sellfluxCustom.group_train = groupTrain;
    if (payload["train-dur"]) sellfluxCustom.train_dur = payload["train-dur"];
    if (payload["train-time"]) sellfluxCustom.train_time = payload["train-time"];
    if (payload["debtor-message"]) sellfluxCustom.debtor_message = payload["debtor-message"];
    if (payload["invoice-track"]) sellfluxCustom.invoice_track = payload["invoice-track"];
    if (payload["invoice-data"]) sellfluxCustom.invoice_data = payload["invoice-data"];
    if (payload.vacancy) sellfluxCustom.vacancy = payload.vacancy;
    if (pixCode) sellfluxCustom.pix = pixCode;
    if (boletoCode) sellfluxCustom.boleto = boletoCode;
    if (trackingCode) sellfluxCustom.tracking_code = trackingCode;
    if (trackingUrl) sellfluxCustom.tracking_url = trackingUrl;
    if (trackingStatus) sellfluxCustom.tracking_status = trackingStatus;
    if (shippingMethod) sellfluxCustom.shipping_method = shippingMethod;
    if (transactionStatus) sellfluxCustom.transaction_status = transactionStatus;
    if (transactionUrl) sellfluxCustom.transaction_url = transactionUrl;
    if (paymentMethod) sellfluxCustom.payment_method = paymentMethod;
    if (transactionValue) sellfluxCustom.transaction_value = transactionValue;

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
      ...(payload.produto_interesse || productName ? { produto_interesse: payload.produto_interesse || productName } : {}),
      ...(payload.impressora_modelo || payload.impressora ? { impressora_modelo: payload.impressora_modelo || payload.impressora } : {}),
      ...(payload.resina_interesse ? { resina_interesse: payload.resina_interesse } : {}),
      // PipeRun ID from SellFlux
      ...(piperunId ? { piperun_id: piperunId } : {}),
      // Proprietario
      ...(proprietario ? { proprietario_lead_crm: proprietario } : {}),
      // Platform / Astron
      ...(platformMail ? { astron_email: platformMail } : {}),
      // Training
      ...(trainDate ? { data_treinamento: trainDate } : {}),
      // Loja Integrada tracking fields
      ...(shippingMethod ? { lojaintegrada_forma_envio: shippingMethod } : {}),
      ...(paymentMethod ? { lojaintegrada_forma_pagamento: paymentMethod } : {}),
      ...(trackingStatus ? { lojaintegrada_ultimo_pedido_status: trackingStatus } : {}),
      ...(transactionValue ? { valor_oportunidade: transactionValue } : {}),
      // Tags for CRM sync
      ...(standardizedTags.length > 0 ? { tags_crm: standardizedTags } : {}),
      // SellFlux custom fields JSONB
      ...(Object.keys(sellfluxCustom).length > 0 ? { sellflux_custom_fields: sellfluxCustom } : {}),
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

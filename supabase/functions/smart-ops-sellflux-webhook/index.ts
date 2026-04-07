import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { migrateLegacyTags } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detectRealSource(payload: Record<string, unknown>, tags: string[]): { source: string; utm_source: string } {
  const hasTracking = payload.tracking && typeof payload.tracking === "object";
  const hasTransaction = payload.transaction && typeof payload.transaction === "object";
  const ecommerceTags = ["loja_integrada", "compra-realizada", "pedido-pago", "aguardandopagamento", "gerouboleto", "cancelado"];
  const hasEcommerceTags = tags.some(t => ecommerceTags.some(ec => t.toLowerCase().includes(ec)));

  if (hasTracking || hasTransaction || hasEcommerceTags) {
    return { source: "loja_integrada", utm_source: "loja_integrada" };
  }

  const automationName = payload.automation_name || payload.form_name;
  if (automationName) {
    return { source: String(automationName), utm_source: "sellflux" };
  }

  return { source: "sellflux_webhook", utm_source: "sellflux" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim().length === 0) {
      console.log("[sellflux-webhook] Empty body received, ignoring");
      return new Response(JSON.stringify({ ok: true, skipped: "empty_body" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[sellflux-webhook] Invalid JSON body:", rawBody.slice(0, 200));
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // --- Detect real source ---
    const detected = detectRealSource(payload, standardizedTags.length > 0 ? standardizedTags : rawTags);
    console.log("[sellflux-webhook] Detected source:", detected.source, "utm_source:", detected.utm_source);

    // --- Build normalized payload for ingest-lead ---
    const normalizedPayload: Record<string, unknown> = {
      email,
      full_name: nome,
      phone_number: phone,
      source: detected.source,
      utm_source: payload.utm_source || detected.utm_source,
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

    // Parse ingest response to get lead_id for timeline
    let ingestResult: Record<string, unknown> = {};
    try { ingestResult = JSON.parse(ingestBody); } catch {}
    const resolvedLeadId = ingestResult.lead_id as string | undefined;

    // --- STEP 5 FIX: Direct merge of tags_crm bypassing smartMerge ---
    if (resolvedLeadId && standardizedTags.length > 0) {
      try {
        await supabase.rpc("merge_tags_crm", {
          p_lead_id: resolvedLeadId,
          p_new_tags: standardizedTags,
        });
        console.log("[sellflux-webhook] Tags merged directly:", standardizedTags.length, "tags for lead", resolvedLeadId);
      } catch (tagErr) {
        console.warn("[sellflux-webhook] Tag merge RPC failed:", tagErr);
      }
    }

    // Real timestamp from SellFlux payload (fallback to now)
    const sellfluxRealTimestamp = payload.created_at || payload.date || payload.timestamp || payload.updated_at || new Date().toISOString();

    // Timeline: log individual tag events
    if (resolvedLeadId && standardizedTags.length > 0) {
      const tagEvents = standardizedTags.map((tag: string) => ({
        lead_id: resolvedLeadId,
        event_type: "sellflux_tag_applied",
        entity_type: "sellflux",
        entity_id: tag,
        entity_name: `Tag: ${tag}`,
        event_data: {
          tag,
          automation: payload.automation_name || null,
          source: detected.source,
        },
        source_channel: "sellflux",
        event_timestamp: sellfluxRealTimestamp,
      }));
      const { error: tagLogErr } = await supabase.from("lead_activity_log").insert(tagEvents);
      if (tagLogErr) console.warn("[sellflux-webhook] Tag timeline insert error:", tagLogErr.message);
      else console.log("[sellflux-webhook] Inserted", tagEvents.length, "tag timeline events");
    }

    // Timeline: log SellFlux entry with detected source context
    if (resolvedLeadId) {
      const hasEcommerce = detected.source === "loja_integrada";
      await supabase.from("lead_activity_log").insert({
        lead_id: resolvedLeadId,
        event_type: hasEcommerce ? "ecommerce_sellflux_entry" : "sellflux_webhook_entry",
        entity_type: "sellflux",
        entity_id: payload.automation_name || payload.form_name || detected.source,
        entity_name: hasEcommerce
          ? `E-commerce via SellFlux: ${productName || "pedido"}`
          : `SellFlux: ${payload.automation_name || payload.form_name || "webhook"}`,
        event_data: {
          label: hasEcommerce ? "Entrada e-commerce via SellFlux" : "Entrada via automação SellFlux",
          detected_source: detected.source,
          tags: standardizedTags.slice(0, 10),
          product_name: productName || null,
          transaction_value: transactionValue || null,
          tracking_status: trackingStatus || null,
          automation_name: payload.automation_name || null,
          form_name: payload.form_name || null,
        },
        source_channel: "sellflux",
        event_timestamp: sellfluxRealTimestamp,
      });
    }

    // --- Detect equipment/product mentions for lead_form_submissions ---
    if (resolvedLeadId) {
      const KEYWORDS_RE = /anycubic|phrozen|bite|glaze|nano|vitality|resina|impressora|scanner|cadcam|zirc[oô]nia|miicraft|primeprint|formlabs|asiga|creality|elegoo|wash|cure|exocad|medit|3shape/gi;
      const searchText = [
        payload.message, payload.produto_interesse, payload.impressora_modelo,
        payload.resina_interesse, payload.especialidade, productName,
        ...(rawTags || []),
      ].filter(Boolean).join(' ');

      const matches = searchText.match(KEYWORDS_RE);
      if (matches && matches.length > 0) {
        const uniqueMatches = [...new Set(matches.map((m: string) => m.toLowerCase()))];
        const equipKeywords = ['impressora', 'scanner', 'cadcam', 'wash', 'cure'];
        const equipMentioned = uniqueMatches.filter(m => equipKeywords.some(e => m.includes(e)));
        const productMentioned = uniqueMatches.filter(m => !equipKeywords.some(e => m.includes(e)));

        const formId = (payload.form_id || payload.automation_name || null) as string;
        await supabase.from('lead_form_submissions').upsert({
          lead_id: resolvedLeadId,
          form_type: 'sellflux',
          form_id: formId,
          form_data: payload,
          message: (payload.message || null) as string,
          equipment_mentioned: equipMentioned.length > 0 ? equipMentioned.join(', ') : null,
          product_mentioned: productMentioned.length > 0 ? productMentioned.join(', ') : null,
          submitted_at: new Date().toISOString(),
          status: 'new',
        }, { onConflict: 'lead_id,form_type,form_id', ignoreDuplicates: true });

        // Log event in activity log
        await supabase.from('lead_activity_log').insert({
          lead_id: resolvedLeadId,
          event_type: 'form_submission_detected',
          entity_type: 'form',
          entity_name: 'SellFlux form submission',
          event_data: { source: 'sellflux', keywords: uniqueMatches },
          source_channel: 'sellflux',
          event_timestamp: new Date().toISOString(),
        });

        console.log('[sellflux-webhook] Form submission detected, keywords:', uniqueMatches);
      }
    }

    try {
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
      });
    } catch {}

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

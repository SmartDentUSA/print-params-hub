import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replaceVariables, sendCampaignViaSellFlux, formatPhoneForWaLeads } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALEADS_BASE_URL = "https://waleads.roote.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SELLFLUX_WEBHOOK_CAMPANHAS = Deno.env.get("SELLFLUX_WEBHOOK_CAMPANHAS");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      team_member_id,
      phone,
      tipo: rawTipo = "text",
      message,
      media_url,
      caption,
      lead_id,
      test_mode = false,
      sellflux_template_id,
    } = body;

    // Sanitize tipo
    const VALID_TIPOS = ["text", "image", "audio", "video", "document"];
    const tipo = VALID_TIPOS.includes(String(rawTipo).toLowerCase()) ? String(rawTipo).toLowerCase() : "text";

    // Fetch lead data for variable replacement if lead_id provided
    let leadData: Record<string, unknown> = {};
    if (lead_id) {
      const { data: lead } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", lead_id)
        .single();
      if (lead) leadData = lead as Record<string, unknown>;
    }

    // ─── SellFlux Campaign path (preferred when webhook URL + template available) ───
    // SellFlux ONLY when an explicit template ID is provided (not free-text messages)
    const useSellFlux = SELLFLUX_WEBHOOK_CAMPANHAS && sellflux_template_id && phone;

    if (useSellFlux) {
      // Ensure leadData has phone
      if (!leadData.telefone_normalized) leadData.telefone_normalized = phone;
      if (!leadData.nome) leadData.nome = "Lead";

      console.log(`[send-waleads] SellFlux Campaign: template=${sellflux_template_id} phone=${phone}`, { test_mode });

      const result = await sendCampaignViaSellFlux(SELLFLUX_WEBHOOK_CAMPANHAS, leadData, sellflux_template_id);

      // Log
      await supabase.from("message_logs").insert({
        lead_id: lead_id || null,
        team_member_id: team_member_id || null,
        tipo: test_mode ? `sellflux_${tipo}_test` : `sellflux_${tipo}`,
        mensagem_preview: `[SellFlux] template: ${sellflux_template_id}`.slice(0, 200),
        status: result.success ? "enviado" : "erro",
        error_details: result.success ? null : result.response,
      });

      // Timeline: log SellFlux campaign send
      if (lead_id && result.success) {
        await supabase.from("lead_activity_log").insert({
          lead_id,
          event_type: "sellflux_campaign_sent",
          entity_type: "sellflux",
          entity_id: sellflux_template_id,
          entity_name: `Campanha SellFlux: ${sellflux_template_id}`,
          event_data: {
            label: "Envio de campanha SellFlux",
            template_id: sellflux_template_id,
            test_mode,
          },
          source_channel: "sellflux",
          event_timestamp: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify({
        success: result.success,
        provider: "sellflux",
        status: result.success ? "enviado" : "erro",
        api_status: result.status,
        response: result.response,
        test_mode,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── WaLeads fallback path ───
    if (!team_member_id || !phone) {
      return new Response(JSON.stringify({ error: "team_member_id e phone são obrigatórios (WaLeads mode)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member, error: memberErr } = await supabase
      .from("team_members")
      .select("id, waleads_api_key, nome_completo, whatsapp_number")
      .eq("id", team_member_id)
      .single();

    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!member.waleads_api_key) {
      return new Response(JSON.stringify({ error: "WaLeads API Key não configurada para este membro" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalMessage = message ? replaceVariables(message, leadData) : undefined;
    const finalCaption = caption ? replaceVariables(caption, leadData) : undefined;

    // Sanitize phone: digits only, ensure country code
    const cleanPhone = formatPhoneForWaLeads(phone);

    let apiBody: Record<string, unknown>;
    if (tipo === "text") {
      apiBody = { chat: cleanPhone, message: finalMessage, isGroup: false };
    } else {
      apiBody = { chat: cleanPhone, url: media_url, isGroup: false };
      if (finalCaption) apiBody.caption = finalCaption;
    }

    console.log(`[send-waleads] WaLeads: ${tipo} to ${cleanPhone} via ${member.nome_completo}`, {
      test_mode,
      apiBody,
      message_preview: (finalMessage || finalCaption || "").slice(0, 100),
    });

    const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${tipo}?key=${member.waleads_api_key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiBody),
    });

    const waData = await waRes.text();
    console.log(`[send-waleads] WaLeads response: status=${waRes.status} body=${waData.slice(0, 500)}`);
    const messageStatus = waRes.ok ? "enviado" : "erro";

    // Parse provider metadata for traceability
    let providerMeta: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(waData);
      providerMeta = {
        provider_code: parsed.code || parsed.status || waRes.status,
        provider_message: parsed.message || null,
        provider_channel: parsed.data?.channelId || parsed.channelId || null,
        provider_timestamp: parsed.data?.timestamp || parsed.timestamp || null,
        raw_snippet: waData.slice(0, 300),
      };
    } catch {
      providerMeta = { raw_snippet: waData.slice(0, 300) };
    }
    const errorDetails = JSON.stringify(providerMeta);

    const logTipo = test_mode ? `waleads_${tipo}_test` : `waleads_${tipo}`;
    await supabase.from("message_logs").insert({
      lead_id: lead_id || null,
      team_member_id: member.id,
      whatsapp_number: member.whatsapp_number,
      tipo: logTipo,
      mensagem_preview: tipo === "text"
        ? (finalMessage || "").slice(0, 200)
        : `[${tipo}] ${media_url || ""}`.slice(0, 200),
      status: messageStatus,
      error_details: errorDetails,
    });

    // Also insert into whatsapp_inbox so outbound messages appear in the chat UI
    if (waRes.ok) {
      await supabase.from("whatsapp_inbox").insert({
        phone: cleanPhone,
        phone_normalized: cleanPhone.length > 9 ? cleanPhone.slice(-9) : cleanPhone,
        message_text: tipo === "text" ? (finalMessage || "") : null,
        media_url: tipo !== "text" ? (media_url || null) : null,
        media_type: tipo !== "text" ? tipo : null,
        direction: "outbound",
        lead_id: lead_id || null,
      });

      // Timeline: log WhatsApp campaign send
      if (lead_id) {
        await supabase.from("lead_activity_log").insert({
          lead_id,
          event_type: sellflux_template_id ? "sellflux_campaign_sent" : "whatsapp_message_sent",
          entity_type: "whatsapp",
          entity_id: member.id,
          entity_name: sellflux_template_id
            ? `Campanha SellFlux: ${sellflux_template_id}`
            : `WhatsApp via ${member.nome_completo}`,
          event_data: {
            label: sellflux_template_id ? "Envio de campanha SellFlux" : "Mensagem WhatsApp enviada",
            provider: sellflux_template_id ? "sellflux" : "waleads",
            tipo,
            seller: member.nome_completo,
            message_preview: (finalMessage || finalCaption || "").slice(0, 100),
            template_id: sellflux_template_id || null,
          },
          source_channel: sellflux_template_id ? "sellflux" : "waleads",
          event_timestamp: new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({
      success: waRes.ok,
      provider: "waleads",
      status: messageStatus,
      api_status: waRes.status,
      provider_meta: providerMeta,
      test_mode,
    }), {
      status: waRes.ok ? 200 : waRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-waleads] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

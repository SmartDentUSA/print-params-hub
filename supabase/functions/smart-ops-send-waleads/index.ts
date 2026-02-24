import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALEADS_BASE_URL = "https://api.waleads.com";

function replaceVariables(text: string, lead: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = lead[key];
    return val ? String(val) : `{{${key}}}`;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      team_member_id,
      phone,
      tipo = "text",
      message,
      media_url,
      caption,
      lead_id,
      test_mode = false,
    } = body;

    if (!team_member_id || !phone) {
      return new Response(JSON.stringify({ error: "team_member_id e phone são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch team member's WaLeads API key
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

    // Build message with variable replacement
    const finalMessage = message ? replaceVariables(message, leadData) : undefined;
    const finalCaption = caption ? replaceVariables(caption, leadData) : undefined;

    // Build WaLeads API request body
    let apiBody: Record<string, unknown>;
    if (tipo === "text") {
      apiBody = { phone, message: finalMessage };
    } else {
      apiBody = { phone, url: media_url };
      if (finalCaption) apiBody.caption = finalCaption;
    }

    console.log(`[send-waleads] Sending ${tipo} to ${phone} via ${member.nome_completo}`, { test_mode });

    // Call WaLeads API
    const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${tipo}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${member.waleads_api_key}`,
      },
      body: JSON.stringify(apiBody),
    });

    const waData = await waRes.text();
    const messageStatus = waRes.ok ? "enviado" : "erro";
    const errorDetails = waRes.ok ? null : waData.slice(0, 500);

    console.log(`[send-waleads] Status: ${waRes.status}, ok: ${waRes.ok}`);

    // Log to message_logs (skip if test_mode)
    if (!test_mode) {
      await supabase.from("message_logs").insert({
        lead_id: lead_id || null,
        team_member_id: member.id,
        whatsapp_number: member.whatsapp_number,
        tipo: `waleads_${tipo}`,
        mensagem_preview: tipo === "text"
          ? (finalMessage || "").slice(0, 200)
          : `[${tipo}] ${media_url || ""}`.slice(0, 200),
        status: messageStatus,
        error_details: errorDetails,
      });
    }

    return new Response(JSON.stringify({
      success: waRes.ok,
      status: messageStatus,
      api_status: waRes.status,
      response: waData.slice(0, 500),
      test_mode,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-waleads] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

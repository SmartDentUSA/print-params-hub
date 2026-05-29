import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DisparoPro Bulk SMS API v3
// Docs: https://disparopro.com.br/api  (Authorization: Basic <token>)
const DISPARO_PRO_URL = "https://api.disparopro.com.br/mt-sms/v3/sms";

function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  // Garante código país BR (55) se vier só com DDD+número (10-11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DISPARO_PRO_TOKEN = Deno.env.get("DISPARO_PRO_TOKEN");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    if (!DISPARO_PRO_TOKEN) {
      return new Response(JSON.stringify({ error: "DISPARO_PRO_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { campaign_id, sms_message: directMsg, sms_codificacao: directEnc } = body || {};
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar campaign_session
    const { data: camp, error: campErr } = await supabase
      .from("campaign_sessions")
      .select("id,name,lead_ids,results,status")
      .eq("id", campaign_id)
      .single();
    if (campErr || !camp) {
      return new Response(JSON.stringify({ error: `campaign_session ${campaign_id} não encontrada: ${campErr?.message}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = String(directMsg ?? camp.results?.sms_message ?? "").trim();
    const codificacao = String(directEnc ?? camp.results?.sms_codificacao ?? "0") === "8" ? "8" : "0";
    const maxLen = codificacao === "0" ? 160 : 70;
    if (!message) {
      return new Response(JSON.stringify({ error: "Mensagem vazia em campaign_sessions.results.sms_message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > maxLen) {
      return new Response(JSON.stringify({ error: `Mensagem ${message.length} chars > limite ${maxLen} (cod=${codificacao})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadIds: string[] = Array.isArray(camp.lead_ids) ? camp.lead_ids : [];
    if (leadIds.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum lead na campanha" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Buscar telefones (canonical leads)
    const { data: leads } = await supabase
      .from("lia_attendances")
      .select("id,nome,telefone_normalized,telefone_raw,wa_phone")
      .in("id", leadIds)
      .is("merged_into", null);

    let sent = 0, failed = 0;
    const perLeadResults: Array<Record<string, unknown>> = [];

    for (const lead of leads || []) {
      const phoneRaw = lead.telefone_normalized || lead.telefone_raw || lead.wa_phone;
      const numero = normalizePhone(String(phoneRaw || ""));
      if (!numero) {
        failed++;
        perLeadResults.push({ lead_id: lead.id, status: "erro", error: "sem telefone" });
        await supabase.from("message_logs").insert({
          lead_id: lead.id, tipo: "sms_disparopro",
          mensagem_preview: message.slice(0, 200),
          status: "erro", error_details: "sem telefone",
        });
        continue;
      }

      // 3. Chamar DisparoPro
      let providerStatus = "erro";
      let providerBody = "";
      let httpStatus = 0;
      try {
        const apiRes = await fetch(DISPARO_PRO_URL, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${DISPARO_PRO_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            numeros: [{ numero, mensagem: message, codificacao }],
          }),
        });
        httpStatus = apiRes.status;
        providerBody = await apiRes.text();
        providerStatus = apiRes.ok ? "enviado" : "erro";
        if (apiRes.ok) sent++; else failed++;
      } catch (e) {
        failed++;
        providerBody = String(e);
      }

      perLeadResults.push({
        lead_id: lead.id, numero, status: providerStatus,
        http_status: httpStatus, provider: providerBody.slice(0, 300),
      });

      await supabase.from("message_logs").insert({
        lead_id: lead.id,
        tipo: "sms_disparopro",
        mensagem_preview: message.slice(0, 200),
        status: providerStatus,
        error_details: providerStatus === "enviado" ? null : `[${httpStatus}] ${providerBody.slice(0, 500)}`,
      });
    }

    // 4. Atualizar campaign_session
    await supabase.from("campaign_sessions").update({
      status: failed === 0 ? "completed" : (sent === 0 ? "failed" : "completed_with_errors"),
      results: { ...(camp.results || {}), sent, failed, per_lead: perLeadResults, finished_at: new Date().toISOString() },
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ success: true, campaign_id, sent, failed, per_lead: perLeadResults }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function parseProviderItems(body: string): any[] {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed?.numeros)) return parsed.numeros;
    if (Array.isArray(parsed)) return parsed;
    return parsed ? [parsed] : [];
  } catch {
    return [];
  }
}

function isProviderAccepted(item: any): boolean {
  return Boolean(item && (
    item.sucesso === true ||
    item.status === "ok" || item.status === "enviado" || item.status === "aceito" ||
    item.codigo === 0 || item.codigo === "0" || item.codigo === 200 || item.codigo === "200"
  ));
}

function providerProtocol(item: any): string | null {
  return item?.protocolo ?? item?.id ?? item?.message_id ?? null;
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
    const {
      campaign_id,
      source_campaign_id,
      sms_message: directMsg,
      sms_codificacao: directEnc,
      async: runAsync = false,
      batch_size: rawBatchSize,
    } = body || {};
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

    const batchSize = Math.max(1, Math.min(Number(rawBatchSize) || 100, 500));
    const publicCampaignId = source_campaign_id || campaign_id;

    const processCampaign = async () => {
      let sent = 0, failed = 0;
      const perLeadResults: Array<Record<string, unknown>> = [];

      // 2. Buscar telefones (canonical leads) em blocos para evitar URL/query gigante.
      const leads: any[] = [];
      for (const idsChunk of chunkArray(leadIds, 500)) {
        const { data: chunkRows, error: leadsErr } = await supabase
          .from("lia_attendances")
          .select("id,nome,telefone_normalized,telefone_raw,wa_phone")
          .in("id", idsChunk)
          .is("merged_into", null);
        if (leadsErr) throw new Error(`Erro ao buscar leads: ${leadsErr.message}`);
        leads.push(...(chunkRows || []));
      }

      await supabase.from("campaign_sessions").update({
        status: "running",
        started_at: new Date().toISOString(),
      }).eq("id", campaign_id);

      if (source_campaign_id) {
        await supabase.from("campaigns").update({
          status: "running",
          started_at: new Date().toISOString(),
          total_leads: leadIds.length,
          total_sent: 0,
          total_failed: 0,
        }).eq("id", source_campaign_id);
      }

      const normalizedLeads = leads.map((lead: any) => ({
        ...lead,
        numero: normalizePhone(String(lead.telefone_normalized || lead.telefone_raw || lead.wa_phone || "")),
      }));

      const missingPhone = normalizedLeads.filter((lead: any) => !lead.numero);
      if (missingPhone.length > 0) {
        failed += missingPhone.length;
        perLeadResults.push(...missingPhone.map((lead: any) => ({ lead_id: lead.id, status: "erro", error: "sem telefone" })));
        await supabase.from("message_logs").insert(missingPhone.map((lead: any) => ({
          lead_id: lead.id,
          tipo: "sms_disparopro",
          mensagem_preview: message.slice(0, 200),
          status: "erro",
          error_details: "sem telefone",
          data_envio: new Date().toISOString(),
        })));
        await supabase.from("campaign_send_log").insert(missingPhone.map((lead: any) => ({
          campaign_id: publicCampaignId,
          lead_id: lead.id,
          telefone: lead.telefone_normalized || lead.telefone_raw || lead.wa_phone || null,
          nome: lead.nome || null,
          content_sent: message,
          mensagem_rendered: message,
          status: "failed",
          error_message: "sem telefone",
          provider: "disparopro",
          provider_status: "ERROR",
          provider_detail_message: "sem telefone",
          sent_at: new Date().toISOString(),
        })));
      }

      const deliverable = normalizedLeads.filter((lead: any) => lead.numero);

      for (const batch of chunkArray(deliverable, batchSize)) {
        let httpStatus = 0;
        let providerBody = "";
        let providerItems: any[] = [];
        try {
          const apiRes = await fetch(DISPARO_PRO_URL, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${DISPARO_PRO_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              numeros: batch.map((lead: any) => ({ numero: lead.numero, mensagem: message, codificacao })),
            }),
          });
          httpStatus = apiRes.status;
          providerBody = await apiRes.text();
          providerItems = parseProviderItems(providerBody);
        } catch (e) {
          providerBody = String(e);
        }

        const nowIso = new Date().toISOString();
        const messageLogRows = [];
        const sendLogRows = [];

        for (let i = 0; i < batch.length; i++) {
          const lead: any = batch[i];
          const item = providerItems[i] ?? providerItems[0] ?? null;
          const ok = httpStatus >= 200 && httpStatus < 300 && isProviderAccepted(item);
          const protocol = providerProtocol(item);
          const detailCode = item?.codigo != null ? String(item.codigo) : (httpStatus ? String(httpStatus) : null);
          const detailMessage = item?.mensagem ?? item?.message ?? item?.erro ?? item?.error ?? providerBody.slice(0, 500);
          const providerStatus = ok ? "ACCEPTED" : (httpStatus >= 200 && httpStatus < 300 ? "REJECTED" : "ERROR");
          const status = ok ? "sent" : "failed";

          if (ok) sent++; else failed++;
          perLeadResults.push({
            lead_id: lead.id,
            numero: lead.numero,
            status: ok ? "aceito_provider" : "erro",
            http_status: httpStatus,
            protocolo: protocol,
            provider: providerBody.slice(0, 500),
          });

          messageLogRows.push({
            lead_id: lead.id,
            tipo: "sms_disparopro",
            mensagem_preview: message.slice(0, 200),
            status: ok ? "aceito_provider" : "erro",
            error_details: ok ? (protocol ? `protocolo=${protocol}` : null) : `[${httpStatus}] ${providerBody.slice(0, 500)}`,
            data_envio: nowIso,
          });

          sendLogRows.push({
            campaign_id: publicCampaignId,
            lead_id: lead.id,
            telefone: lead.numero,
            nome: lead.nome || null,
            content_sent: message,
            mensagem_rendered: message,
            status,
            error_message: ok ? null : String(detailMessage || "Erro no provedor").slice(0, 500),
            provider: "disparopro",
            provider_message_id: protocol,
            provider_status: providerStatus,
            provider_detail_code: detailCode,
            provider_detail_message: String(detailMessage || "").slice(0, 500),
            sent_at: nowIso,
          });
        }

        if (messageLogRows.length) await supabase.from("message_logs").insert(messageLogRows);
        if (sendLogRows.length) await supabase.from("campaign_send_log").insert(sendLogRows);

        const partialStatus = failed === 0 ? "running" : (sent === 0 ? "running" : "running");
        await supabase.from("campaign_sessions").update({
          status: partialStatus,
          sent_count: sent,
          failed_count: failed,
          results: { ...(camp.results || {}), sent, failed, processed: sent + failed, total: leadIds.length },
        }).eq("id", campaign_id);
        if (source_campaign_id) {
          await supabase.from("campaigns").update({
            total_sent: sent,
            total_failed: failed,
          }).eq("id", source_campaign_id);
        }
      }

      const finalStatus = failed === 0 ? "completed" : (sent === 0 ? "failed" : "completed_with_errors");
      const completedAt = new Date().toISOString();
      await supabase.from("campaign_sessions").update({
        status: finalStatus,
        sent_count: sent,
        failed_count: failed,
        completed_at: completedAt,
        results: { ...(camp.results || {}), sent, failed, per_lead: perLeadResults.slice(0, 1000), finished_at: completedAt },
      }).eq("id", campaign_id);

      if (source_campaign_id) {
        await supabase.from("campaigns").update({
          status: finalStatus,
          total_leads: leadIds.length,
          total_sent: sent,
          total_failed: failed,
          completed_at: completedAt,
        }).eq("id", source_campaign_id);
      }

      return { sent, failed, perLeadResults };
    };

    if (runAsync) {
      EdgeRuntime.waitUntil(processCampaign().catch(async (e) => {
        const failedAt = new Date().toISOString();
        await supabase.from("campaign_sessions").update({
          status: "failed",
          completed_at: failedAt,
          results: { ...(camp.results || {}), error: (e as Error).message, finished_at: failedAt },
        }).eq("id", campaign_id);
        if (source_campaign_id) {
          await supabase.from("campaigns").update({
            status: "failed",
            completed_at: failedAt,
            notes: (e as Error).message,
          }).eq("id", source_campaign_id);
        }
      }));
      return new Response(JSON.stringify({ success: true, queued: true, campaign_id, source_campaign_id, total: leadIds.length }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await processCampaign();
    return new Response(JSON.stringify({ success: true, campaign_id, sent: result.sent, failed: result.failed, per_lead: result.perLeadResults }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
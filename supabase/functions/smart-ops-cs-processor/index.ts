import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replaceVariables, sendViaSellFlux, mergeTagsCrm, formatPhoneForWaLeads } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALEADS_BASE_URL = "https://waleads.roote.com.br";

// Map rule tipo to CS tags
const CS_TAG_MAP: Record<string, string> = {
  onboarding: "CS_ONBOARDING_INICIO",
  treinamento: "CS_TREINAMENTO_PENDENTE",
  nps: "CS_NPS_ENVIADO",
  pos_venda: "CS_ONBOARDING_INICIO",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");
    const SELLFLUX_API_TOKEN = Deno.env.get("SELLFLUX_API_TOKEN");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: rules, error: rulesError } = await supabase
      .from("cs_automation_rules")
      .select("*")
      .eq("ativo", true);

    if (rulesError || !rules?.length) {
      console.log("[cs-processor] Nenhuma regra ativa encontrada");
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: csMember } = await supabase
      .from("team_members")
      .select("id, whatsapp_number, nome_completo")
      .eq("role", "cs")
      .eq("ativo", true)
      .limit(1)
      .single();

    let totalProcessed = 0;

    for (const rule of rules) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (rule.delay_days || 0));

      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, telefone_normalized, produto_interesse, especialidade, cidade, uf, area_atuacao, proprietario_lead_crm, tags_crm, lead_status, score, impressora_modelo, tem_scanner, resina_interesse, resumo_historico_ia, ultima_etapa_comercial, software_cad, volume_mensal_pecas, principal_aplicacao, valor_oportunidade, temperatura_lead, piperun_id")
        .eq("status_atual_lead_crm", rule.trigger_event)
        .not("data_contrato", "is", null)
        .lte("data_contrato", cutoffDate.toISOString());

      if (!leads?.length) continue;

      for (const lead of leads) {
        const logTipo = rule.waleads_ativo ? `waleads_cs_${rule.id}` : `cs_${rule.template_manychat}`;

        // Check if already sent
        const { data: existingLog } = await supabase
          .from("message_logs")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("tipo", logTipo)
          .limit(1);

        if (existingLog?.length) continue;

        // Determine CS tag to insert
        const csTag = CS_TAG_MAP[rule.tipo || ""] || null;
        if (csTag) {
          const newTags = mergeTagsCrm(lead.tags_crm, [csTag]);
          await supabase.from("lia_attendances").update({ tags_crm: newTags }).eq("id", lead.id);
        }

        // ─── SellFlux path ───
        if (SELLFLUX_API_TOKEN && rule.mensagem_waleads && lead.telefone_normalized) {
          const leadRecord = lead as Record<string, unknown>;
          const result = await sendViaSellFlux(SELLFLUX_API_TOKEN, leadRecord, rule.mensagem_waleads);

          await supabase.from("message_logs").insert({
            lead_id: lead.id,
            team_member_id: csMember?.id || null,
            tipo: `sellflux_cs_${rule.id}`,
            mensagem_preview: `[SellFlux CS] ${rule.tipo}: template ${rule.mensagem_waleads} para ${lead.nome}`.slice(0, 200),
            status: result.success ? "enviado" : "erro",
            error_details: result.success ? null : result.response,
          });

          totalProcessed++;
          continue;
        }

        // ─── ManyChat path ───
        if (rule.manychat_ativo !== false && rule.template_manychat && MANYCHAT_API_KEY && lead.telefone_normalized) {
          let messageStatus = "skipped";
          let errorDetails: string | null = null;

          try {
            const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${MANYCHAT_API_KEY}`,
              },
              body: JSON.stringify({
                subscriber_id: lead.telefone_normalized,
                flow_ns: rule.template_manychat,
              }),
            });
            const mcData = await mcRes.json();
            messageStatus = mcRes.ok ? "enviado" : "erro";
            if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
          } catch (mcErr) {
            messageStatus = "erro";
            errorDetails = String(mcErr);
          }

          await supabase.from("message_logs").insert({
            lead_id: lead.id,
            team_member_id: csMember?.id || null,
            whatsapp_number: csMember?.whatsapp_number || null,
            tipo: `cs_${rule.template_manychat}`,
            mensagem_preview: `CS ${rule.tipo}: ${rule.template_manychat} para ${lead.nome}`,
            status: messageStatus,
            error_details: errorDetails,
          });

          totalProcessed++;
          continue;
        }

        // ─── WaLeads path (fallback) ───
        if (rule.waleads_ativo && lead.telefone_normalized) {
          const waleadsTipo = rule.waleads_tipo || "text";
          let waleadsApiKey: string | null = null;
          let teamMemberId: string | null = null;
          let teamMemberWhatsapp: string | null = null;

          if (rule.team_member_id) {
            const { data: tm } = await supabase
              .from("team_members")
              .select("id, waleads_api_key, whatsapp_number")
              .eq("id", rule.team_member_id)
              .single();
            if (tm?.waleads_api_key) {
              waleadsApiKey = tm.waleads_api_key;
              teamMemberId = tm.id;
              teamMemberWhatsapp = tm.whatsapp_number;
            }
          }

          if (waleadsApiKey) {
            let messageStatus = "skipped";
            let errorDetails: string | null = null;
            let preview = "";

            try {
              const leadRecord = lead as Record<string, unknown>;
              const chatPhone = formatPhoneForWaLeads(lead.telefone_normalized || "");
              let apiBody: Record<string, unknown>;

              if (waleadsTipo === "text") {
                const msg = replaceVariables(rule.mensagem_waleads || "", leadRecord);
                apiBody = { chat: chatPhone, message: msg, isGroup: false };
                preview = msg.slice(0, 200);
              } else {
                apiBody = { chat: chatPhone, url: rule.waleads_media_url, isGroup: false };
                if (rule.waleads_media_caption) {
                  apiBody.caption = replaceVariables(rule.waleads_media_caption, leadRecord);
                }
                preview = `[${waleadsTipo}] ${rule.waleads_media_url || ""}`.slice(0, 200);
              }

              const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${waleadsTipo}?key=${waleadsApiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(apiBody),
              });

              const waData = await waRes.text();
              messageStatus = waRes.ok ? "enviado" : "erro";
              if (!waRes.ok) errorDetails = waData.slice(0, 500);
            } catch (waErr) {
              messageStatus = "erro";
              errorDetails = String(waErr);
            }

            await supabase.from("message_logs").insert({
              lead_id: lead.id,
              team_member_id: teamMemberId,
              whatsapp_number: teamMemberWhatsapp,
              tipo: `waleads_cs_${rule.id}`,
              mensagem_preview: preview,
              status: messageStatus,
              error_details: errorDetails,
            });

            totalProcessed++;
          }
        }
      }
    }

    console.log(`[cs-processor] Processados: ${totalProcessed}`);
    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cs-processor] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

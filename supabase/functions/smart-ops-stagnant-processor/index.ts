import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSellFlux, mergeTagsCrm, computeStagnationTag } from "../_shared/sellflux-field-map.ts";
import { moveDealToStage, ETAPA_TO_STAGE } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROGRESSION: Record<string, string> = {
  est_etapa1: "est_etapa2",
  est_etapa2: "est_etapa3",
  est_etapa3: "est_etapa4",
  est_etapa4: "est_apresentacao",
  est_apresentacao: "est_proposta",
  est_proposta: "estagnado_final",
};

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");
    const SELLFLUX_API_TOKEN = Deno.env.get("SELLFLUX_API_TOKEN");
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: leads, error: fetchError } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, lead_status, updated_at, produto_interesse, tags_crm, piperun_id, proprietario_lead_crm, area_atuacao, especialidade, cidade, uf, impressora_modelo, tem_scanner, resina_interesse, score, temperatura_lead, ultima_etapa_comercial, software_cad, volume_mensal_pecas, principal_aplicacao, valor_oportunidade, resumo_historico_ia")
      .like("lead_status", "est%")
      .neq("lead_status", "estagnado_final")
      .order("updated_at", { ascending: true })
      .limit(500);

    if (fetchError) {
      console.error("[stagnant-processor] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let advanced = 0;
    let messagesSent = 0;
    let messagesError = 0;

    const { data: rules } = await supabase
      .from("cs_automation_rules")
      .select("trigger_event, template_manychat, mensagem_waleads, produto_interesse")
      .eq("ativo", true)
      .like("trigger_event", "est%");

    const rulesMap = new Map<string, { template: string; sellflux_template?: string; produto?: string }>();
    if (rules) {
      for (const r of rules) {
        if (r.trigger_event && (r.template_manychat || r.mensagem_waleads)) {
          rulesMap.set(r.trigger_event, {
            template: r.template_manychat || "",
            sellflux_template: r.mensagem_waleads || undefined,
            produto: r.produto_interesse || undefined,
          });
        }
      }
    }

    for (const lead of leads || []) {
      const updatedAt = new Date(lead.updated_at).getTime();
      const elapsed = now - updatedAt;
      if (elapsed < FIVE_DAYS_MS) continue;

      const currentStatus = lead.lead_status;
      const nextStatus = PROGRESSION[currentStatus];
      if (!nextStatus) continue;

      // Compute stagnation tag for new stage
      const stagnationTag = computeStagnationTag(nextStatus);
      const tagsToAdd = stagnationTag ? [stagnationTag] : [];
      const newTags = mergeTagsCrm(lead.tags_crm, tagsToAdd);

      const { error: updateError } = await supabase
        .from("lia_attendances")
        .update({
          lead_status: nextStatus,
          updated_at: new Date().toISOString(),
          tags_crm: newTags,
        })
        .eq("id", lead.id);

      if (updateError) {
        console.error("[stagnant-processor] Update error for", lead.id, updateError);
        continue;
      }

      advanced++;

      // ── Push stage change to PipeRun ──
      if (PIPERUN_API_KEY && lead.piperun_id) {
        const stageMapping = ETAPA_TO_STAGE[nextStatus];
        if (stageMapping) {
          const moveResult = await moveDealToStage(
            PIPERUN_API_KEY,
            Number(lead.piperun_id),
            stageMapping.stage_id
          );
          if (moveResult.success) {
            console.log(`[stagnant-processor] ✅ PipeRun deal ${lead.piperun_id} → stage ${stageMapping.stage_id}`);
          } else {
            console.warn(`[stagnant-processor] ⚠️ PipeRun move falhou deal ${lead.piperun_id}:`, moveResult.data);
          }
        }
      }

      console.log(`[stagnant-processor] ${lead.nome}: ${currentStatus} → ${nextStatus}${stagnationTag ? ` +TAG:${stagnationTag}` : ""}`);

      // Check automation rule for new stage
      const rule = rulesMap.get(nextStatus);
      if (!rule || !lead.telefone_normalized) continue;

      // ─── SellFlux path (preferred) ───
      if (SELLFLUX_API_TOKEN && rule.sellflux_template) {
        const result = await sendViaSellFlux(
          SELLFLUX_API_TOKEN,
          lead as Record<string, unknown>,
          rule.sellflux_template
        );

        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          tipo: `estagnacao_${nextStatus}`,
          mensagem_preview: `[SellFlux] Estagnação: ${lead.nome} → ${nextStatus} (template: ${rule.sellflux_template})`.slice(0, 200),
          status: result.success ? "enviado" : "erro",
          error_details: result.success ? null : result.response,
        });

        if (result.success) messagesSent++;
        else messagesError++;
        continue;
      }

      // ─── ManyChat fallback ───
      if (MANYCHAT_API_KEY && rule.template) {
        let msgStatus = "skipped";
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
              flow_ns: rule.template,
            }),
          });
          const mcData = await mcRes.json();
          msgStatus = mcRes.ok ? "enviado" : "erro";
          if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
          if (mcRes.ok) messagesSent++;
          else messagesError++;
        } catch (mcErr) {
          msgStatus = "erro";
          errorDetails = String(mcErr);
          messagesError++;
        }

        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          tipo: `estagnacao_${nextStatus}`,
          mensagem_preview: `Funil estagnação: ${lead.nome} avançou para ${nextStatus}`,
          status: msgStatus,
          error_details: errorDetails,
        });
      }
    }

    // ─── Clean-up: auto-discard leads with sem_interesse from whatsapp_inbox ───
    let discarded = 0;
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: noInterestMsgs } = await supabase
      .from("whatsapp_inbox")
      .select("lead_id")
      .eq("intent_detected", "sem_interesse")
      .gte("created_at", sevenDaysAgo)
      .not("lead_id", "is", null);

    if (noInterestMsgs && noInterestMsgs.length > 0) {
      const leadIds = [...new Set(noInterestMsgs.map(m => m.lead_id).filter(Boolean))];
      for (const lid of leadIds) {
        // Check no positive interactions exist
        const { count } = await supabase
          .from("whatsapp_inbox")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", lid)
          .in("intent_detected", ["interesse_imediato", "interesse_futuro", "pedido_info"]);

        if ((count || 0) > 0) continue;

        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("id, lead_status, tags_crm")
          .eq("id", lid)
          .single();

        if (!lead || lead.lead_status === "descartado" || lead.lead_status === "fechamento") continue;

        const newTags = mergeTagsCrm(lead.tags_crm, ["A_SEM_RESPOSTA"]);
        await supabase
          .from("lia_attendances")
          .update({ lead_status: "descartado", tags_crm: newTags, updated_at: new Date().toISOString() })
          .eq("id", lid);
        discarded++;
        console.log(`[stagnant-processor] Discarded lead ${lid} (sem_interesse)`);
      }
    }

    const result = {
      success: true,
      total_in_funnel: leads?.length || 0,
      advanced,
      messages_sent: messagesSent,
      messages_error: messagesError,
      discarded_sem_interesse: discarded,
    };

    console.log("[stagnant-processor] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stagnant-processor] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

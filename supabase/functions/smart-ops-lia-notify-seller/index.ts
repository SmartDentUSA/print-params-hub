// smart-ops-lia-notify-seller — v35
// Envia briefing SmartOps para o vendedor via Evolution API.
// Substitui a versão fantasma (v32) que ainda usava o header antigo
// "🤖 Novo Lead - Dra. L.I.A.". Agora delega ao buildSellerNotification
// compartilhado, que já formata com "📊 Análise SmartOps".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSellerNotification } from "../_shared/wa-messaging.ts";
import { pickWaJid } from "../_shared/seller-summary.ts";
import { EVO_BASE, EVO_KEY, normalizePhone } from "../_shared/evolution.ts";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Instância padrão de envio: a antiga "Danilo Henrique" não existe mais no Evolution
// (404 desde 24/jul/2026). Fallback agora é smartdent_marketing.
// TODO envio institucional (briefing/novos leads/avisos) sai SEMPRE pela instância
// de marketing. A antiga "Danilo Henrique" foi aposentada.
const SENDER_INSTANCE = Deno.env.get("NOTIFY_SELLER_INSTANCE") ?? "smartdent_marketing";
const LOCK_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const lead_id = body?.lead_id as string | undefined;
    let team_member_id = body?.team_member_id as string | undefined;
    const seller_name = (body?.seller_name as string | undefined)?.trim() || null;
    const trigger = (body?.trigger as string | undefined) || "unknown";
    // Envio de TESTE: manda o briefing para um número arbitrário, sem lock,
    // sem janela de horário e sem gravar em message_logs.
    const test_phone = (normalizeBrazilianPhone(String(body?.test_phone ?? "")) || "").replace(/\D/g, "") || null;

    if (!lead_id) {
      return json({ error: "lead_id is required" }, 400);
    }

    // O trigger de banco (fn_trigger_seller_briefing) envia `seller_name` em vez de
    // `team_member_id`. Resolver aqui, senão o briefing morre em 400 e o log fica "pendente".
    if (!team_member_id) {
      const nome = seller_name
        || ((await supabase.from("lia_attendances").select("proprietario_lead_crm").eq("id", lead_id).maybeSingle())
              .data as any)?.proprietario_lead_crm
        || null;
      if (!nome) return json({ error: "team_member_id or seller_name is required" }, 400);
      const { data: tm } = await supabase
        .from("team_members")
        .select("id, nome_completo")
        .ilike("nome_completo", nome)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      let resolved = (tm as any)?.id as string | undefined;
      if (!resolved) {
        const { data: fuzzy } = await supabase
          .from("team_members")
          .select("id, nome_completo")
          .ilike("nome_completo", `%${nome.split(/\s+/)[0]}%`)
          .eq("ativo", true)
          .limit(5);
        const lower = nome.toLowerCase();
        resolved = (fuzzy || []).find((r: any) => lower.includes(String(r.nome_completo || "").toLowerCase().split(/\s+/)[0]))?.id
          || (fuzzy || [])[0]?.id;
      }
      if (!resolved) {
        await logMsg(supabase, {
          lead_id, team_member_id: null, whatsapp_number: null,
          tipo: "briefing_vendedor_block", status: "erro",
          evolution_instance: null, mensagem_preview: null,
          error_details: `seller_name_not_resolved:${nome}`,
        });
        return json({ error: `seller_name not resolved: ${nome}` }, 404);
      }
      team_member_id = resolved;
    }

    // ── Config editável na UI (seller_briefing_config) ──
    const { data: cfg } = await supabase
      .from("seller_briefing_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (cfg && cfg.ativo === false) {
      console.log("[notify-seller v36] automação desativada na UI — skip");
      return json({ skipped: true, reason: "automacao_desativada" });
    }
    // Canais são independentes: ativar e-mail/SMS NÃO suspende o WhatsApp.
    // `canal` aceita valor único ("whatsapp") ou lista ("whatsapp,email,sms").
    const canaisAtivos = String(cfg?.canal ?? "whatsapp")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (cfg && !canaisAtivos.includes("whatsapp")) {
      console.log(`[notify-seller v37] WhatsApp desativado (canais=${canaisAtivos.join("|")}) — skip`);
      return json({ skipped: true, reason: "canal_whatsapp_desativado" });
    }
    if (!test_phone && cfg?.horario_inicio && cfg?.horario_fim) {
      const nowSp = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      const ini = String(cfg.horario_inicio).slice(0, 5);
      const fim = String(cfg.horario_fim).slice(0, 5);
      if (nowSp < ini || nowSp > fim) {
        console.log(`[notify-seller v36] fora da janela ${ini}-${fim} (agora ${nowSp}) — skip`);
        return json({ skipped: true, reason: "fora_da_janela" });
      }
    }

    // ── Gate de funil/etapa (configurável na UI) ──────────────────────────────
    // Briefing só sai para leads que estão na(s) etapa(s) selecionada(s) do funil
    // escolhido no CRM (padrão: "Sem contato" do Funil de Vendas).
    const gatePipelineId = ((cfg as any)?.gate_pipeline_id as string | null)?.trim() || null;
    const gatePipelineName = ((cfg as any)?.gate_pipeline_name as string | null)?.trim() || null;
    const gateStageIds = (((cfg as any)?.gate_stage_ids as string[] | null) ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    const gateStageNames = (((cfg as any)?.gate_stage_names as string[] | null) ?? [])
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    if (!test_phone && (gateStageIds.length > 0 || gateStageNames.length > 0)) {
      const { data: dealRows } = await supabase
        .from("deals")
        .select("pipeline_id, pipeline_name, stage_id, stage_name, created_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(20);

      const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
      const matches = (dealRows ?? []).some((d: any) => {
        if (gatePipelineId && String(d.pipeline_id ?? "") !== gatePipelineId) return false;
        if (!gatePipelineId && gatePipelineName && norm(d.pipeline_name) !== norm(gatePipelineName)) return false;
        const byId = gateStageIds.length > 0 && gateStageIds.includes(String(d.stage_id ?? ""));
        const byName = gateStageNames.length > 0 && gateStageNames.includes(norm(d.stage_name));
        return byId || byName;
      });

      if (!matches) {
        console.log(
          `[notify-seller v40] lead=${lead_id} fora da etapa permitida (funil=${gatePipelineName ?? gatePipelineId ?? "*"}, etapas=${gateStageNames.join("|") || gateStageIds.join("|")}) — skip`,
        );
        return json({ skipped: true, reason: "etapa_nao_permitida" });
      }
    }

    // ── Dedup lock (últimas 24h) ──
    // Conta apenas ENVIOS REAIS. Logs "pendente" gravados pelo trigger duplicado
    // fn_notify_seller_on_lead_assigned NÃO podem bloquear o envio legítimo.
    const sinceIso = new Date(Date.now() - LOCK_HOURS * 3600 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("message_logs")
      .select("id")
      .eq("lead_id", lead_id)
      .in("tipo", ["briefing_vendedor", "briefing_vendedor_block"])
      .in("status", ["enviado", "erro"])
      .gte("created_at", sinceIso)
      .limit(1)
      .maybeSingle();

    if (!test_phone && existing?.id) {
      console.log(`[notify-seller v33] Lock existente lead=${lead_id} — skip`);
      return json({ skipped: true, reason: "lock" });
    }

    // ── Lock ATÔMICO (anti-duplicidade em race) ──
    // Vários gatilhos/chamadores podem invocar a função no mesmo segundo; a checagem
    // acima é read-then-write e perde a corrida. O índice único parcial
    // (lead_id, tipo, data_envio_dia) garante que só UM envio por lead/dia prossiga.
    if (!test_phone) {
      const dia = new Date().toISOString().slice(0, 10);
      const { error: claimErr } = await supabase.from("message_logs").insert({
        lead_id,
        team_member_id,
        tipo: "briefing_vendedor",
        status: "pendente",
        data_envio_dia: dia,
        data_envio: new Date().toISOString(),
      });
      if (claimErr) {
        console.log(`[notify-seller v39] claim recusado lead=${lead_id}: ${claimErr.message}`);
        return json({ skipped: true, reason: "claim_lock" });
      }
    }

    // ── Fetch lead + seller ──
    const [{ data: lead, error: leadErr }, { data: seller, error: sellerErr }] = await Promise.all([
      supabase.from("lia_attendances").select("*").eq("id", lead_id).maybeSingle(),
      supabase
        .from("team_members")
        .select("id, nome_completo, whatsapp_number, evolution_instance_name, evolution_api_key")
        .eq("id", team_member_id)
        .maybeSingle(),
    ]);

    if (leadErr || !lead) {
      await releaseClaim(supabase, lead_id, !!test_phone);
      return json({ error: `lead not found: ${leadErr?.message || lead_id}` }, 404);
    }
    if (sellerErr || !seller) {
      await releaseClaim(supabase, lead_id, !!test_phone);
      return json({ error: `seller not found: ${sellerErr?.message || team_member_id}` }, 404);
    }

    // Sender: instância configurada na UI (credencial própria dela, nunca a do vendedor)
    const senderInstance = (cfg?.sender_instance as string | null)?.trim() || SENDER_INSTANCE;
    const { data: senderRow } = await supabase
      .from("team_members")
      .select("evolution_api_key")
      .eq("evolution_instance_name", senderInstance)
      .not("evolution_api_key", "is", null)
      .limit(1)
      .maybeSingle();
    const senderKey = ((senderRow as any)?.evolution_api_key as string | null)?.trim() || EVO_KEY;

    const rawPhone = (seller as any).whatsapp_number as string | null;
    // Normalizador canônico (repara celular legado de 8 dígitos e DDI).
    const cleanPhone = (normalizeBrazilianPhone(rawPhone || "") || normalizePhone(rawPhone || "") || "")
      .replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 12) {
      await logMsg(supabase, {
        lead_id, team_member_id, whatsapp_number: rawPhone,
        tipo: "briefing_vendedor_block", status: "erro",
        evolution_instance: senderInstance,
        mensagem_preview: null,
        error_details: "seller_missing_whatsapp",
      });
      return json({ error: "seller missing whatsapp_number" }, 422);
    }
    const toNumber = test_phone || cleanPhone;

    // ── Frase pré-montada do link (template da automação) ──
    const includeWaLink = cfg?.incluir_link_wa !== false;
    const waPreset = includeWaLink
      ? renderTemplate(String(cfg?.link_wa_mensagem ?? ""), lead as Record<string, unknown>).trim()
      : "";

    // ── Build briefing ──
    // Template custom da automação tem prioridade quando preenchido.
    const customTpl = String(cfg?.mensagem_template ?? "").trim();
    const useCustom = !!customTpl && cfg?.usar_template_padrao === false;
    let briefing = useCustom
      ? renderTemplate(customTpl, lead as Record<string, unknown>)
      : await buildSellerNotification(lead as Record<string, unknown>, supabase, {
          includeWaLink,
          waLinkPreset: waPreset || null,
        });
    console.log(`[notify-seller v38] template=${useCustom ? "custom" : "padrao"} link=${includeWaLink} preset_len=${waPreset.length}`);

    // Template custom não tem o link embutido — anexa com a frase pronta.
    if (includeWaLink && !briefing.includes("wa.me/")) {
      const leadJid = pickWaJid(lead as Record<string, unknown>);
      if (leadJid.length >= 12) {
        briefing += `\n\n👉 Abrir conversa com o lead:\nhttps://wa.me/${leadJid}${waPreset ? `?text=${encodeURIComponent(waPreset)}` : ""}`;
      } else {
        console.warn(`[notify-seller] sem telefone válido para link wa lead=${lead_id}`);
      }
    }

    // ── Send via Evolution (sempre pela instância sender configurada) ──
    let status: "enviado" | "erro" = "enviado";
    let errorDetails: string | null = null;
    let providerMessageId: string | null = null;
    try {
      const res = await fetch(
        `${EVO_BASE}/message/sendText/${encodeURIComponent(senderInstance)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: senderKey },
          body: JSON.stringify({ number: toNumber, text: briefing }),
          signal: AbortSignal.timeout(60_000),
        }
      );
      if (!res.ok) {
        status = "erro";
        errorDetails = `sendText ${res.status}: ${(await res.text()).slice(0, 300)}`;
      } else {
        const payload = await res.json().catch(() => null);
        providerMessageId = (payload?.key?.id as string | undefined) ?? null;
      }
    } catch (e) {
      status = "erro";
      errorDetails = e instanceof Error ? e.message : String(e);
    }

    if (!test_phone) await logMsg(supabase, {
      lead_id,
      team_member_id,
      whatsapp_number: toNumber,
      tipo: "briefing_vendedor",
      status,
      evolution_instance: senderInstance,
      mensagem_preview: briefing.slice(0, 900),
      error_details: errorDetails,
      provider_message_id: providerMessageId,
    });

    console.log(`[notify-seller v34] lead=${lead_id} seller=${seller.nome_completo} instance=${senderInstance} status=${status} trigger=${trigger}`);
    return json({ success: status === "enviado", status, error: errorDetails });
  } catch (err) {
    console.error("[notify-seller v33] fatal:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// Libera o lock atômico (linha "pendente" do dia) quando o envio não aconteceu.
async function releaseClaim(
  supabase: ReturnType<typeof createClient>,
  lead_id: string | null,
  isTest: boolean,
) {
  if (isTest || !lead_id) return;
  const dia = new Date().toISOString().slice(0, 10);
  await supabase
    .from("message_logs")
    .delete()
    .eq("lead_id", lead_id)
    .eq("tipo", "briefing_vendedor")
    .eq("data_envio_dia", dia)
    .eq("status", "pendente");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Interpola {{variavel}} / {variavel} com campos do lead
function renderTemplate(tpl: string, lead: Record<string, unknown>): string {
  if (!tpl) return "";
  const nome = String(lead.nome ?? lead.nome_completo ?? "").trim();
  const extra: Record<string, unknown> = {
    ...lead,
    nome,
    primeiro_nome: nome.split(/\s+/)[0] ?? "",
  };
  return tpl.replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, (_m, key: string) => {
    const v = extra[key];
    return v === null || v === undefined || v === "" ? "" : String(v);
  });
}

async function logMsg(
  supabase: ReturnType<typeof createClient>,
  row: {
    lead_id: string;
    team_member_id: string | null;
    whatsapp_number: string | null;
    tipo: string;
    status: string;
    evolution_instance: string | null;
    mensagem_preview: string | null;
    error_details?: string | null;
    provider_message_id?: string | null;
  }
) {
  try {
    const payload = {
      lead_id: row.lead_id,
      team_member_id: row.team_member_id,
      whatsapp_number: row.whatsapp_number,
      tipo: row.tipo,
      status: row.status,
      evolution_instance: row.evolution_instance,
      mensagem_preview: row.mensagem_preview,
      error_details: row.error_details ?? null,
      provider_message_id: row.provider_message_id ?? null,
      data_envio: new Date().toISOString(),
    };

    // Existe um índice único parcial (lead_id, tipo, data_envio_dia) para
    // tipo='briefing_vendedor'. Se já houver uma linha do dia (ex.: placeholder
    // "pendente"), o insert falha silenciosamente e o envio real não fica
    // registrado. Então: atualiza a linha do dia se existir, senão insere.
    const dia = new Date().toISOString().slice(0, 10);
    const { data: sameDay } = await supabase
      .from("message_logs")
      .select("id")
      .eq("lead_id", row.lead_id)
      .eq("tipo", row.tipo)
      .eq("data_envio_dia", dia)
      .limit(1)
      .maybeSingle();

    if (sameDay?.id) {
      const { error } = await supabase
        .from("message_logs")
        .update(payload)
        .eq("id", (sameDay as any).id);
      if (error) console.warn("[notify-seller] log update failed:", error.message);
      return;
    }

    const { error } = await supabase.from("message_logs").insert(payload);
    if (error) console.warn("[notify-seller] log insert failed:", error.message);
  } catch (e) {
    console.warn("[notify-seller v33] log insert failed:", e);
  }
}
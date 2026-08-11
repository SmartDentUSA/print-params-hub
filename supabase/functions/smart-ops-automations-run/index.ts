// smart-ops-automations-run — motor das Automações SmartOps (tabela smartops_automations).
// Avalia gatilho (o quê / quando / funil / etapa / como / atraso), renderiza a mensagem
// com variáveis do lead e envia. Cada envio recebe um identificador único (run_uid)
// gravado em smartops_automation_runs, que alimenta a Timeline do Lead via trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVO_BASE = Deno.env.get("EVOLUTION_API_URL") ?? "http://82.25.75.61:8080";
const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "SmartDent_LIA_2026";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizePhone(raw: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

function nowSpHHMM() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

function renderTemplate(tpl: string, lead: Record<string, any>) {
  const nome = String(lead.nome_completo ?? lead.nome ?? "").trim();
  const dict: Record<string, string> = {
    nome,
    primeiro_nome: nome.split(/\s+/)[0] ?? "",
    produto_interesse: String(lead.produto_interesse ?? lead.produto_interesse_auto ?? "").trim(),
    especialidade: String(lead.especialidade ?? "").trim(),
    cidade: String(lead.cidade ?? "").trim(),
    uf: String(lead.uf ?? "").trim(),
    area_atuacao: String(lead.area_atuacao ?? "").trim(),
    proprietario_lead_crm: String(lead.proprietario_lead_crm ?? "").trim(),
    impressora_modelo: String(lead.impressora_modelo ?? "").trim(),
    tem_scanner: String(lead.tem_scanner ?? "").trim(),
    piperun_id: String(lead.piperun_id ?? "").trim(),
    data_treinamento: String(lead.data_treinamento ?? "").trim(),
    software_cad: String(lead.software_cad ?? "").trim(),
    astron_email: String(lead.astron_email ?? lead.email ?? "").trim(),
    email: String(lead.email ?? "").trim(),
    telefone: String(lead.telefone ?? "").trim(),
  };
  return String(tpl ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k) => dict[String(k).toLowerCase()] ?? "");
}

async function sendWhatsApp(supabase: any, instance: string, phone: string, message: string) {
  const { data: row } = await supabase
    .from("team_members")
    .select("evolution_api_key")
    .eq("evolution_instance_name", instance)
    .not("evolution_api_key", "is", null)
    .limit(1)
    .maybeSingle();
  const apikey = (row?.evolution_api_key as string | null)?.trim() || GLOBAL_KEY;

  const stRes = await fetch(`${EVO_BASE}/instance/connectionState/${encodeURIComponent(instance)}`, {
    headers: { apikey }, signal: AbortSignal.timeout(12_000),
  });
  const stJson = await stRes.json().catch(() => ({}));
  const state = (stJson as any)?.instance?.state ?? (stJson as any)?.state ?? null;
  if (state !== "open") return { ok: false, error: `instance_not_connected:${state ?? "unknown"}`, id: null };

  const res = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify({ number: phone, text: message }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `evolution_${res.status}:${JSON.stringify(payload).slice(0, 200)}`, id: null };
  return { ok: true, error: null, id: (payload as any)?.key?.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({} as any));
    const onlyId = body?.automation_id as string | undefined;
    // Modo teste: renderiza e envia para um número, sem lock e sem janela.
    const testPhone = normalizePhone(String(body?.test_phone ?? ""));
    const lookbackMin = Number(body?.lookback_minutes ?? 180);
    // ── Modo evento (webhook do CRM) ──────────────────────────────────────────
    // O motor não depende mais de cron: o webhook do PipeRun chama esta função
    // com o lead + deal alterado e nós avaliamos as regras na hora.
    const evLeadId = body?.lead_id ? String(body.lead_id) : null;
    const evDealId = body?.deal_id ?? null;
    const evPipelineId = body?.pipeline_id ?? null;
    const evPipelineName = body?.pipeline_name ?? null;
    const evStageId = body?.stage_id ?? null;
    const evStageName = body?.stage_name ?? null;
    const eventMode = !!evLeadId && !testPhone;

    let q = supabase.from("smartops_automations").select("*");
    if (onlyId) q = q.eq("id", onlyId);
    else q = q.eq("ativo", true);
    const { data: autos, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results: any[] = [];

    for (const a of autos ?? []) {
      const canais = String(a.canal ?? "whatsapp").split(",").map((c: string) => c.trim().toLowerCase()).filter(Boolean);
      if (!canais.includes("whatsapp")) {
        results.push({ automation: a.nome, skipped: "canal_whatsapp_desativado" });
        continue;
      }

      const hhmm = nowSpHHMM();
      const ini = String(a.horario_inicio ?? "00:00").slice(0, 5);
      const fim = String(a.horario_fim ?? "23:59").slice(0, 5);
      const dentroJanela = hhmm >= ini && hhmm <= fim;
      if (!testPhone && !dentroJanela && !a.mensagem_fora_horario) {
        results.push({ automation: a.nome, skipped: `fora_da_janela ${ini}-${fim}` });
        continue;
      }

      const stageIds = (a.gate_stage_ids ?? []).map((s: any) => String(s));
      const stageNames = (a.gate_stage_names ?? []).map((s: any) => norm(s));

      // ── Seleciona deals que entraram na etapa configurada dentro do lookback ──
      let leads: any[] = [];
      if (testPhone) {
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("*")
          .is("merged_into", null)
          .not("nome_completo", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lead) leads = [{ lead, deal_id: null }];
      } else if (eventMode) {
        // Avalia o gate contra o deal que acabou de mudar no CRM.
        if (a.gate_pipeline_id && String(a.gate_pipeline_id) !== String(evPipelineId ?? "")) {
          results.push({ automation: a.nome, skipped: "pipeline_diferente" });
          continue;
        }
        if (!a.gate_pipeline_id && a.gate_pipeline_name && norm(evPipelineName) !== norm(a.gate_pipeline_name)) {
          results.push({ automation: a.nome, skipped: "pipeline_diferente" });
          continue;
        }
        const byId = stageIds.length > 0 && stageIds.includes(String(evStageId ?? ""));
        const byName = stageNames.length > 0 && stageNames.includes(norm(evStageName));
        const noGate = stageIds.length === 0 && stageNames.length === 0;
        if (!byId && !byName && !noGate) {
          results.push({ automation: a.nome, skipped: "etapa_diferente" });
          continue;
        }
        const { data: lead } = await supabase
          .from("lia_attendances").select("*").eq("id", evLeadId).is("merged_into", null).maybeSingle();
        if (!lead) {
          results.push({ automation: a.nome, skipped: "lead_nao_canonico" });
          continue;
        }
        leads = [{ lead, deal_id: evDealId ?? null }];
      } else {
        const sinceIso = new Date(Date.now() - (lookbackMin + Number(a.delay_minutos ?? 0)) * 60_000).toISOString();
        const untilIso = new Date(Date.now() - Number(a.delay_minutos ?? 0) * 60_000).toISOString();
        let dq = supabase
          .from("deals")
          .select("piperun_deal_id, lead_id, pipeline_id, pipeline_name, stage_id, stage_name, last_stage_updated_at")
          .not("lead_id", "is", null)
          .gte("last_stage_updated_at", sinceIso)
          .lte("last_stage_updated_at", untilIso)
          .limit(300);
        if (a.gate_pipeline_id) dq = dq.eq("pipeline_id", Number(a.gate_pipeline_id));
        const { data: deals } = await dq;
        const matched = (deals ?? []).filter((d: any) => {
          if (!a.gate_pipeline_id && a.gate_pipeline_name && norm(d.pipeline_name) !== norm(a.gate_pipeline_name)) return false;
          const byId = stageIds.length > 0 && stageIds.includes(String(d.stage_id ?? ""));
          const byName = stageNames.length > 0 && stageNames.includes(norm(d.stage_name));
          return byId || byName;
        });
        if (matched.length === 0) {
          results.push({ automation: a.nome, matched: 0 });
          continue;
        }
        const ids = Array.from(new Set(matched.map((d: any) => d.lead_id)));
        const { data: leadRows } = await supabase
          .from("lia_attendances").select("*").in("id", ids).is("merged_into", null);
        leads = (leadRows ?? []).map((lead: any) => ({
          lead,
          deal_id: matched.find((d: any) => d.lead_id === lead.id)?.piperun_deal_id ?? null,
        }));
      }

      for (const { lead, deal_id } of leads) {
        const tpl = (!dentroJanela && a.mensagem_fora_horario) ? a.mensagem_fora_horario : a.mensagem_template;
        if (!tpl || !String(tpl).trim()) {
          results.push({ automation: a.nome, lead_id: lead.id, skipped: "sem_mensagem" });
          continue;
        }
        const message = renderTemplate(String(tpl), lead);

        // Destino
        let destino: string | null = null;
        let destinatarioTipo = String(a.destinatario ?? "lead");
        if (testPhone) { destino = testPhone; destinatarioTipo = "teste"; }
        else if (destinatarioTipo === "numero_fixo") destino = normalizePhone(String(a.destino_numero ?? ""));
        else if (destinatarioTipo === "vendedor") {
          const { data: tm } = await supabase
            .from("team_members").select("whatsapp_number")
            .ilike("nome_completo", String(lead.proprietario_lead_crm ?? ""))
            .eq("ativo", true).limit(1).maybeSingle();
          destino = normalizePhone(String((tm as any)?.whatsapp_number ?? ""));
        } else destino = normalizePhone(String(lead.telefone ?? lead.whatsapp ?? ""));

        if (!destino) {
          results.push({ automation: a.nome, lead_id: lead.id, skipped: "destino_invalido" });
          continue;
        }

        // Cooldown por lead
        if (!testPhone) {
          const cdIso = new Date(Date.now() - Number(a.cooldown_horas ?? 24) * 3600_000).toISOString();
          const { data: recent } = await supabase
            .from("smartops_automation_runs").select("id")
            .eq("automation_id", a.id).eq("lead_id", lead.id)
            .neq("status", "erro").gte("created_at", cdIso).limit(1).maybeSingle();
          if (recent?.id) {
            results.push({ automation: a.nome, lead_id: lead.id, skipped: "cooldown" });
            continue;
          }
        }

        // Claim atômico: o índice único (automation_id, lead_id, run_date) impede duplicidade.
        let runId: string | null = null;
        let runUid: string | null = null;
        if (!testPhone) {
          const { data: claim, error: claimErr } = await supabase
            .from("smartops_automation_runs")
            .insert({
              automation_id: a.id, automation_nome: a.nome, lead_id: lead.id, deal_id,
              canal: "whatsapp", destino, destinatario_tipo: destinatarioTipo,
              sender_instance: a.sender_instance, status: "pendente",
              mensagem_preview: message.slice(0, 2000),
            })
            .select("id, run_uid").maybeSingle();
          if (claimErr || !claim) {
            results.push({ automation: a.nome, lead_id: lead.id, skipped: "claim_lock" });
            continue;
          }
          runId = claim.id; runUid = claim.run_uid;
        }

        const sent = await sendWhatsApp(supabase, String(a.sender_instance), destino, message);

        if (runId) {
          await supabase.from("smartops_automation_runs").update({
            status: sent.ok ? "enviado" : "erro",
            provider_message_id: sent.id,
            error_details: sent.error,
          }).eq("id", runId);
        }

        results.push({
          automation: a.nome, lead_id: lead.id, run_uid: runUid,
          destino, ok: sent.ok, error: sent.error,
        });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("smart-ops-automations-run error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

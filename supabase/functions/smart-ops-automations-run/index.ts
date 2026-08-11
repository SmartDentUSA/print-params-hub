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

// Resolve o JID canônico no WhatsApp (corrige 9º dígito brasileiro).
async function resolveWaNumber(instance: string, apikey: string, phone: string): Promise<string | null> {
  const d = (phone || "").replace(/\D/g, "");
  const variants = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") variants.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) variants.add(d.slice(0, 4) + "9" + d.slice(4));
  try {
    const res = await fetch(`${EVO_BASE}/chat/whatsappNumbers/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ numbers: [...variants] }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const rows = await res.json() as Array<{ exists?: boolean; jid?: string; number?: string }>;
    const hit = (rows || []).find((r) => r?.exists);
    if (!hit) return null;
    return String(hit.jid || hit.number || "").replace(/@.*$/, "").replace(/\D/g, "") || null;
  } catch {
    return null;
  }
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

  const target = (await resolveWaNumber(instance, apikey, phone)) || phone;
  const res = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify({ number: target, text: message }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `evolution_${res.status}:${JSON.stringify(payload).slice(0, 200)}`, id: null };
  return { ok: true, error: null, id: (payload as any)?.key?.id ?? null };
}

// ── SMS (DisparoPro HTTPS MT) ────────────────────────────────────────────────
async function sendSms(phone: string, message: string) {
  const token = Deno.env.get("DISPARO_PRO_TOKEN");
  if (!token) return { ok: false, error: "DISPARO_PRO_TOKEN_nao_configurado", id: null };
  const texto = message.replace(/\s+/g, " ").trim().slice(0, 160);
  const res = await fetch("https://apihttp.disparopro.com.br:8433/mt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify([{
      numero: phone,
      servico: Deno.env.get("DISPARO_PRO_SERVICO") || "short",
      mensagem: texto,
      codificacao: "0",
      nome_campanha: "SmartOps Automacao",
    }]),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await res.text();
  let item: any = {};
  try {
    const p = JSON.parse(raw);
    item = Array.isArray(p?.detail) ? p.detail[0] : (p?.detail ?? p);
  } catch { /* keep raw */ }
  const accepted = res.ok && (item?.status === "ACCEPTED" || item?.status === "SENT");
  if (!accepted) return { ok: false, error: `sms_${res.status}:${String(item?.descricao_detalhe ?? raw).slice(0, 200)}`, id: null };
  return { ok: true, error: null, id: item?.id ? String(item.id) : null };
}

// ── E-mail (Gmail via connector gateway) ────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, fromName: string) {
  // Delega para smart-ops-send-gmail (mesmo caminho já validado nas Campanhas de e-mail).
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const doc = /<html[\s>]/i.test(html)
    ? html
    : `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#222">${html}</body></html>`;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        campaign_name: `Automação: ${subject || "SmartOps"}`,
        description: "smartops_automation",
        from_name: fromName,
        subject: subject || "(sem assunto)",
        html: doc,
        skip_cta_check: true,
        test_email: to, // envio 1:1 imediato
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || (j as any)?.ok === false) {
      return {
        ok: false,
        error: `gmail_${res.status}:${String((j as any)?.error ?? JSON.stringify(j)).slice(0, 200)}`,
        id: null,
      };
    }
    return { ok: true, error: null, id: (j as any)?.send_log_id ?? (j as any)?.id ?? null };
  } catch (e) {
    return { ok: false, error: `gmail_exception:${String(e).slice(0, 180)}`, id: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({} as any));
    const onlyId = body?.automation_id as string | undefined;
    // Modo teste: renderiza e envia para um número, sem lock e sem janela.
    const testPhone = normalizePhone(String(body?.test_phone ?? ""));
    const testEmail = String(body?.test_email ?? "").trim() || null;
    const testCanais = (Array.isArray(body?.test_canais) ? body.test_canais : [])
      .map((c: any) => norm(c)).filter(Boolean) as string[];
    const testMode = !!(testPhone || testEmail);
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
    const eventMode = !!evLeadId && !testMode;
    const skipDelay = body?.skip_delay === true;
    // Gatilho do evento: casa com a coluna `quando` da automação.
    const evTrigger = norm(body?.trigger ?? "") || "etapa_alterada";

    // Reagenda a própria função depois do atraso configurado (sem cron).
    const scheduleDelayed = (automationId: string, minutes: number) => {
      const p = (async () => {
        await new Promise((r) => setTimeout(r, Math.min(minutes, 15) * 60_000));
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-automations-run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            automation_id: automationId, skip_delay: true,
            trigger: evTrigger,
            lead_id: evLeadId, deal_id: evDealId, pipeline_id: evPipelineId,
            pipeline_name: evPipelineName, stage_id: evStageId, stage_name: evStageName,
          }),
        }).catch((e) => console.warn("[automations-run] delayed self-call failed:", e));
      })();
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);
    };

    let q = supabase.from("smartops_automations").select("*");
    if (onlyId) q = q.eq("id", onlyId);
    else q = q.eq("ativo", true);
    const { data: autos, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results: any[] = [];

    for (const a of autos ?? []) {
      const configurados = String(a.canal ?? "whatsapp").split(",").map((c: string) => c.trim().toLowerCase()).filter(Boolean);
      const canais = testMode && testCanais.length > 0
        ? testCanais // em teste, respeita o canal pedido mesmo que ainda não esteja salvo
        : configurados;
      if (canais.length === 0) {
        results.push({ automation: a.nome, skipped: "nenhum_canal_ativo" });
        continue;
      }

      const hhmm = nowSpHHMM();
      const ini = String(a.horario_inicio ?? "00:00").slice(0, 5);
      const fim = String(a.horario_fim ?? "23:59").slice(0, 5);
      const dentroJanela = hhmm >= ini && hhmm <= fim;
      if (!testMode && !dentroJanela && !a.mensagem_fora_horario) {
        results.push({ automation: a.nome, skipped: `fora_da_janela ${ini}-${fim}` });
        continue;
      }

      const stageIds = (a.gate_stage_ids ?? []).map((s: any) => String(s));
      const stageNames = (a.gate_stage_names ?? []).map((s: any) => norm(s));

      // ── Seleciona deals que entraram na etapa configurada dentro do lookback ──
      let leads: any[] = [];
      if (testMode) {
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("*")
          .is("merged_into", null)
          .not("nome", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lead) leads = [{ lead, deal_id: null }];
      } else if (eventMode) {
        // 1) Gatilho precisa casar com o evento recebido.
        if (norm(a.quando ?? "etapa_alterada") !== evTrigger) {
          results.push({ automation: a.nome, skipped: `gatilho_diferente:${evTrigger}` });
          continue;
        }
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
        // Em "etapa_alterada" o gate de etapa é obrigatório: sem etapa selecionada a
        // regra dispararia em qualquer alteração de deal do CRM.
        if (noGate && evTrigger === "etapa_alterada") {
          results.push({ automation: a.nome, skipped: "sem_etapa_configurada" });
          continue;
        }
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
        const delayMin = Number(a.delay_minutos ?? 0);
        if (delayMin > 0 && !skipDelay) {
          scheduleDelayed(String(a.id), delayMin);
          results.push({ automation: a.nome, scheduled_in_minutes: Math.min(delayMin, 15) });
          continue;
        }
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
        // Resolve telefone/e-mail de destino (uma vez por lead)
        let destinatarioTipo = String(a.destinatario ?? "lead");
        let fone: string | null = null;
        let mail: string | null = null;

        if (testMode) {
          destinatarioTipo = "teste";
          fone = testPhone;
          mail = testEmail;
        } else if (destinatarioTipo === "numero_fixo") {
          fone = normalizePhone(String(a.destino_numero ?? ""));
          mail = String(lead.email ?? "").trim() || null;
        } else if (destinatarioTipo === "vendedor") {
          const ownerName = String(lead.proprietario_lead_crm ?? "").trim();
          let tm: any = null;
          if (ownerName) {
            const { data: exact } = await supabase
              .from("team_members").select("notification_phone, whatsapp_number, email")
              .ilike("nome_completo", ownerName).eq("ativo", true).limit(1).maybeSingle();
            tm = exact;
            if (!tm) {
              const { data: fuzzy } = await supabase
                .from("team_members").select("notification_phone, whatsapp_number, email")
                .ilike("nome_completo", `%${ownerName.split(/\s+/)[0]}%`)
                .eq("ativo", true).limit(1).maybeSingle();
              tm = fuzzy;
            }
          }
          fone = normalizePhone(String((tm as any)?.notification_phone ?? (tm as any)?.whatsapp_number ?? ""));
          mail = String((tm as any)?.email ?? "").trim() || null;
        } else {
          fone = normalizePhone(String(lead.telefone ?? lead.whatsapp ?? ""));
          mail = String(lead.email ?? "").trim() || null;
        }

        for (const canal of canais) {
          const baseTpl = canal === "sms"
            ? (a.sms_template || a.mensagem_template)
            : ((!dentroJanela && a.mensagem_fora_horario) ? a.mensagem_fora_horario : a.mensagem_template);
          const emailHtmlTpl = a.email_html || a.mensagem_template;
          const tpl = canal === "email" ? emailHtmlTpl : baseTpl;
          if (!tpl || !String(tpl).trim()) {
            results.push({ automation: a.nome, canal, lead_id: lead.id, skipped: "sem_mensagem" });
            continue;
          }
          const message = renderTemplate(String(tpl), lead);
          const assunto = canal === "email"
            ? renderTemplate(String(a.email_assunto ?? a.nome ?? "Smart Dent"), lead)
            : null;

          const destino = canal === "email" ? mail : fone;
          if (!destino) {
            results.push({ automation: a.nome, canal, lead_id: lead.id, skipped: "destino_invalido" });
            continue;
          }

          // Cooldown por lead/canal
          if (!testMode) {
            const cdIso = new Date(Date.now() - Number(a.cooldown_horas ?? 24) * 3600_000).toISOString();
            const { data: recent } = await supabase
              .from("smartops_automation_runs").select("id")
              .eq("automation_id", a.id).eq("lead_id", lead.id).eq("canal", canal)
              .neq("status", "erro").gte("created_at", cdIso).limit(1).maybeSingle();
            if (recent?.id) {
              results.push({ automation: a.nome, canal, lead_id: lead.id, skipped: "cooldown" });
              continue;
            }
          }

          // Claim atômico: índice único (automation_id, lead_id, canal, run_date).
          let runId: string | null = null;
          let runUid: string | null = null;
          if (!testMode) {
            const { data: claim, error: claimErr } = await supabase
              .from("smartops_automation_runs")
              .insert({
                automation_id: a.id, automation_nome: a.nome, lead_id: lead.id, deal_id,
                canal, destino, destinatario_tipo: destinatarioTipo,
                sender_instance: canal === "whatsapp" ? a.sender_instance : canal,
                status: "pendente",
                mensagem_preview: (assunto ? `${assunto} — ` : "") + message.slice(0, 2000),
              })
              .select("id, run_uid").maybeSingle();
            if (claimErr || !claim) {
              results.push({ automation: a.nome, canal, lead_id: lead.id, skipped: "claim_lock" });
              continue;
            }
            runId = claim.id; runUid = claim.run_uid;
          }

          const sent = canal === "whatsapp"
            ? await sendWhatsApp(supabase, String(a.sender_instance), destino, message)
            : canal === "sms"
              ? await sendSms(destino, message)
              : canal === "email"
                ? await sendEmail(destino, String(assunto ?? a.nome), message, String(a.email_remetente ?? "Smart Dent | Fluxo Digital"))
                : { ok: false, error: `canal_nao_suportado:${canal}`, id: null };

          if (runId) {
            await supabase.from("smartops_automation_runs").update({
              status: sent.ok ? "enviado" : "erro",
              provider_message_id: sent.id,
              error_details: sent.error,
            }).eq("id", runId);
          }

          results.push({
            automation: a.nome, canal, lead_id: lead.id, run_uid: runUid,
            destino, ok: sent.ok, error: sent.error,
          });
        }
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("smart-ops-automations-run error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

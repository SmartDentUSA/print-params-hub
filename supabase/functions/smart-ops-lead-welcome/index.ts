import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const EVOLUTION_BASE = Deno.env.get("EVOLUTION_BASE_URL") || "http://82.25.75.61:8080";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COOLDOWN_ERRO_HORAS = 4;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toMinutes(hhmm: string | null | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isBusinessHours(inicio?: string | null, fim?: string | null): boolean {
  const sp    = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const day   = sp.getDay();
  const mins  = sp.getHours() * 60 + sp.getMinutes();
  const start = toMinutes(inicio, 8 * 60);
  const end   = toMinutes(fim, 18 * 60);
  if (day >= 1 && day <= 5) return mins >= start && mins < end;
  if (day === 6)            return mins >= start && mins < Math.min(end, 12 * 60);
  return false;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55")) {
    if (d.length === 13) return d;
    if (d.length === 12) return d.slice(0, 4) + "9" + d.slice(4);
    return d.length >= 11 ? d : null;
  }
  return (d.length === 11 || d.length === 10) ? `55${d}` : null;
}

async function getLiaConfig(
  supa: ReturnType<typeof createClient>,
  preferredInstance?: string | null,
) {
  // 1) Instância escolhida na automação (UI) — credencial por instância
  if (preferredInstance) {
    const { data: chosen } = await supa.from("team_members")
      .select("evolution_instance_name, evolution_api_key")
      .eq("evolution_instance_name", preferredInstance)
      .eq("ativo", true)
      .maybeSingle();
    if (chosen?.evolution_instance_name) {
      return {
        instance: chosen.evolution_instance_name as string,
        apiKey: (chosen.evolution_api_key as string) || Deno.env.get("EVOLUTION_API_KEY") || "SmartDent_LIA_2026",
      };
    }
    try {
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lead-welcome",
        severity: "warning",
        error_type: "instancia_configurada_invalida",
        details: { instancia: preferredInstance, motivo: "não encontrada ou inativa em team_members" },
      });
    } catch { /* silencioso */ }
  }

  // 2) Fallback legado: membro com role lia_comms
  const { data: member } = await supa.from("team_members")
    .select("evolution_instance_name, evolution_api_key").eq("role", "lia_comms").eq("ativo", true).limit(1).maybeSingle();
  if (!member?.evolution_instance_name) {
    try {
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lead-welcome",
        severity: "warning",
        error_type: "lia_comms_inativo",
        details: {
          motivo: "Nenhum team_member com role=lia_comms e ativo=true",
          fallback: "Dra. Lia",
        },
      });
    } catch { /* silencioso */ }
  }
  const instance = member?.evolution_instance_name || "Dra. Lia";
  const { data: cfg } = await supa.from("system_config")
    .select("config_value").eq("config_key", "evolution_lia_api_key").maybeSingle();
  let apiKey = Deno.env.get("EVOLUTION_API_KEY") || "SmartDent_LIA_2026";
  if (cfg?.config_value) {
    try { apiKey = JSON.parse(cfg.config_value as string); } catch { apiKey = cfg.config_value as string; }
  }
  if (member?.evolution_api_key) apiKey = member.evolution_api_key as string;
  return { instance, apiKey };
}

async function getAutomacao(supa: ReturnType<typeof createClient>) {
  const { data } = await supa.from("lia_automations")
    .select("mensagem_horario_comercial, mensagem_fora_horario, ativo, horario_inicio, horario_fim, evolution_instance_name")
    .eq("slug", "boas_vindas_lead").single();
  if (!data || !data.ativo) return null;
  return {
    msgComercial: data.mensagem_horario_comercial,
    msgForaHorario: data.mensagem_fora_horario,
    horarioInicio: data.horario_inicio as string | null,
    horarioFim: data.horario_fim as string | null,
    instancia: data.evolution_instance_name as string | null,
  };
}

function buildMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`);
}

async function tryAcquireSendLock(supa: ReturnType<typeof createClient>, leadId: string): Promise<boolean> {
  const { count } = await supa.from("message_logs")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("tipo", "boas_vindas").eq("status", "enviado")
    .like("mensagem_preview", "Ol%");
  if ((count ?? 0) > 0) return false;

  const { data } = await supa.from("boas_vindas_locks")
    .insert({ lead_id: leadId })
    .select("lead_id").single();
  return !!data;
}

async function checkCooldown(supa: ReturnType<typeof createClient>, leadId: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_ERRO_HORAS * 3600_000).toISOString();
  const { count } = await supa.from("message_logs")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("tipo", "boas_vindas").eq("status", "erro")
    .like("mensagem_preview", "Ol%")
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

async function safeLog(
  supa: ReturnType<typeof createClient>,
  leadId: string, phone: string | null,
  status: string, preview: string,
  instance?: string, errorDetails?: string
) {
  try {
    await supa.from("message_logs").insert({
      lead_id: leadId, whatsapp_number: phone,
      data_envio: new Date().toISOString(),
      data_envio_dia: new Date().toISOString().slice(0, 10),
      tipo: "boas_vindas", mensagem_preview: preview.slice(0, 200),
      status, error_details: errorDetails || null,
      evolution_instance: instance || null,
    });
  } catch { /* silencioso */ }
}

/**
 * Registra o lead como contato na instância do WhatsApp antes de enviar.
 * Reduz risco de bloqueio pois a mensagem vai para um contato salvo.
 */
async function upsertWhatsAppContact(
  instance: string,
  apiKey: string,
  phone: string,
  nome: string
): Promise<void> {
  try {
    await fetch(
      `${EVOLUTION_BASE}/contact/upsert/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          contacts: [{
            id:       `${phone}@s.whatsapp.net`,
            fullName: nome,
          }]
        }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    console.log(`[lead-welcome v24] contato criado: ${nome} ${phone}`);
  } catch (e) {
    // Não fatal — continua para o envio mesmo se falhar
    console.warn(`[lead-welcome v24] upsert contato falhou (não fatal): ${(e as Error).message}`);
  }
}

async function sendViaEvolution(instance: string, apiKey: string, phone: string, text: string) {
  return await sendViaEvolutionImpl(instance, apiKey, phone, text);
}

async function isInstanceOpen(instance: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${EVOLUTION_BASE}/instance/connectionState/${encodeURIComponent(instance)}`,
      { headers: { apikey: apiKey }, signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return false;
    const j = await res.json();
    const state = j?.instance?.state ?? j?.state;
    return state === "open";
  } catch {
    return false;
  }
}

async function sendViaEvolutionImpl(instance: string, apiKey: string, phone: string, text: string) {
  try {
    const res = await fetch(
      `${EVOLUTION_BASE}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: phone, text }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message };
  }
}

/**
 * Descobre o JID real do número no WhatsApp. No Brasil há duas grafias
 * possíveis (com e sem o 9 do celular) — o link wa.me só funciona na grafia
 * que realmente existe. Retorna o número canônico ou null se não existir.
 */
async function resolveWaNumber(
  instance: string,
  apiKey: string,
  phone: string,
): Promise<string | null> {
  const d = phone.replace(/\D/g, "");
  const variants = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") variants.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) variants.add(d.slice(0, 4) + "9" + d.slice(4));
  try {
    const res = await fetch(
      `${EVOLUTION_BASE}/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ numbers: [...variants] }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return null;
    const rows = await res.json() as Array<{ exists?: boolean; jid?: string; number?: string }>;
    const hit = (rows || []).find((r) => r?.exists);
    if (!hit) return null;
    return String(hit.jid || hit.number || "").replace(/@.*$/, "").replace(/\D/g, "") || null;
  } catch {
    return null;
  }
}

async function processLead(
  supa: ReturnType<typeof createClient>,
  lead: Record<string, unknown>,
  automacao: {
    msgComercial: string;
    msgForaHorario: string;
    horarioInicio?: string | null;
    horarioFim?: string | null;
  },
  instance: string,
  apiKey: string
): Promise<{ leadId: string; result: string }> {
  const leadId = lead.id as string;

  const phone = normalizePhone(
    (lead.telefone_normalized as string) || (lead.telefone_raw as string)
  );
  if (!phone) {
    await safeLog(supa, leadId, null, "skipped", "sem telefone do lead");
    return { leadId, result: "no_phone" };
  }

  // Lock atômico — 1 envio por lead
  const locked = await tryAcquireSendLock(supa, leadId);
  if (!locked) return { leadId, result: "locked" };

  const inCooldown = await checkCooldown(supa, leadId);
  if (inCooldown) {
    await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);
    return { leadId, result: "cooldown" };
  }

  const vendedorNome = lead.proprietario_lead_crm as string | null;
  if (!vendedorNome) {
    await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);
    await safeLog(supa, leadId, phone, "skipped", "sem vendedor");
    return { leadId, result: "no_seller" };
  }

  // Lookup robusto via unaccent
  const { data: seller } = await supa.rpc("fn_get_seller_by_name", { p_name: vendedorNome });
  const sellerRow   = Array.isArray(seller) ? seller[0] : seller;
  const sellerPhone = normalizePhone(
    (sellerRow?.notification_phone as string) || (sellerRow?.whatsapp_number as string)
  );

  if (!sellerPhone) {
    await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);
    await safeLog(supa, leadId, phone, "skipped", `sem telefone do vendedor: ${vendedorNome}`);
    return { leadId, result: `no_seller_phone:${vendedorNome}` };
  }

  // Produto SEMPRE do interesse real do lead — nunca um nome genérico/aleatório.
  const produto      = ((lead.produto_interesse as string | null)?.trim())
                    || ((lead.produto_interesse_auto as string | null)?.trim())
                    || "nossos produtos";
  const nomeVendedor = (sellerRow?.nome_completo as string) || vendedorNome;
  const waText       = encodeURIComponent(`Olá ${nomeVendedor}, quero saber mais sobre ${produto}`);
  // O link só pode usar a grafia do número que EXISTE no WhatsApp (com/sem o 9).
  const sellerJid    = (await resolveWaNumber(instance, apiKey, sellerPhone)) || sellerPhone;
  const linkWa       = `https://wa.me/${sellerJid}?text=${waText}`;
  if (sellerJid === sellerPhone) {
    // não confirmado no WhatsApp — registra para o time corrigir o cadastro
    try {
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lead-welcome",
        severity: "warning",
        error_type: "vendedor_whatsapp_nao_confirmado",
        lead_id: leadId,
        details: { vendedor: nomeVendedor, telefone: sellerPhone },
      });
    } catch { /* silencioso */ }
  }
  const nomeLead     = ((lead.nome as string) || "Doutor(a)").split(" ")[0];

  // ── GUARDA: instância precisa estar conectada ─────────────────────────────
  if (!(await isInstanceOpen(instance, apiKey))) {
    await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);
    await safeLog(supa, leadId, phone, "skipped", `instancia offline: ${instance}`, instance);
    try {
      await supa.from("system_health_logs").insert({
        function_name: "smart-ops-lead-welcome",
        severity: "error",
        error_type: "welcome_instancia_offline",
        lead_id: leadId,
        details: { instance, motivo: "state != open" },
      });
    } catch { /* silencioso */ }
    return { leadId, result: "instancia_offline" };
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── PASSO 1: Registrar lead como contato no WhatsApp ──────────────────────
  const nomeCompleto = (lead.nome as string) || nomeLead;
  await upsertWhatsAppContact(instance, apiKey, phone, nomeCompleto);

  // Pequena pausa para o contato ser processado pelo WhatsApp
  await new Promise(r => setTimeout(r, 1500));
  // ──────────────────────────────────────────────────────────────────────────

  // ── PASSO 2: Enviar mensagem de boas-vindas ────────────────────────────────
  const comercial = isBusinessHours(automacao.horarioInicio, automacao.horarioFim);
  const template  = (comercial ? automacao.msgComercial : automacao.msgForaHorario)
                    || automacao.msgComercial || automacao.msgForaHorario || "";
  if (!template.trim()) {
    await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);
    await safeLog(supa, leadId, phone, "skipped", `template vazio (${comercial ? "comercial" : "fora do horário"})`, instance);
    return { leadId, result: "template_vazio" };
  }
  const message  = buildMessage(template, { nome: nomeLead, produto, vendedor: nomeVendedor, link_wa: linkWa });

  const evo = await sendViaEvolution(instance, apiKey, phone, message);
  console.log(`[lead-welcome v24] ok=${evo.ok} lead=${leadId} phone=${phone}`);
  // ──────────────────────────────────────────────────────────────────────────

  await safeLog(supa, leadId, phone,
    evo.ok ? "enviado" : "erro",
    message, instance,
    evo.ok ? undefined : `${evo.status}: ${evo.body}`
  );

  if (!evo.ok) await supa.from("boas_vindas_locks").delete().eq("lead_id", leadId);

  return { leadId, result: evo.ok ? "enviado" : `erro:${evo.status}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    try { await supa.from("boas_vindas_locks").delete().lt("locked_at", new Date(Date.now() - 24 * 3600_000).toISOString()); } catch { /* silencioso */ }

    let singleLeadId: string | null = null;
    if (req.method === "POST") {
      try { const b = await req.json(); singleLeadId = b?.lead_id || null; } catch { /* cron mode */ }
    }

    const automacao = await getAutomacao(supa);
    if (!automacao)
      return new Response(JSON.stringify({ skipped: true, reason: "automacao_inativa" }), { headers: corsHeaders });
    const liaConfig = await getLiaConfig(supa, automacao.instancia);

    let leads: Record<string, unknown>[];
    if (singleLeadId) {
      const { data } = await supa.from("lia_attendances")
        .select("id, nome, telefone_raw, telefone_normalized, produto_interesse, produto_interesse_auto, proprietario_lead_crm")
        .eq("id", singleLeadId).is("merged_into", null).single();
      leads = data ? [data] : [];
    } else {
      const since48h = new Date(Date.now() - 48 * 3600_000).toISOString();
      const { data } = await supa.from("lia_attendances")
        .select("id, nome, telefone_raw, telefone_normalized, produto_interesse, produto_interesse_auto, proprietario_lead_crm")
        .ilike("piperun_pipeline_name", "%funil%vendas%")
        .ilike("piperun_stage_name", "%sem%contato%")
        .is("merged_into", null)
        .gte("updated_at", since48h)
        .order("updated_at", { ascending: false })
        .limit(50);
      leads = (data as Record<string, unknown>[]) || [];
    }

    const results: Record<string, string> = {};
    for (const lead of leads) {
      try {
        const r = await processLead(supa, lead, automacao, liaConfig.instance, liaConfig.apiKey);
        results[r.leadId] = r.result;
      } catch (err) {
        results[lead.id as string] = `exception:${(err as Error).message}`;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: leads.length,
        instance: liaConfig.instance,
        business_hours: isBusinessHours(automacao.horarioInicio, automacao.horarioFim),
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[lead-welcome v24] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
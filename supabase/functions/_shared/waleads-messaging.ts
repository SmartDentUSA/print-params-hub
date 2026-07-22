/**
 * WaLeads Messaging — send messages, build notifications, AI greetings.
 * Extracted from smart-ops-lia-assign for reuse.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, extractUsage } from "./log-ai-usage.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const CHAT_API = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BLOCKED_SELLER_NAMES = ["Celular", "Comercial", "Vendas", "Smart Dent"];
const LIA_SOURCES = ["dra-lia", "whatsapp_lia", "handoff_lia"];

// ─── Deals Context (shared helper) ───

export interface DealRow {
  piperun_deal_id?: string | number | null;
  pipeline_name?: string | null;
  stage_name?: string | null;
  status?: string | null;
  owner_name?: string | null;
  piperun_created_at?: string | null;
}

export interface DealsContext {
  total: number;
  ganhos: number;
  perdidos: number;
  abertos: number;
  currentOwner: string | null;
  distinctOwners: string[];
  firstContactAt: string | null;
  recent: DealRow[];
}

function classifyStatus(s?: string | null): "ganho" | "perdido" | "aberto" {
  const v = String(s || "").toLowerCase();
  if (v.includes("ganh") || v === "won") return "ganho";
  if (v.includes("perd") || v === "lost") return "perdido";
  return "aberto";
}

export async function fetchDealsContext(
  supabase: SupabaseClient,
  lead: Record<string, unknown>
): Promise<DealsContext> {
  const empty: DealsContext = {
    total: 0, ganhos: 0, perdidos: 0, abertos: 0,
    currentOwner: null, distinctOwners: [], firstContactAt: null, recent: [],
  };
  try {
    const leadId = lead.id as string | undefined;
    if (!leadId) return empty;
    const { data: deals } = await supabase
      .from("deals")
      .select("piperun_deal_id, pipeline_name, stage_name, status, owner_name, piperun_created_at")
      .eq("lead_id", leadId)
      .eq("is_deleted", false)
      .order("piperun_created_at", { ascending: false })
      .limit(20);
    const list = (deals || []) as DealRow[];
    if (list.length === 0) {
      const fc = (lead.data_primeiro_contato || lead.created_at || null) as string | null;
      return { ...empty, firstContactAt: fc };
    }
    let ganhos = 0, perdidos = 0, abertos = 0;
    for (const d of list) {
      const k = classifyStatus(d.status);
      if (k === "ganho") ganhos++;
      else if (k === "perdido") perdidos++;
      else abertos++;
    }
    const currentOwner = list[0]?.owner_name || null;
    // Distinct owners ordered chronologically (oldest -> newest)
    const chrono = [...list].reverse();
    const seen = new Set<string>();
    const distinctOwners: string[] = [];
    for (const d of chrono) {
      const o = (d.owner_name || "").trim();
      if (o && !seen.has(o)) { seen.add(o); distinctOwners.push(o); }
    }
    // First contact = MIN(deal.piperun_created_at, lead.data_primeiro_contato, lead.created_at)
    const candidates: number[] = [];
    for (const d of list) {
      if (d.piperun_created_at) {
        const t = Date.parse(String(d.piperun_created_at));
        if (!isNaN(t)) candidates.push(t);
      }
    }
    for (const v of [lead.data_primeiro_contato, lead.created_at]) {
      if (v) {
        const t = Date.parse(String(v));
        if (!isNaN(t)) candidates.push(t);
      }
    }
    const firstContactAt = candidates.length > 0
      ? new Date(Math.min(...candidates)).toISOString()
      : null;
    return {
      total: list.length, ganhos, perdidos, abertos,
      currentOwner, distinctOwners, firstContactAt,
      recent: list.slice(0, 5),
    };
  } catch (e) {
    console.warn("[waleads-messaging] fetchDealsContext failed:", e);
    return empty;
  }
}

function formatDealsBlock(ctx: DealsContext): string {
  if (ctx.total === 0) return "Sem deals registrados no histórico.";
  const header = `Total de deals: ${ctx.total} (${ctx.ganhos} ganhos · ${ctx.perdidos} perdidos · ${ctx.abertos} abertos)`;
  const owners = ctx.distinctOwners.length > 0
    ? `Owners distintos no histórico (cronológico): ${ctx.distinctOwners.join(" → ")}`
    : "Owners distintos no histórico: nenhum registrado";
  const current = `Vendedor atual: ${ctx.currentOwner || "sem owner"}`;
  const recent = ctx.recent.map((d) => {
    const date = d.piperun_created_at ? formatDate(d.piperun_created_at) : "—";
    return `  - #${d.piperun_deal_id || "?"} — ${d.pipeline_name || "—"} / ${d.stage_name || "—"} — ${d.status || "—"} — ${d.owner_name || "—"} — ${date}`;
  }).join("\n");
  return `${header}\n${current}\n${owners}\nDeals (mais recente primeiro):\n${recent}`;
}

// Strip sentences that cite seller names not in the allowlist (deal owners).
function stripUnknownSellerNames(text: string, allowedOwners: string[], leadName: string): string {
  if (!text) return text;
  const allowed = new Set(allowedOwners.flatMap((o) => o.split(/\s+/)).map((t) => t.toLowerCase()));
  const leadFirst = (leadName || "").split(/\s+/)[0]?.toLowerCase() || "";
  // Pattern: "vendedor[a] Fulano [Sobrenome]" or "Sra/Sr/Dr/Dra Fulano"
  const pattern = /\b(vendedor[a]?|sra\.?|sr\.?|dra?\.?)\s+([A-ZÀ-Ý][\wÀ-ÿ]+)(?:\s+([A-ZÀ-Ý][\wÀ-ÿ]+))?/g;
  return text.replace(pattern, (match, _title, first: string, last?: string) => {
    const f = first.toLowerCase();
    const l = (last || "").toLowerCase();
    if (f === leadFirst) return match; // lead-name handler runs separately
    if (allowed.has(f) || (l && allowed.has(l))) return match;
    return "vendedor anterior";
  });
}

export async function sendWaLeadsMessage(
  supabaseUrl: string,
  serviceKey: string,
  teamMemberId: string,
  phone: string,
  message: string,
  leadId: string
): Promise<{ success: boolean; status?: number; response?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_member_id: teamMemberId,
        phone,
        tipo: "text",
        message,
        lead_id: leadId,
      }),
    });
    const resText = await res.text();
    return { success: res.ok, status: res.status, response: resText.slice(0, 300) };
  } catch (e) {
    console.warn("[waleads-messaging] Send error:", e);
    return { success: false, response: String(e) };
  }
}

function buildStaticGreeting(lead: Record<string, unknown>, sellerName: string): string {
  const leadName = (lead.nome as string || "").split(" ")[0] || "doutor(a)";
  const firstName = sellerName.split(" ")[0];
  return `Olá ${leadName}! Sou ${firstName} da Smart Dent 🦷\nVi que você conversou com nossa Dra. L.I.A. e gostaria de continuar te ajudando pessoalmente.\nComo posso te auxiliar?`;
}

export async function generateAILeadGreeting(
  lead: Record<string, unknown>,
  sellerName: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return buildStaticGreeting(lead, sellerName);

  const firstName = sellerName.split(" ")[0];
  if (BLOCKED_SELLER_NAMES.some(b => firstName.toLowerCase() === b.toLowerCase())) {
    return buildStaticGreeting(lead, "Equipe Smart Dent");
  }

  const leadName = (lead.nome as string || "").split(" ")[0] || "doutor(a)";
  const resumo = lead.resumo_historico_ia as string || "";
  const produto = lead.produto_interesse as string || "";

  const prompt = `Você é ${firstName}, consultor(a) de odontologia digital da Smart Dent.
Gere uma saudação curta (3-4 linhas) para o WhatsApp do lead ${leadName}.
O lead conversou com nossa assistente virtual Dra. L.I.A. sobre: ${produto || "produtos de odontologia digital"}.
${resumo ? `Resumo da conversa:\n${resumo.slice(0, 500)}` : ""}

Regras:
- Seja profissional mas acolhedor
- Mencione que viu a conversa com a Dra. L.I.A.
- Não use emojis excessivos (máx 2)
- NÃO inclua links
- Assine como ${firstName} da Smart Dent`;

  try {
    const res = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const usage = extractUsage(data);
    await logAIUsage({
      functionName: "waleads-messaging",
      actionLabel: "generate-greeting",
      model: "google/gemini-2.5-flash-lite",
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
    const content = data.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 20) return content;
  } catch (e) {
    console.warn("[waleads-messaging] AI greeting failed:", e);
  }
  return buildStaticGreeting(lead, sellerName);
}

export async function buildSellerNotification(
  lead: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<string> {
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const urgencyEmoji = (lead.urgency_level === "alta") ? "🔴" : (lead.urgency_level === "media") ? "🟡" : "🟢";

  // Fetch last user message via leads bridge
  let lastQuestion = "";
  try {
    const { data: leadsRec } = await supabase
      .from("leads")
      .select("id")
      .eq("email", lead.email as string)
      .maybeSingle();
    if (leadsRec?.id) {
      const { data: lastMsg } = await supabase
        .from("agent_interactions")
        .select("user_message")
        .eq("lead_id", leadsRec.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg?.user_message) lastQuestion = String(lastMsg.user_message).slice(0, 200);
    }
  } catch (e) {
    console.warn("[waleads-messaging] Failed to fetch last question:", e);
  }

  // Enrich with real deal history
  const dealsCtx = await fetchDealsContext(supabase, lead);

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(lead, dealsCtx);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[waleads-messaging] AI historico failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    const parts: string[] = [];
    const fc = dealsCtx.firstContactAt || (lead.data_primeiro_contato || lead.created_at) as string | undefined;
    if (fc) parts.push(`Primeiro contato em ${formatDate(fc)}`);
    if (lead.lojaintegrada_cliente_id) parts.push(`Cliente e-commerce (ID: ${lead.lojaintegrada_cliente_id})`);
    else parts.push("Sem compras anteriores no e-commerce");
    if (lead.astron_user_id) parts.push(`Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos`);
    else parts.push("Sem cadastro na plataforma de cursos");
    if (dealsCtx.currentOwner) parts.push(`Vendedor atual: ${dealsCtx.currentOwner}`);
    if (dealsCtx.distinctOwners.length > 1) parts.push(`Owners no histórico: ${dealsCtx.distinctOwners.join(", ")}`);
    else if (!dealsCtx.currentOwner && lead.proprietario_lead_crm) parts.push(`Vendedor: ${lead.proprietario_lead_crm}`);
    else if (!dealsCtx.currentOwner) parts.push("Nunca teve contato com vendedor");
    if (dealsCtx.total > 0) parts.push(`${dealsCtx.total} deal(s) (${dealsCtx.ganhos} ganhos / ${dealsCtx.perdidos} perdidos / ${dealsCtx.abertos} abertos)`);
    historico = parts.join(". ") + ".";
  }
  if (!oportunidade) {
    const parts: string[] = [];
    if (lead.software_cad) parts.push(`Possui software CAD (${lead.software_cad})`);
    if (lead.tem_impressora && lead.tem_impressora !== "nao") parts.push(`Impressora: ${lead.impressora_modelo || lead.tem_impressora}`);
    if (lead.tem_scanner && lead.tem_scanner !== "nao") parts.push(`Scanner: ${lead.tem_scanner}`);
    if (lead.urgency_level) parts.push(`Urgência ${lead.urgency_level}`);
    if (lead.primary_motivation) parts.push(`motivado por ${lead.primary_motivation}`);
    if (lead.objection_risk) parts.push(`Risco de objeção: ${lead.objection_risk}`);
    oportunidade = parts.length > 0 ? parts.join(". ") + "." : "Sem dados suficientes.";
  }

  const lines: string[] = [
    `📊 *Análise SmartOps*`,
    ``,
    `👤 Lead: ${lead.nome || "N/A"}`,
    `📧 Email: ${lead.email || "N/A"}`,
    `📱 Tel: ${phone || "N/A"}`,
    `🦷 Área de atuação: ${lead.area_atuacao || "N/A"}`,
    `🦷 Especialidade: ${lead.especialidade || "N/A"}`,
    `🎯 Interesse: ${lead.produto_interesse || "N/A"}`,
    `🌡️ Temp: ${lead.temperatura_lead || lead.urgency_level || "N/A"}`,
    `🔗 PipeRun: ${lead.piperun_link || "N/A"}`,
    `💬 Última pergunta do lead: ${lastQuestion || "N/A"}`,
    `🏷️ Contexto: ${lead.rota_inicial_lia || "N/A"}`,
    `📍 Etapa CRM: ${lead.ultima_etapa_comercial || "N/A"}`,
    ``,
    `*HISTÓRICO:* ${historico}`,
    `*OPORTUNIDADE:* ${oportunidade}`,
    ``,
    `🧠 *Análise Cognitiva:*`,
    `Confiança: ${lead.confidence_score_analysis || 0}%`,
    `Estágio: ${lead.lead_stage_detected || "N/A"}`,
    `Urgência: ${urgencyEmoji} ${lead.urgency_level || "N/A"}`,
    `Timeline: ${lead.interest_timeline || "N/A"}`,
    `Perfil: ${lead.psychological_profile || "N/A"}`,
    `Motivação: ${lead.primary_motivation || "N/A"}`,
    `Risco objeção: ${lead.objection_risk || "N/A"}`,
    `Abordagem: ${lead.recommended_approach || "N/A"}`,
  ];

  return lines.join("\n");
}

function formatDate(val: unknown): string {
  if (!val) return "N/A";
  try {
    const d = new Date(String(val));
    return d.toLocaleDateString("pt-BR");
  } catch { return String(val).slice(0, 10); }
}

export async function generateHistoricoOportunidade(
  lead: Record<string, unknown>,
  dealsCtx?: DealsContext
): Promise<{ historico: string; oportunidade: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { historico: "", oportunidade: "" };

  const cognitive = lead.cognitive_analysis as Record<string, unknown> | null;
  const cognitiveContext = cognitive
    ? `\nAnálise Cognitiva: Perfil=${cognitive.psychological_profile || "N/A"}, Motivação=${cognitive.primary_motivation || "N/A"}, Objeção=${cognitive.objection_risk || "N/A"}, Estágio=${cognitive.lead_stage_detected || "N/A"}, Trajetória=${cognitive.stage_trajectory || "N/A"}`
    : "";

  const dealsBlock = dealsCtx ? formatDealsBlock(dealsCtx) : "Sem dados de deals fornecidos.";
  const firstContactStr = dealsCtx?.firstContactAt
    ? formatDate(dealsCtx.firstContactAt)
    : (lead.data_primeiro_contato || lead.created_at || "N/A");

  const prompt = `Você é um estrategista comercial sênior. Analise os dados do lead e gere um JSON com 2 campos:
- "historico": 2-3 frases sobre primeiro contato, compras e-commerce, cursos, vendedores anteriores
- "oportunidade": Briefing tático para o vendedor contendo: (1) equipamentos e software atuais, (2) objeção provável e como contorná-la, (3) abordagem recomendada e prova social relevante, (4) urgência e motivação

DADOS:
Nome: ${lead.nome || "N/A"}
Primeiro contato: ${firstContactStr}
E-commerce ID: ${lead.lojaintegrada_cliente_id || "Sem cadastro"}
Último pedido: ${lead.lojaintegrada_ultimo_pedido_data || "Nunca"} (R$ ${lead.lojaintegrada_ultimo_pedido_valor || "0"})
Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos
Último login cursos: ${lead.astron_last_login_at || "Nunca"}
${dealsBlock}
Impressora: ${lead.tem_impressora || "N/A"} ${lead.impressora_modelo || ""}
Scanner: ${lead.tem_scanner || "N/A"}
Software CAD: ${lead.software_cad || "N/A"}
Urgência: ${lead.urgency_level || "N/A"}
Motivação: ${lead.primary_motivation || "N/A"}
Risco objeção: ${lead.objection_risk || "N/A"}
Status: ${lead.status_oportunidade || "N/A"}${cognitiveContext}

REGRAS OBRIGATÓRIAS:
- Use APENAS os fatos listados em DADOS. NÃO invente nomes de vendedores, datas ou valores.
- NÃO use o nome do lead — diga "o profissional" ou "o lead".
- Se houver mais de um owner em "Owners distintos", mencione cada um claramente.
- Se "Vendedor atual" diferir do mais antigo da lista, deixe explícito que houve troca de owner.
- Use a data exata em "Primeiro contato" — não escolha datas intermediárias.
Retorne APENAS JSON: {"historico":"...","oportunidade":"..."}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Retorne APENAS JSON válido. Sem markdown. Use EXCLUSIVAMENTE os dados fornecidos. NÃO invente nomes, datas ou valores." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Lovable AI Gateway ${res.status}`);
  const data = await res.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "waleads-messaging",
    actionLabel: "generate-briefing-gemini-lite",
    model: "google/gemini-2.5-flash-lite",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { historico: "", oportunidade: "" };
  const parsed = JSON.parse(jsonMatch[0]);

  const leadNome = String(lead.nome || "").split(" ")[0];
  if (leadNome.length >= 2) {
    const nameRegex = new RegExp(`\\b${leadNome}\\b`, "gi");
    if (typeof parsed.historico === "string") parsed.historico = parsed.historico.replace(nameRegex, "o profissional");
    if (typeof parsed.oportunidade === "string") parsed.oportunidade = parsed.oportunidade.replace(nameRegex, "o profissional");
  }

  // Hallucination guard: strip seller names not in deal owners allowlist
  const allowed = dealsCtx?.distinctOwners || [];
  if (typeof parsed.historico === "string") {
    parsed.historico = stripUnknownSellerNames(parsed.historico, allowed, String(lead.nome || ""));
  }
  if (typeof parsed.oportunidade === "string") {
    parsed.oportunidade = stripUnknownSellerNames(parsed.oportunidade, allowed, String(lead.nome || ""));
  }

  return {
    historico: typeof parsed.historico === "string" ? parsed.historico.slice(0, 500) : "",
    oportunidade: typeof parsed.oportunidade === "string" ? parsed.oportunidade.slice(0, 500) : "",
  };
}

export async function sendTemplateMessage(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string,
  phone: string
): Promise<void> {
  try {
    let { data: rules } = await supabase
      .from("cs_automation_rules")
      .select("*")
      .eq("trigger_event", "NOVO_LEAD")
      .eq("ativo", true)
      .eq("waleads_ativo", true);

    if (!rules || rules.length === 0) return;

    const teamRules = rules.filter((r: Record<string, unknown>) => r.team_member_id === teamMemberId);
    if (teamRules.length > 0) rules = teamRules;

    let rule = null;
    const produtoInteresse = lead.produto_interesse as string | null;
    if (produtoInteresse) {
      rule = rules.find((r: Record<string, unknown>) =>
        r.produto_interesse && String(r.produto_interesse).toLowerCase() === produtoInteresse.toLowerCase()
      );
    }
    if (!rule) rule = rules.find((r: Record<string, unknown>) => !r.produto_interesse);
    if (!rule) rule = rules[0];
    if (!rule) return;

    const payload: Record<string, unknown> = {
      team_member_id: teamMemberId,
      phone,
      tipo: rule.waleads_tipo || "text",
      message: rule.mensagem_waleads || "",
      lead_id: lead.id,
    };
    if (rule.waleads_media_url) {
      payload.media_url = rule.waleads_media_url;
      payload.caption = rule.waleads_media_caption || "";
    }

    await fetch(`${supabaseUrl}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[waleads-messaging] Template message error:", e);
  }
}

export async function triggerOutboundMessages(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string | null,
  teamMemberName: string
): Promise<{ skipped?: boolean; reason?: string } | void> {
  if (!teamMemberId || teamMemberId === "fallback-admin") return;

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  if (!phone) return;

  try {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, nome_completo, waleads_api_key, whatsapp_number")
      .eq("id", teamMemberId)
      .single();

    if (!member?.waleads_api_key) return;

    const isLiaSource = LIA_SOURCES.includes(lead.source as string);
    const leadId = lead.id as string;

    if (isLiaSource) {
      const aiGreeting = await generateAILeadGreeting(lead, member.nome_completo);
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, phone, aiGreeting, leadId);
    } else {
      await sendTemplateMessage(supabase, supabaseUrl, serviceKey, lead, member.id, phone);
    }

    const briefing = await buildSellerNotification(lead, supabase);
    if (member.whatsapp_number) {
      // Dedup: skip if a seller briefing was already logged today for this lead
      const hoje = new Date().toISOString().split('T')[0];
      const hojeStart = `${hoje}T00:00:00.000Z`;
      const hojeEnd = `${hoje}T23:59:59.999Z`;
      const { count } = await supabase
        .from('message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .in('tipo', ['briefing_vendedor', 'briefing_vendedor_block'])
        .gte('created_at', hojeStart)
        .lte('created_at', hojeEnd);
      if (count && count > 0) {
        console.log('[notifySeller] dedup blocked - already sent today');
        return { skipped: true, reason: 'already_notified_today' };
      }
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, member.whatsapp_number, briefing, leadId);
    }
  } catch (e) {
    console.warn("[waleads-messaging] Outbound messages error:", e);
  }
}

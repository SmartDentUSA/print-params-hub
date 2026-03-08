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

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(lead);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[waleads-messaging] AI historico failed:", e);
  }

  // Fallback static texts
  if (!historico) {
    const parts: string[] = [];
    if (lead.data_primeiro_contato || lead.created_at) parts.push(`Primeiro contato em ${formatDate(lead.data_primeiro_contato || lead.created_at)}`);
    if (lead.lojaintegrada_cliente_id) parts.push(`Cliente e-commerce (ID: ${lead.lojaintegrada_cliente_id})`);
    else parts.push("Sem compras anteriores no e-commerce");
    if (lead.astron_user_id) parts.push(`Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos`);
    else parts.push("Sem cadastro na plataforma de cursos");
    if (lead.proprietario_lead_crm) parts.push(`Vendedor anterior: ${lead.proprietario_lead_crm}`);
    else parts.push("Nunca teve contato com vendedor");
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
    `🤖 *Novo Lead atribuído - Dra. L.I.A.*`,
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

async function generateHistoricoOportunidade(
  lead: Record<string, unknown>
): Promise<{ historico: string; oportunidade: string }> {
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) return { historico: "", oportunidade: "" };

  const cognitive = lead.cognitive_analysis as Record<string, unknown> | null;
  const cognitiveContext = cognitive
    ? `\nAnálise Cognitiva: Perfil=${cognitive.psychological_profile || "N/A"}, Motivação=${cognitive.primary_motivation || "N/A"}, Objeção=${cognitive.objection_risk || "N/A"}, Estágio=${cognitive.lead_stage_detected || "N/A"}, Trajetória=${cognitive.stage_trajectory || "N/A"}`
    : "";

  const prompt = `Você é um estrategista comercial sênior. Analise os dados do lead e gere um JSON com 2 campos:
- "historico": 2-3 frases sobre primeiro contato, compras e-commerce, cursos, vendedores anteriores
- "oportunidade": Briefing tático para o vendedor contendo: (1) equipamentos e software atuais, (2) objeção provável e como contorná-la, (3) abordagem recomendada e prova social relevante, (4) urgência e motivação

DADOS:
Nome: ${lead.nome || "N/A"}
Primeiro contato: ${lead.data_primeiro_contato || lead.created_at || "N/A"}
E-commerce ID: ${lead.lojaintegrada_cliente_id || "Sem cadastro"}
Último pedido: ${lead.lojaintegrada_ultimo_pedido_data || "Nunca"} (R$ ${lead.lojaintegrada_ultimo_pedido_valor || "0"})
Cursos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0} concluídos
Último login cursos: ${lead.astron_last_login_at || "Nunca"}
Vendedor anterior: ${lead.proprietario_lead_crm || "Nenhum"}
Impressora: ${lead.tem_impressora || "N/A"} ${lead.impressora_modelo || ""}
Scanner: ${lead.tem_scanner || "N/A"}
Software CAD: ${lead.software_cad || "N/A"}
Urgência: ${lead.urgency_level || "N/A"}
Motivação: ${lead.primary_motivation || "N/A"}
Risco objeção: ${lead.objection_risk || "N/A"}
Status: ${lead.status_oportunidade || "N/A"}${cognitiveContext}

REGRAS: NÃO use o nome do lead. Retorne APENAS JSON: {"historico":"...","oportunidade":"..."}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Retorne APENAS JSON válido. Sem markdown. NÃO use nomes próprios." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`DeepSeek API ${res.status}`);
  const data = await res.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "waleads-messaging",
    actionLabel: "generate-briefing-deepseek",
    model: "deepseek-chat",
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
) {
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
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, member.whatsapp_number, briefing, leadId);
    }
  } catch (e) {
    console.warn("[waleads-messaging] Outbound messages error:", e);
  }
}

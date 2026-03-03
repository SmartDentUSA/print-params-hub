import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  STAGES_VENDAS,
  PIPERUN_USERS,
  ORIGINS,
  piperunPost,
  piperunPut,
  piperunGet,
  addDealNote,
  mapAttendanceToDealCustomFields,
  customFieldsToHashMap,
  DEAL_CUSTOM_FIELDS,
  PESSOA_CUSTOM_FIELDS,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_OWNER_ID = 64367; // Thiago Nicoletti — gestor

// ─── PipeRun Hierarchy Helpers ───

/**
 * Find person in PipeRun by email. Returns person data or null.
 */
async function findPersonByEmail(
  apiToken: string,
  email: string
): Promise<{ id: number; company_id: number | null } | null> {
  if (!email) return null;
  try {
    const res = await piperunGet(apiToken, "persons", { email, show: 1 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items && items.length > 0 && items[0].id) {
        return {
          id: Number(items[0].id),
          company_id: items[0].company_id ? Number(items[0].company_id) : null,
        };
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Person search error:", e);
  }
  return null;
}

/**
 * Create a person in PipeRun. Returns person_id.
 */
async function createPerson(
  apiToken: string,
  lead: Record<string, unknown>
): Promise<number | null> {
  const email = lead.email as string | null;
  const nome = (lead.nome || email || "Lead Sem Nome") as string;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;
  const areaAtuacao = lead.area_atuacao as string | null;

  const personPayload: Record<string, unknown> = { name: nome };
  if (email) personPayload.emails = [{ email }];
  if (phone) personPayload.phones = [{ phone }];
  if (especialidade) personPayload.job_title = especialidade;

  // Include Pessoa custom fields
  const personCustomFields: Array<{ custom_field_id: number; value: string }> = [];
  if (areaAtuacao) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.AREA_ATUACAO, value: areaAtuacao });
  if (especialidade) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.ESPECIALIDADE, value: especialidade });
  if (personCustomFields.length > 0) personPayload.custom_fields = personCustomFields;

  console.log(`[lia-assign] Creating person: ${nome} with ${personCustomFields.length} custom fields`);
  const createRes = await piperunPost(apiToken, "persons", personPayload);
  if (createRes.success && createRes.data) {
    const personData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (personData?.id) return Number(personData.id);
  }
  console.warn(`[lia-assign] Failed to create person (${createRes.status})`);
  return null;
}

/**
 * Update existing person fields (job_title, phones, custom_fields).
 */
async function updatePersonFields(
  apiToken: string,
  personId: number,
  lead: Record<string, unknown>
): Promise<void> {
  const nome = (lead.nome || lead.email || "") as string;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;
  const areaAtuacao = lead.area_atuacao as string | null;

  const updatePayload: Record<string, unknown> = {};
  if (nome) updatePayload.name = nome;
  if (phone) updatePayload.phones = [{ phone }];
  if (especialidade) updatePayload.job_title = especialidade;

  const personCustomFields: Array<{ custom_field_id: number; value: string }> = [];
  if (areaAtuacao) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.AREA_ATUACAO, value: areaAtuacao });
  if (especialidade) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.ESPECIALIDADE, value: especialidade });
  if (personCustomFields.length > 0) updatePayload.custom_fields = personCustomFields;

  if (Object.keys(updatePayload).length === 0) return;

  console.log(`[lia-assign] Updating person ${personId}: ${JSON.stringify(updatePayload).slice(0, 300)}`);
  const res = await piperunPut(apiToken, `persons/${personId}`, updatePayload);
  console.log(`[lia-assign] Person ${personId} update: ${res.success} (${res.status})`);
}

/**
 * Find or create company for a person.
 * If person has company_id, return it. Otherwise create company and link to person.
 */
async function findOrCreateCompany(
  apiToken: string,
  personId: number,
  existingCompanyId: number | null,
  lead: Record<string, unknown>
): Promise<number | null> {
  const nome = (lead.nome || lead.email || "Empresa Lead") as string;
  const email = lead.email as string | null;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;

  // Extra empresa data from lead
  const cnpj = lead.empresa_cnpj as string | null;
  const razaoSocial = lead.empresa_razao_social as string | null;
  const segmento = lead.empresa_segmento as string | null;
  const website = lead.empresa_website as string | null;

  // Already has company → update it with complete data
  if (existingCompanyId) {
    console.log(`[lia-assign] Person ${personId} already has company ${existingCompanyId}, enriching data`);
    const enrichPayload: Record<string, unknown> = { name: razaoSocial || nome };
    if (email) enrichPayload.emails = [{ email }];
    if (phone) enrichPayload.phones = [{ phone }];
    if (cnpj) enrichPayload.cnpj = cnpj;
    if (segmento) enrichPayload.segment = segmento;
    if (website) enrichPayload.website = website;
    const enrichRes = await piperunPut(apiToken, `companies/${existingCompanyId}`, enrichPayload);
    console.log(`[lia-assign] Company ${existingCompanyId} enriched: ${enrichRes.success} (${enrichRes.status})`);
    return existingCompanyId;
  }

  // Create company with complete data
  const companyPayload: Record<string, unknown> = { name: razaoSocial || nome };
  if (email) companyPayload.emails = [{ email }];
  if (phone) companyPayload.phones = [{ phone }];
  if (cnpj) companyPayload.cnpj = cnpj;
  if (segmento) companyPayload.segment = segmento;
  if (website) companyPayload.website = website;

  console.log(`[lia-assign] Creating company for person ${personId}: ${nome}`);
  const createRes = await piperunPost(apiToken, "companies", companyPayload);
  const companyId = ((createRes.data as Record<string, unknown>)?.data as Record<string, unknown>)?.id;

  if (companyId) {
    // Link company to person
    await piperunPut(apiToken, `persons/${personId}`, { company_id: Number(companyId) });
    console.log(`[lia-assign] Company ${companyId} created and linked to person ${personId}`);
    return Number(companyId);
  }

  console.warn(`[lia-assign] Failed to create company (${createRes.status})`);
  return null;
}

/**
 * Fetch all non-deleted deals for a person from PipeRun.
 */
async function findPersonDeals(
  apiToken: string,
  personId: number
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await piperunGet(apiToken, "deals", { person_id: personId, show: 50 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items) {
        // Filter out deleted deals
        return items.filter((d) => d.deleted !== 1 && d.deleted !== true);
      }
    }
  } catch (e) {
    console.warn("[lia-assign] Error fetching person deals:", e);
  }
  return [];
}

/**
 * Update an existing deal (owner, custom fields, note).
 */
async function updateExistingDeal(
  apiToken: string,
  dealId: number,
  ownerId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const hashFields = customFieldsToHashMap(customFields);
  const updatePayload: Record<string, unknown> = {
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    ...hashFields,
  };
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Updating deal ${dealId}: owner=${ownerId}, company=${companyId || "none"}`, JSON.stringify(updatePayload).slice(0, 500));
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal update: ${updateRes.success} (${updateRes.status})`);

  // Add structured note (same template as seller notification)
  const noteText = await buildSellerNotification(lead, supabase);
  await addDealNote(apiToken, dealId, noteText);
}

/**
 * Move a deal from Estagnados to Funil de Vendas.
 */
async function moveDealToVendas(
  apiToken: string,
  dealId: number,
  ownerId: number,
  stageId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const hashFields = customFieldsToHashMap(customFields);
  const updatePayload: Record<string, unknown> = {
    pipeline_id: PIPELINES.VENDAS,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    freezed: 0,
    ...hashFields,
  };
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Moving deal ${dealId} from Estagnados → Vendas, owner=${ownerId}`);
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal move: ${updateRes.success} (${updateRes.status})`);

  // Add structured reactivation note
  const noteText = "🔄 [Dra. L.I.A.] Deal reativado do funil Estagnados → Funil de Vendas\n\n" +
    await buildSellerNotification(lead, supabase);
  await addDealNote(apiToken, dealId, noteText);
}

/**
 * Create a new deal in the Vendas pipeline.
 */
async function createNewDeal(
  apiToken: string,
  personId: number,
  companyId: number | null,
  lead: Record<string, unknown>,
  pipelineId: number,
  stageId: number,
  ownerId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  email: string,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const dealPayload: Record<string, unknown> = {
    title: lead.nome || email,
    pipeline_id: pipelineId,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    reference: email,
    person_id: personId,
  };

  if (companyId) dealPayload.company_id = companyId;
  if (customFields.length > 0) dealPayload.custom_fields = customFields;

  console.log(`[lia-assign] Creating deal: person=${personId}, company=${companyId}, pipeline=${pipelineId}`);
  const createRes = await piperunPost(apiToken, "deals", dealPayload);
  console.log(`[lia-assign] Deal create: ${createRes.success} (${createRes.status})`);

  if (createRes.success && createRes.data) {
    const dealData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (dealData?.id) {
      const dealId = String(dealData.id);
      // Add structured note (same template as seller notification)
      const noteText = await buildSellerNotification(lead, supabase);
      await addDealNote(apiToken, Number(dealId), noteText);
      return dealId;
    }
  }
  return null;
}

/**
 * Build a summary note from lead data.
 */
function buildLeadNote(lead: Record<string, unknown>, isNew: boolean): string {
  const lines: string[] = [];
  lines.push(isNew
    ? "🤖 [Dra. L.I.A.] Lead qualificado automaticamente"
    : "🤖 [Dra. L.I.A.] Nova interação detectada"
  );
  lines.push("");

  if (lead.resumo_historico_ia) {
    lines.push(String(lead.resumo_historico_ia));
    lines.push("");
  }

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  lines.push(`📊 Produto interesse: ${lead.produto_interesse || "N/A"}`);
  lines.push(`🏥 Especialidade: ${lead.especialidade || "N/A"}`);
  lines.push(`🔗 Telefone: ${phone || "N/A"}`);
  lines.push(`📧 Email: ${lead.email || "N/A"}`);
  lines.push(`📍 Origem: dra-lia`);

  if (lead.area_atuacao) lines.push(`🔬 Área: ${lead.area_atuacao}`);
  if (lead.tem_impressora) lines.push(`🖨️ Impressora: ${lead.tem_impressora}`);
  if (lead.tem_scanner) lines.push(`📷 Scanner: ${lead.tem_scanner}`);
  if (lead.cidade) lines.push(`📍 Cidade: ${lead.cidade}${lead.uf ? ` - ${lead.uf}` : ""}`);

  return lines.join("\n");
}

// ─── Team Member Selection ───

interface TeamMember {
  id: string;
  nome_completo: string;
  piperun_owner_id: number;
}

/**
 * Pick a random active vendedor, prioritizing those with WaLeads API key.
 */
async function pickRandomActiveVendedor(
  supabase: ReturnType<typeof createClient>
): Promise<TeamMember> {
  // Priority: vendedores with waleads_api_key configured
  const { data: waMembers } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor")
    .not("waleads_api_key", "is", null);

  if (waMembers && waMembers.length > 0) {
    const idx = Math.floor(Math.random() * waMembers.length);
    console.log(`[lia-assign] Selected WaLeads-enabled vendedor: ${waMembers[idx].nome_completo}`);
    return waMembers[idx] as TeamMember;
  }

  // Fallback: any active vendedor
  const { data: members } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor");

  if (!members || members.length === 0) {
    console.warn("[lia-assign] No active vendedores, falling back to admin");
    const fallbackUser = PIPERUN_USERS[FALLBACK_OWNER_ID];
    return {
      id: "fallback-admin",
      nome_completo: fallbackUser?.name || "Thiago Nicoletti",
      piperun_owner_id: FALLBACK_OWNER_ID,
    };
  }

  const idx = Math.floor(Math.random() * members.length);
  return members[idx] as TeamMember;
}

// ─── AI Message Generation ───

const LIA_SOURCES = ["dra-lia", "whatsapp_lia", "handoff_lia"];
const BLOCKED_SELLER_NAMES = ["Celular", "Comercial", "Vendas", "Smart Dent"];

/**
 * Generate AI greeting from seller → lead using conversation context.
 */
async function generateAILeadGreeting(
  lead: Record<string, unknown>,
  sellerName: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[lia-assign] LOVABLE_API_KEY not set, using static greeting");
    return buildStaticGreeting(lead, sellerName);
  }

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 20) {
      console.log(`[lia-assign] AI greeting generated (${content.length} chars)`);
      return content;
    }
  } catch (e) {
    console.warn("[lia-assign] AI greeting failed, using static:", e);
  }
  return buildStaticGreeting(lead, sellerName);
}

function buildStaticGreeting(lead: Record<string, unknown>, sellerName: string): string {
  const leadName = (lead.nome as string || "").split(" ")[0] || "doutor(a)";
  const firstName = sellerName.split(" ")[0];
  return `Olá ${leadName}! Sou ${firstName} da Smart Dent 🦷\nVi que você conversou com nossa Dra. L.I.A. e gostaria de continuar te ajudando pessoalmente.\nComo posso te auxiliar?`;
}

/**
 * Build structured seller notification with fixed template + AI for HISTÓRICO/OPORTUNIDADE.
 */
async function buildSellerNotification(
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
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
    console.warn("[lia-assign] Failed to fetch last question:", e);
  }

  // AI-generated HISTÓRICO + OPORTUNIDADE
  let historico = "";
  let oportunidade = "";
  try {
    const aiResult = await generateHistoricoOportunidade(lead);
    historico = aiResult.historico;
    oportunidade = aiResult.oportunidade;
  } catch (e) {
    console.warn("[lia-assign] AI historico/oportunidade failed:", e);
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

  // Build template
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

/**
 * AI generates ONLY historico + oportunidade as JSON.
 */
async function generateHistoricoOportunidade(
  lead: Record<string, unknown>
): Promise<{ historico: string; oportunidade: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { historico: "", oportunidade: "" };

  const prompt = `Analise os dados do lead e gere APENAS um JSON com 2 campos:
- "historico": 2-3 frases sobre primeiro contato, compras e-commerce, cursos, vendedores anteriores
- "oportunidade": 2-3 frases sobre equipamentos, software, urgência, motivação e risco de objeção

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
Status: ${lead.status_oportunidade || "N/A"}

Retorne APENAS JSON válido: {"historico":"...","oportunidade":"..."}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Retorne APENAS JSON válido. Sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { historico: "", oportunidade: "" };
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    historico: typeof parsed.historico === "string" ? parsed.historico.slice(0, 500) : "",
    oportunidade: typeof parsed.oportunidade === "string" ? parsed.oportunidade.slice(0, 500) : "",
  };
}

// ─── Outbound Messages (Source-Based) ───

async function sendWaLeadsMessage(
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
    console.log(`[lia-assign] WaLeads response: status=${res.status} body=${resText.slice(0, 500)}`);
    return { success: res.ok, status: res.status, response: resText.slice(0, 300) };
  } catch (e) {
    console.warn("[lia-assign] WaLeads send error:", e);
    return { success: false, response: String(e) };
  }
}

async function sendTemplateMessage(
  supabase: ReturnType<typeof createClient>,
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

    if (!rules || rules.length === 0) {
      console.log("[lia-assign] No NOVO_LEAD automation rules found");
      return;
    }

    // Prefer team-specific rules
    const teamRules = rules.filter((r: Record<string, unknown>) => r.team_member_id === teamMemberId);
    if (teamRules.length > 0) rules = teamRules;

    // Match by product interest
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
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[lia-assign] Template message error:", e);
  }
}

/**
 * Outbound messages: bifurcation by source.
 * LIA sources → AI greeting + AI briefing to seller
 * Form sources → Template message + AI briefing to seller
 */
async function triggerOutboundMessages(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  lead: Record<string, unknown>,
  teamMemberId: string | null,
  teamMemberName: string
) {
  if (!teamMemberId || teamMemberId === "fallback-admin") return;

  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  if (!phone) {
    console.log("[lia-assign] No phone number, skipping outbound messages");
    return;
  }

  try {
    // Fetch team member with WaLeads config
    const { data: member } = await supabase
      .from("team_members")
      .select("id, nome_completo, waleads_api_key, whatsapp_number")
      .eq("id", teamMemberId)
      .single();

    if (!member?.waleads_api_key) {
      console.log(`[lia-assign] Team member ${teamMemberId} has no waleads_api_key, skipping`);
      return;
    }

    const isLiaSource = LIA_SOURCES.includes(lead.source as string);
    const leadId = lead.id as string;

    // ── A. Message seller → lead ──
    if (isLiaSource) {
      console.log("[lia-assign] LIA source → generating AI greeting");
      const aiGreeting = await generateAILeadGreeting(lead, member.nome_completo);
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, phone, aiGreeting, leadId);
    } else {
      console.log("[lia-assign] Non-LIA source → using template message");
      await sendTemplateMessage(supabase, supabaseUrl, serviceKey, lead, member.id, phone);
    }

    // ── B. Structured notification → seller (ALWAYS) ──
    console.log("[lia-assign] Building structured seller notification");
    const briefing = await buildSellerNotification(lead, supabase);
    if (member.whatsapp_number) {
      await sendWaLeadsMessage(supabaseUrl, serviceKey, member.id, member.whatsapp_number, briefing, leadId);
      console.log(`[lia-assign] Seller briefing sent to ${member.nome_completo} (${member.whatsapp_number})`);
    } else {
      console.log(`[lia-assign] No whatsapp_number for ${member.nome_completo}, briefing not sent`);
    }
  } catch (e) {
    console.warn("[lia-assign] Outbound messages error:", e);
  }
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

  if (!PIPERUN_API_KEY) {
    console.error("[lia-assign] PIPERUN_API_KEY not set");
    return new Response(JSON.stringify({ error: "Missing PIPERUN_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { email, lead_id } = body;
    if (!email && !lead_id) {
      return new Response(JSON.stringify({ error: "email or lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[lia-assign] Processing lead: ${email || lead_id}`);

    // ── 1. Fetch lead from lia_attendances ──
    let query = supabase.from("lia_attendances").select("*");
    if (lead_id) {
      query = query.eq("id", lead_id);
    } else {
      query = query.eq("email", email.trim().toLowerCase());
    }

    const { data: lead, error: leadErr } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadErr || !lead) {
      console.warn("[lia-assign] Lead not found:", email, leadErr);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: skip if assigned in last 5 min ──
    if (lead.proprietario_lead_crm && lead.updated_at) {
      const lastUpdate = new Date(lead.updated_at).getTime();
      if (Date.now() - lastUpdate < 5 * 60 * 1000) {
        console.log("[lia-assign] Already assigned recently, skipping");
        return new Response(JSON.stringify({ skipped: true, reason: "recently_assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 2. Select owner via Round Robin (prioritize WaLeads) ──
    let assignedOwnerId: number;
    let assignedTeamMemberId: string | null = null;
    let assignedOwnerName: string;

    // Check if current owner exists and is active in team_members
    if (lead.proprietario_lead_crm) {
      const { data: currentOwner } = await supabase
        .from("team_members")
        .select("id, nome_completo, piperun_owner_id, ativo, waleads_api_key")
        .ilike("nome_completo", lead.proprietario_lead_crm)
        .maybeSingle();

      if (currentOwner && currentOwner.ativo) {
        assignedOwnerId = currentOwner.piperun_owner_id;
        assignedTeamMemberId = currentOwner.id;
        assignedOwnerName = currentOwner.nome_completo;
        console.log(`[lia-assign] Keeping existing active owner: ${assignedOwnerName}`);
      } else {
        // Owner not found in team_members or inactive → re-assign
        const newOwner = await pickRandomActiveVendedor(supabase);
        assignedOwnerId = newOwner.piperun_owner_id;
        assignedTeamMemberId = newOwner.id;
        assignedOwnerName = newOwner.nome_completo;
        console.log(`[lia-assign] Re-assigned (owner not in team or inactive) → ${assignedOwnerName}`);
      }
    } else {
      const newOwner = await pickRandomActiveVendedor(supabase);
      assignedOwnerId = newOwner.piperun_owner_id;
      assignedTeamMemberId = newOwner.id;
      assignedOwnerName = newOwner.nome_completo;
      console.log(`[lia-assign] Round Robin assigned: ${assignedOwnerName} (${assignedOwnerId})`);
    }

    // ── 3. Determine pipeline & stage ──
    const isDistribuidor = assignedOwnerId === FALLBACK_OWNER_ID;
    const pipeline_id = isDistribuidor ? PIPELINES.DISTRIBUIDOR_LEADS : PIPELINES.VENDAS;
    const stage_id = isDistribuidor
      ? await resolveFirstStage(PIPERUN_API_KEY, PIPELINES.DISTRIBUIDOR_LEADS)
      : STAGES_VENDAS.SEM_CONTATO;

    // ── 4. Build PipeRun custom fields ──
    const customFields = mapAttendanceToDealCustomFields(lead as Record<string, unknown>);
    const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
    if (phone) {
      customFields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: phone });
    }

    // ── 5. Smart PipeRun Sync: Pessoa → Empresa → Deal ──
    const leadEmail = (lead.email as string).trim().toLowerCase();
    let piperunId = lead.piperun_id as string | null;
    let personId: number | null = lead.pessoa_piperun_id as number | null;
    let companyId: number | null = lead.empresa_piperun_id as number | null;
    let flowType = "unknown";

    // Step 5a: Find or create Person
    if (!personId) {
      const existingPerson = await findPersonByEmail(PIPERUN_API_KEY, leadEmail);
      if (existingPerson) {
        personId = existingPerson.id;
        companyId = existingPerson.company_id || companyId;
        console.log(`[lia-assign] Found existing person: ${personId}, company: ${companyId}`);
      } else {
        personId = await createPerson(PIPERUN_API_KEY, lead as Record<string, unknown>);
        console.log(`[lia-assign] Created new person: ${personId}`);
      }
    }

    if (personId) {
      // Step 5b: Ensure company exists
      companyId = await findOrCreateCompany(PIPERUN_API_KEY, personId, companyId, lead as Record<string, unknown>);

      // Step 5c: Fetch all deals for this person
      const allDeals = await findPersonDeals(PIPERUN_API_KEY, personId);
      const openDeals = allDeals.filter((d) => Number(d.status) === 0);
      const wonDeals = allDeals.filter((d) => Number(d.status) === 1);

      console.log(`[lia-assign] Person ${personId}: ${allDeals.length} deals total, ${openDeals.length} open, ${wonDeals.length} won`);

      // Won deals: NEVER TOUCH
      if (wonDeals.length > 0) {
        console.log(`[lia-assign] ${wonDeals.length} won deals preserved (CS/Suporte)`);
      }

      // Step 5d: Decision tree for open deals
      // Priority 1: Open deal in Funil de Vendas (not frozen)
      const vendaDeal = openDeals.find(
        (d) => Number(d.pipeline_id) === PIPELINES.VENDAS && !d.freezed
      );
      // Priority 2: Open deal in Estagnados
      const estagnDeal = openDeals.find(
        (d) => Number(d.pipeline_id) === PIPELINES.ESTAGNADOS
      );

      if (vendaDeal) {
        // Already has open deal in Vendas → update it
        piperunId = String(vendaDeal.id);
        flowType = "update_vendas";
        await updateExistingDeal(PIPERUN_API_KEY, Number(vendaDeal.id), assignedOwnerId, customFields, lead as Record<string, unknown>, companyId);
        console.log(`[lia-assign] Updated existing Vendas deal ${piperunId}`);
      } else if (estagnDeal) {
        // Has deal in Estagnados → move to Vendas
        piperunId = String(estagnDeal.id);
        flowType = "reactivate_estagnado";
        await moveDealToVendas(PIPERUN_API_KEY, Number(estagnDeal.id), assignedOwnerId, stage_id, customFields, lead as Record<string, unknown>, companyId);
        console.log(`[lia-assign] Reactivated estagnado deal ${piperunId} → Vendas`);
      } else {
        // No relevant open deal → create new in Vendas
        flowType = "new_deal";
        piperunId = await createNewDeal(
          PIPERUN_API_KEY, personId, companyId,
          lead as Record<string, unknown>,
          pipeline_id, stage_id, assignedOwnerId,
          customFields, leadEmail
        );
        console.log(`[lia-assign] Created new deal: ${piperunId}`);
      }
    } else {
      console.error("[lia-assign] Could not find or create person in PipeRun");
      flowType = "error_no_person";
    }

    // ── 6. Update lead in lia_attendances ──
    const piperunFunil = isDistribuidor ? "Distribuidor de Leads" : "Funil de vendas";
    const piperunEtapa = isDistribuidor ? "distribuidor_leads" : "sem_contato";

    const updateFields: Record<string, unknown> = {
      proprietario_lead_crm: assignedOwnerName,
      funil_entrada_crm: piperunFunil,
      ultima_etapa_comercial: piperunEtapa,
    };

    if (piperunId && !lead.piperun_id) {
      updateFields.piperun_id = piperunId;
      updateFields.piperun_link = `https://app.pipe.run/#/deals/${piperunId}`;
    }

    // Save PipeRun hierarchy IDs
    if (personId) updateFields.pessoa_piperun_id = personId;
    if (companyId) updateFields.empresa_piperun_id = companyId;

    await supabase
      .from("lia_attendances")
      .update(updateFields)
      .eq("id", lead.id);

    console.log(`[lia-assign] Lead updated: owner=${assignedOwnerName}, flow=${flowType}, funil=${piperunFunil}`);

    // ── 7. Outbound automation ──
    await triggerOutboundMessages(supabase, SUPABASE_URL, SERVICE_ROLE_KEY, lead, assignedTeamMemberId, assignedOwnerName);

    return new Response(
      JSON.stringify({
        success: true,
        flow: flowType,
        owner: assignedOwnerName,
        owner_id: assignedOwnerId,
        pipeline: piperunFunil,
        piperun_id: piperunId,
        pessoa_piperun_id: personId,
        empresa_piperun_id: companyId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[lia-assign] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Stage Resolution Helper ───

async function resolveFirstStage(apiToken: string, pipelineId: number): Promise<number> {
  try {
    const res = await piperunGet(apiToken, "stages", {
      pipeline_id: pipelineId,
      order_by: "order",
      order_type: "asc",
      show: 1,
    });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items && items.length > 0) return Number(items[0].id);
    }
  } catch (e) {
    console.warn("[lia-assign] Failed to resolve first stage for pipeline", pipelineId, e);
  }
  return 0;
}

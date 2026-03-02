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

  const personPayload: Record<string, unknown> = { name: nome };
  if (email) personPayload.emails = [{ email }];
  if (phone) personPayload.phones = [{ phone }];
  if (especialidade) personPayload.job_title = especialidade;

  console.log(`[lia-assign] Creating person: ${nome}`);
  const createRes = await piperunPost(apiToken, "persons", personPayload);
  if (createRes.success && createRes.data) {
    const personData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (personData?.id) return Number(personData.id);
  }
  console.warn(`[lia-assign] Failed to create person (${createRes.status})`);
  return null;
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

  // Already has company → update it with complete data
  if (existingCompanyId) {
    console.log(`[lia-assign] Person ${personId} already has company ${existingCompanyId}, enriching data`);
    const enrichPayload: Record<string, unknown> = { name: nome };
    if (email) enrichPayload.emails = [{ email }];
    if (phone) enrichPayload.phones = [{ phone }];
    const enrichRes = await piperunPut(apiToken, `companies/${existingCompanyId}`, enrichPayload);
    console.log(`[lia-assign] Company ${existingCompanyId} enriched: ${enrichRes.success} (${enrichRes.status})`);
    return existingCompanyId;
  }

  // Create company with complete data
  const companyPayload: Record<string, unknown> = { name: nome };
  if (email) companyPayload.emails = [{ email }];
  if (phone) companyPayload.phones = [{ phone }];

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
  companyId?: number | null
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

  // Add note
  const noteText = buildLeadNote(lead, false);
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
  companyId?: number | null
): Promise<void> {
  const hashFields = customFieldsToHashMap(customFields);
  const updatePayload: Record<string, unknown> = {
    pipeline_id: PIPELINES.VENDAS,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    freezed: 0, // Unfreeze if frozen
    ...hashFields,
  };
  if (companyId) updatePayload.company_id = companyId;

  console.log(`[lia-assign] Moving deal ${dealId} from Estagnados → Vendas, owner=${ownerId}`);
  const updateRes = await piperunPut(apiToken, `deals/${dealId}`, updatePayload);
  console.log(`[lia-assign] Deal move: ${updateRes.success} (${updateRes.status})`);

  // Add reactivation note
  const noteText = "🔄 [Dra. L.I.A.] Deal reativado do funil Estagnados → Funil de Vendas\n\n" +
    buildLeadNote(lead, false);
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
  email: string
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
      // Add note
      const noteText = buildLeadNote(lead, true);
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
 * Generate comprehensive AI briefing about lead for the seller.
 */
async function generateAISellerBriefing(
  lead: Record<string, unknown>
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return buildStaticBriefing(lead);

  // Build lead data summary for AI
  const sections: string[] = [];

  // Basic info
  sections.push(`DADOS BÁSICOS:
Nome: ${lead.nome || "N/A"}
Email: ${lead.email || "N/A"}
Telefone: ${lead.telefone_normalized || lead.telefone_raw || "N/A"}
Cidade/UF: ${lead.cidade || "N/A"}${lead.uf ? ` - ${lead.uf}` : ""}
Especialidade: ${lead.especialidade || "N/A"}
Área: ${lead.area_atuacao || "N/A"}`);

  // Commercial history
  sections.push(`HISTÓRICO COMERCIAL:
Status oportunidade: ${lead.status_oportunidade || "N/A"}
Primeiro contato: ${lead.data_primeiro_contato || lead.created_at || "N/A"}
Proprietário anterior: ${lead.proprietario_lead_crm || "Nenhum"}
Funil: ${lead.funil_entrada_crm || "N/A"}
Etapa: ${lead.ultima_etapa_comercial || "N/A"}
PipeRun ID: ${lead.piperun_id || "N/A"}`);

  // E-commerce
  const hasEcommerce = lead.lojaintegrada_cliente_id;
  sections.push(`E-COMMERCE (Loja Integrada):
Cliente cadastrado: ${hasEcommerce ? "Sim (ID: " + lead.lojaintegrada_cliente_id + ")" : "Não"}
Último pedido: ${lead.lojaintegrada_ultimo_pedido_data || "Nunca"}
Valor último pedido: ${lead.lojaintegrada_ultimo_pedido_valor ? "R$ " + lead.lojaintegrada_ultimo_pedido_valor : "N/A"}
Status último pedido: ${lead.lojaintegrada_ultimo_pedido_status || "N/A"}`);

  // Courses platform
  const hasCourses = lead.astron_user_id;
  sections.push(`PLATAFORMA DE CURSOS (Astron):
Cadastrado: ${hasCourses ? "Sim (ID: " + lead.astron_user_id + ")" : "Não"}
Cursos concluídos: ${lead.astron_courses_completed || 0}/${lead.astron_courses_total || 0}
Último login: ${lead.astron_last_login_at || "Nunca"}
Planos ativos: ${lead.astron_plans_active ? JSON.stringify(lead.astron_plans_active) : "Nenhum"}`);

  // Equipment
  sections.push(`EQUIPAMENTOS:
Impressora: ${lead.tem_impressora || "N/A"} ${lead.impressora_modelo ? "(" + lead.impressora_modelo + ")" : ""}
Scanner: ${lead.tem_scanner || "N/A"}
Software CAD: ${lead.software_cad || "N/A"}`);

  // Active products
  const activeProducts: string[] = [];
  if (lead.ativo_print) activeProducts.push("Impressora 3D");
  if (lead.ativo_scan) activeProducts.push("Scanner");
  if (lead.ativo_cad) activeProducts.push("CAD");
  if (lead.ativo_cad_ia) activeProducts.push("CAD IA");
  if (lead.ativo_cura) activeProducts.push("Cura");
  if (lead.ativo_insumos) activeProducts.push("Insumos");
  if (lead.ativo_notebook) activeProducts.push("Notebook");
  if (lead.ativo_smart_slice) activeProducts.push("Smart Slice");
  sections.push(`PRODUTOS ATIVOS: ${activeProducts.length > 0 ? activeProducts.join(", ") : "Nenhum"}`);

  // Cognitive analysis
  const cognitive = lead.cognitive_analysis as Record<string, unknown> | null;
  if (cognitive) {
    sections.push(`ANÁLISE COGNITIVA:
Estágio: ${cognitive.lead_stage || "N/A"}
Urgência: ${cognitive.urgency_level || "N/A"}
Motivação: ${cognitive.primary_motivation || "N/A"}
Risco objeção: ${cognitive.objection_risk || "N/A"}
Abordagem: ${cognitive.recommended_approach || "N/A"}`);
  }

  // Conversation summary
  if (lead.resumo_historico_ia) {
    sections.push(`RESUMO CONVERSA LIA:\n${String(lead.resumo_historico_ia).slice(0, 600)}`);
  }

  const fullContext = sections.join("\n\n");

  const prompt = `Você é um assistente de vendas da Smart Dent. Gere um briefing CONCISO (máximo 250 palavras) para o vendedor sobre este lead.

${fullContext}

O briefing deve ter estas seções com emojis:
👤 PERFIL (nome, especialidade, cidade - 1 linha)
📊 HISTÓRICO (primeiro contato, compras anteriores, cursos - 2-3 linhas)  
🎯 OPORTUNIDADE (produto interesse, equipamentos atuais, estágio - 2-3 linhas)
💡 RECOMENDAÇÃO (como abordar baseado no perfil e histórico - 2 linhas)

Seja direto e prático. Não invente dados — se não há informação, diga "sem registro".`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 50) {
      console.log(`[lia-assign] AI seller briefing generated (${content.length} chars)`);
      return `🤖 *Briefing Dra. L.I.A.*\n\n${content}`;
    }
  } catch (e) {
    console.warn("[lia-assign] AI seller briefing failed, using static:", e);
  }
  return buildStaticBriefing(lead);
}

function buildStaticBriefing(lead: Record<string, unknown>): string {
  const lines: string[] = ["🤖 *Briefing Dra. L.I.A.*\n"];
  lines.push(`👤 ${lead.nome || "N/A"} | ${lead.especialidade || "N/A"} | ${lead.cidade || "N/A"}${lead.uf ? "-" + lead.uf : ""}`);
  lines.push(`📧 ${lead.email || "N/A"} | 📱 ${lead.telefone_normalized || lead.telefone_raw || "N/A"}`);
  lines.push(`🎯 Interesse: ${lead.produto_interesse || "N/A"}`);
  lines.push(`🖨️ Impressora: ${lead.tem_impressora || "N/A"} ${lead.impressora_modelo || ""}`);
  lines.push(`📷 Scanner: ${lead.tem_scanner || "N/A"}`);
  if (lead.lojaintegrada_cliente_id) lines.push(`🛒 Cliente e-commerce (ID: ${lead.lojaintegrada_cliente_id})`);
  if (lead.astron_user_id) lines.push(`🎓 Plataforma cursos (ID: ${lead.astron_user_id})`);
  if (lead.resumo_historico_ia) lines.push(`\n💬 ${String(lead.resumo_historico_ia).slice(0, 300)}`);
  if (lead.piperun_link) lines.push(`\n🔗 ${lead.piperun_link}`);
  return lines.join("\n");
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

    // ── B. AI briefing → seller (ALWAYS) ──
    console.log("[lia-assign] Generating AI seller briefing");
    const briefing = await generateAISellerBriefing(lead);
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
        await updateExistingDeal(PIPERUN_API_KEY, Number(vendaDeal.id), assignedOwnerId, customFields, lead as Record<string, unknown>);
        console.log(`[lia-assign] Updated existing Vendas deal ${piperunId}`);
      } else if (estagnDeal) {
        // Has deal in Estagnados → move to Vendas
        piperunId = String(estagnDeal.id);
        flowType = "reactivate_estagnado";
        await moveDealToVendas(PIPERUN_API_KEY, Number(estagnDeal.id), assignedOwnerId, stage_id, customFields, lead as Record<string, unknown>);
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

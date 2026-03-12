import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeTagsFromStage, mergeTagsCrm, sendCampaignViaSellFlux, ALL_STAGNATION_TAGS, JOURNEY_TAGS } from "../_shared/sellflux-field-map.ts";
import {
  PIPELINES,
  STAGE_TO_ETAPA,
  DEAL_STATUS_MAP,
  DEAL_CUSTOM_FIELDS,
  PIPELINE_NAMES,
  PIPERUN_USERS,
  getCustomFieldValue,
  parseProposalItems,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isStagnantPipeline(pipelineId: number | undefined): boolean {
  return pipelineId === PIPELINES.ESTAGNADOS;
}

function isInStagnantStatus(leadStatus: string): boolean {
  return leadStatus.startsWith("est_") || leadStatus === "estagnado_final";
}

// ─── Payload Extraction Helpers ───

function extractIds(deal: Record<string, unknown>) {
  const stage = deal.stage as Record<string, unknown> | undefined;
  const pipeline = deal.pipeline as Record<string, unknown> | undefined;
  const owner = deal.owner as Record<string, unknown> | undefined;
  const person = deal.person as Record<string, unknown> | undefined;
  const company = (person?.company || deal.company) as Record<string, unknown> | undefined;

  return {
    stageId: Number(stage?.id || deal.stage_id) || undefined,
    stageName: stage?.name ? String(stage.name) : null,
    pipelineId: Number(pipeline?.id || deal.pipeline_id) || undefined,
    pipelineName: pipeline?.name ? String(pipeline.name) : null,
    ownerId: Number(owner?.id || deal.owner_id) || undefined,
    ownerName: owner?.name ? String(owner.name) : null,
    ownerEmail: owner?.email ? String(owner.email) : null,
    // Person identity
    personId: Number(person?.id) || undefined,
    personHash: person?.hash ? String(person.hash) : null,
    // Person email: cascade (contact_emails array → flat email)
    personEmail: (() => {
      const emails = person?.contact_emails as Array<{ address?: string }> | undefined;
      if (emails?.[0]?.address) return String(emails[0].address);
      if (person?.email) return String(person.email);
      return null;
    })(),
    personName: person?.name ? String(person.name) : null,
    // Person phone: cascade (contact_phones array → flat phone/mobile)
    personPhone: (() => {
      const phones = person?.contact_phones as Array<{ number?: string }> | undefined;
      if (phones?.[0]?.number) return String(phones[0].number);
      if (person?.phone) return String(person.phone);
      if (person?.mobile) return String(person.mobile);
      return null;
    })(),
    personCpf: person?.cpf ? String(person.cpf) : null,
    personJobTitle: person?.job_title ? String(person.job_title) : null,
    personGender: person?.gender ? String(person.gender) : null,
    personLinkedin: person?.linkedin ? String(person.linkedin) : null,
    personFacebook: person?.facebook ? String(person.facebook) : null,
    personObservation: person?.observation ? String(person.observation) : null,
    personBirthDay: person?.birth_day ? String(person.birth_day) : null,
    personWebsite: person?.website ? String(person.website) : null,
    personAddress: person?.address as Record<string, unknown> | undefined,
    personCity: (person?.city as Record<string, unknown>)?.name ? String((person?.city as Record<string, unknown>).name) : null,
    // Person UF: cascade (city.uf → state.abbr → state.initials → state.name)
    personState: (() => {
      const city = person?.city as Record<string, unknown> | undefined;
      if (city?.uf) return String(city.uf);
      const state = person?.state as Record<string, unknown> | undefined;
      return state?.abbr ? String(state.abbr) : (state?.initials ? String(state.initials) : (state?.name ? String(state.name) : null));
    })(),
    // Company identity
    companyId: Number(company?.id) || undefined,
    companyHash: company?.hash ? String(company.hash) : null,
    companyName: company?.name ? String(company.name) : null,
    companyRazaoSocial: company?.company_name ? String(company.company_name) : null,
    companyCnpj: company?.cnpj ? String(company.cnpj) : null,
    companyIe: company?.ie ? String(company.ie) : null,
    // Company segment: cascade (object.name → string)
    companySegment: (() => {
      const seg = company?.segment;
      if (!seg) return null;
      if (typeof seg === "object" && (seg as Record<string, unknown>).name) return String((seg as Record<string, unknown>).name);
      return String(seg);
    })(),
    companyWebsite: company?.website ? String(company.website) : null,
    companyCnae: company?.cnae ? String(company.cnae) : null,
    // Company situation: cascade (company_situation → situation)
    companySituacao: company?.company_situation ? String(company.company_situation) : (company?.situation ? String(company.situation) : null),
    companyFacebook: company?.facebook ? String(company.facebook) : null,
    companyLinkedin: company?.linkedin ? String(company.linkedin) : null,
    companyTouchModel: company?.status_touch ? String(company.status_touch) : null,
    // Company address: merge flat fields + nested object
    companyAddress: (() => {
      const nested = company?.address as Record<string, unknown> | undefined;
      const flat: Record<string, unknown> = {};
      if (company?.address_street) flat.street = String(company.address_street);
      if (company?.address_number) flat.number = String(company.address_number);
      if (company?.address_complement) flat.complement = String(company.address_complement);
      if (company?.address_postal_code) flat.postal_code = String(company.address_postal_code);
      if (company?.district) flat.district = String(company.district);
      const hasFlat = Object.keys(flat).length > 0;
      if (hasFlat) return { ...(nested || {}), ...flat };
      return nested || null;
    })(),
    companyCity: (company?.city as Record<string, unknown>)?.name ? String((company?.city as Record<string, unknown>).name) : null,
    // Company UF: cascade (city.uf → state.abbr → state.name)
    companyState: (() => {
      const city = company?.city as Record<string, unknown> | undefined;
      if (city?.uf) return String(city.uf);
      const state = company?.state as Record<string, unknown> | undefined;
      return state?.abbr ? String(state.abbr) : (state?.name ? String(state.name) : null);
    })(),
    companyCustomFields: company?.custom_fields as unknown[] | undefined,
    // Company phone: cascade (contact_phones → phones)
    companyPhone: (() => {
      const phones = company?.contact_phones as Array<{ number?: string }> | undefined;
      if (phones?.[0]?.number) return String(phones[0].number);
      const oldPhones = company?.phones as Array<{ phone?: string }> | undefined;
      return oldPhones?.[0]?.phone ? String(oldPhones[0].phone) : null;
    })(),
    // Company email: cascade (contact_emails → emails)
    companyEmail: (() => {
      const emails = company?.contact_emails as Array<{ address?: string }> | undefined;
      if (emails?.[0]?.address) return String(emails[0].address);
      const oldEmails = company?.emails as Array<{ email?: string }> | undefined;
      return oldEmails?.[0]?.email ? String(oldEmails[0].email) : null;
    })(),
    // Deal metadata
    dealHash: deal.hash ? String(deal.hash) : null,
    dealDescription: deal.description ? String(deal.description) : null,
    dealObservation: deal.observation ? String(deal.observation) : null,
    dealDeleted: deal.deleted === true,
    dealFreezed: deal.freezed === true,
    dealFrozenAt: deal.frozen_at ? String(deal.frozen_at) : null,
    dealProbability: deal.probability != null ? Number(deal.probability) : null,
    dealLeadTime: deal.lead_time != null ? Number(deal.lead_time) : null,
    dealValueMrr: deal.value_mrr != null ? Number(deal.value_mrr) : null,
    dealLastContact: deal.last_contact ? String(deal.last_contact) : null,
    dealStageChangedAt: deal.stage_changed_at ? String(deal.stage_changed_at) : null,
    dealCreatedAt: deal.created_at ? String(deal.created_at) : null,
    dealClosedAt: deal.closed_at ? String(deal.closed_at) : null,
    dealProbablyClosedAt: deal.probably_closed_at ? String(deal.probably_closed_at) : null,
    dealOriginId: Number((deal.origin as Record<string, unknown>)?.id) || undefined,
    dealOriginName: (deal.origin as Record<string, unknown>)?.name ? String((deal.origin as Record<string, unknown>).name) : null,
    dealOriginSubName: (() => {
      const originSub = (deal.origin as Record<string, unknown>)?.origin;
      if (!originSub) return null;
      if (typeof originSub === "object" && (originSub as Record<string, unknown>).name) return String((originSub as Record<string, unknown>).name);
      return String(originSub);
    })(),
    dealInvolvedUsers: deal.involved_users as unknown[] | undefined,
    dealProposals: deal.proposals as unknown[] | undefined,
  };
}

function extractWebhookCustomFields(deal: Record<string, unknown>) {
  const cfArray = deal.custom_fields as Array<{ custom_field_id: number; value?: string | number | null }> | undefined;

  if (cfArray && Array.isArray(cfArray) && cfArray.length > 0 && cfArray[0]?.custom_field_id) {
    return {
      produtoInteresse: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE),
      temScanner: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.TEM_SCANNER),
      temImpressora: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.TEM_IMPRESSORA),
      idCliente: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.BANCO_DADOS_ID),
      especialidade: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.ESPECIALIDADE),
      paisOrigem: getCustomFieldValue(cfArray, DEAL_CUSTOM_FIELDS.PAIS_ORIGEM),
    };
  }

  const extractByName = (fieldName: string): string | null => {
    const person = deal.person as Record<string, unknown> | undefined;
    const customs = (
      person?.customFields || deal.customFields || deal.custom_fields || []
    ) as Array<{ name?: string; label?: string; value?: unknown; raw_value?: unknown }>;
    if (Array.isArray(customs)) {
      const field = customs.find((f) => {
        const name = (f.name || f.label || "").toLowerCase();
        return name.includes(fieldName.toLowerCase());
      });
      if (field) {
        const val = field.value ?? field.raw_value;
        if (val != null) return String(val);
      }
    }
    return null;
  };

  return {
    produtoInteresse: extractByName("produto de interesse"),
    temScanner: extractByName("tem scanner"),
    temImpressora: extractByName("tem impressora"),
    idCliente: extractByName("banco de dados") || extractByName("id banco"),
    especialidade: extractByName("especialidade"),
    paisOrigem: extractByName("pais de origem") || extractByName("país de origem"),
  };
}

// ─── Identity Resolution ───

interface LeadRecord {
  id: string;
  nome: string;
  telefone_normalized: string | null;
  produto_interesse: string | null;
  lead_status: string;
  tags_crm: string[] | null;
  piperun_deals_history: unknown[] | null;
}

async function findLeadByCascade(
  supabase: ReturnType<typeof createClient>,
  dealId: string,
  personHash: string | null,
  personId: number | undefined,
  email: string | null,
): Promise<LeadRecord | null> {
  const selectCols = "id, nome, telefone_normalized, produto_interesse, lead_status, tags_crm, piperun_deals_history";

  // 1. By piperun_id (current deal)
  const { data: byDeal } = await supabase
    .from("lia_attendances")
    .select(selectCols)
    .eq("piperun_id", dealId)
    .maybeSingle();
  if (byDeal) return byDeal as LeadRecord;

  // 2. By pessoa_hash
  if (personHash) {
    const { data: byHash } = await supabase
      .from("lia_attendances")
      .select(selectCols)
      .eq("pessoa_hash", personHash)
      .maybeSingle();
    if (byHash) return byHash as LeadRecord;
  }

  // 3. By pessoa_piperun_id
  if (personId) {
    const { data: byPersonId } = await supabase
      .from("lia_attendances")
      .select(selectCols)
      .eq("pessoa_piperun_id", personId)
      .maybeSingle();
    if (byPersonId) return byPersonId as LeadRecord;
  }

  // 4. By email
  if (email) {
    const { data: byEmail } = await supabase
      .from("lia_attendances")
      .select(selectCols)
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (byEmail) return byEmail as LeadRecord;
  }

  return null;
}

// ─── Deals History Helper ───

interface DealSnapshot {
  deal_id: string;
  deal_hash: string | null;
  pipeline_id: number | undefined;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string;
  value: number | null;
  created_at: string | null;
  closed_at: string | null;
  product: string | null;
}

function upsertDealHistory(
  currentHistory: unknown[] | null,
  snapshot: DealSnapshot,
): DealSnapshot[] {
  const history = (Array.isArray(currentHistory) ? [...currentHistory] : []) as DealSnapshot[];
  const idx = history.findIndex((d) => String(d.deal_id) === String(snapshot.deal_id));
  if (idx >= 0) {
    history[idx] = snapshot;
  } else {
    history.push(snapshot);
  }
  return history;
}

// ─── Proposals Aggregation ───

function aggregateProposals(proposals: unknown[] | undefined) {
  if (!proposals || !Array.isArray(proposals) || proposals.length === 0) return null;
  let totalValue = 0;
  let totalMrr = 0;
  let lastStatus: number | null = null;

  for (const p of proposals) {
    const prop = p as Record<string, unknown>;
    if (prop.value != null) totalValue += Number(prop.value) || 0;
    if (prop.value_mrr != null) totalMrr += Number(prop.value_mrr) || 0;
    if (prop.status != null) lastStatus = Number(prop.status);
  }

  return { data: proposals, totalValue, totalMrr, lastStatus };
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");
    const SELLFLUX_WEBHOOK_CAMPANHAS = Deno.env.get("SELLFLUX_WEBHOOK_CAMPANHAS");

    // ─── Secret Validation ───
    const WEBHOOK_SECRET = Deno.env.get("PIPERUN_WEBHOOK_SECRET");
    if (WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get("X-Webhook-Secret");
      if (incomingSecret !== WEBHOOK_SECRET) {
        console.warn("[piperun-webhook] Invalid or missing X-Webhook-Secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[piperun-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    const deal = (payload.deal || payload) as Record<string, unknown>;
    const dealId = String(deal.id || payload.deal_id || "");
    const lossReason = (deal.lost_reason || deal.loss_reason) as Record<string, unknown> | undefined;
    const tags = deal.tags as Array<{ name?: string }> | undefined;

    const ids = extractIds(deal);
    const customFields = extractWebhookCustomFields(deal);

    const resolvedStatus = ids.stageId ? (STAGE_TO_ETAPA[ids.stageId] || "sem_contato") : "sem_contato";

    if (!dealId) {
      return new Response(JSON.stringify({ error: "deal_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Identity Resolution (cascading search) ───
    const personEmail = ids.personEmail || ((deal.person as Record<string, unknown>)?.email ? String((deal.person as Record<string, unknown>).email) : null);
    const currentLead = await findLeadByCascade(supabase, dealId, ids.personHash, ids.personId, personEmail);

    let leadId: string;
    let leadNome: string;
    let leadTelefone: string | null;
    let leadProduto: string | null;
    let leadStatus: string;
    let currentTagsCrm: string[] | null;
    let currentDealsHistory: unknown[] | null;
    let isNewLead = false;

    if (!currentLead) {
      // AUTO-CREATE
      isNewLead = true;
      const personName = ids.personName || (deal.title ? String(deal.title).split(" - ")[0] : "Lead PipeRun");

      if (!personEmail) {
        console.warn("[piperun-webhook] Deal sem email:", dealId);
        return new Response(JSON.stringify({ error: "Deal sem email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let phoneNormalized: string | null = null;
      if (ids.personPhone) {
        let digits = ids.personPhone.replace(/\D/g, "");
        if (digits.startsWith("0")) digits = digits.slice(1);
        if (!digits.startsWith("55")) digits = "55" + digits;
        if (digits.length >= 12 && digits.length <= 13) phoneNormalized = "+" + digits;
      }

      const { tags: initialTags } = computeTagsFromStage(resolvedStatus, [JOURNEY_TAGS.J01_CONSCIENCIA]);

      const initialDealSnapshot: DealSnapshot = {
        deal_id: dealId,
        deal_hash: ids.dealHash,
        pipeline_id: ids.pipelineId,
        pipeline_name: ids.pipelineName || (ids.pipelineId ? PIPELINE_NAMES[ids.pipelineId] : null) || null,
        stage_name: ids.stageName,
        status: "aberta",
        value: deal.value != null ? Number(deal.value) || null : null,
        created_at: ids.dealCreatedAt,
        closed_at: ids.dealClosedAt,
        product: customFields.produtoInteresse || null,
      };

      const newLeadData: Record<string, unknown> = {
        nome: personName,
        email: personEmail.toLowerCase().trim(),
        telefone_raw: ids.personPhone,
        telefone_normalized: phoneNormalized,
        piperun_id: dealId,
        piperun_link: `https://app.pipe.run/#/deals/${dealId}`,
        source: "piperun_webhook",
        lead_status: resolvedStatus,
        produto_interesse: customFields.produtoInteresse || null,
        area_atuacao: ids.personJobTitle || null,
        proprietario_lead_crm: ids.ownerName || (ids.ownerId ? PIPERUN_USERS[ids.ownerId]?.name : null) || null,
        status_atual_lead_crm: ids.stageName || null,
        funil_entrada_crm: ids.pipelineName || (ids.pipelineId ? PIPELINE_NAMES[ids.pipelineId] : null) || null,
        cidade: ids.personCity || null,
        uf: ids.personState || null,
        tags_crm: initialTags,
        // Identity keys
        pessoa_hash: ids.personHash,
        pessoa_piperun_id: ids.personId || null,
        empresa_hash: ids.companyHash,
        empresa_piperun_id: ids.companyId || null,
        piperun_deals_history: [initialDealSnapshot],
        // Person fields
        pessoa_cpf: ids.personCpf,
        pessoa_cargo: ids.personJobTitle,
        pessoa_genero: ids.personGender,
        pessoa_linkedin: ids.personLinkedin,
        pessoa_facebook: ids.personFacebook,
        pessoa_observation: ids.personObservation,
        pessoa_website: ids.personWebsite,
        pessoa_nascimento: ids.personBirthDay || null,
        pessoa_endereco: ids.personAddress || null,
        // Company fields
        empresa_nome: ids.companyName,
        empresa_razao_social: ids.companyRazaoSocial,
        empresa_cnpj: ids.companyCnpj,
        empresa_ie: ids.companyIe,
        empresa_cnae: ids.companyCnae,
        empresa_website: ids.companyWebsite,
        empresa_situacao: ids.companySituacao,
        empresa_facebook: ids.companyFacebook,
        empresa_linkedin: ids.companyLinkedin,
        empresa_touch_model: ids.companyTouchModel,
        empresa_cidade: ids.companyCity,
        empresa_uf: ids.companyState,
        empresa_endereco: ids.companyAddress || null,
        empresa_segmento: ids.companySegment,
        empresa_custom_fields: ids.companyCustomFields || [],
        // Deal metadata
        piperun_pipeline_id: ids.pipelineId || null,
        piperun_pipeline_name: ids.pipelineName,
        piperun_stage_id: ids.stageId || null,
        piperun_stage_name: ids.stageName,
        piperun_origin_id: ids.dealOriginId || null,
        piperun_origin_name: ids.dealOriginName,
        piperun_origin_sub_name: ids.dealOriginSubName,
        piperun_owner_id: ids.ownerId || null,
        piperun_deleted: ids.dealDeleted,
        piperun_frozen: ids.dealFreezed,
        piperun_frozen_at: ids.dealFrozenAt,
        piperun_probability: ids.dealProbability,
        piperun_lead_time: ids.dealLeadTime,
        piperun_value_mrr: ids.dealValueMrr,
        piperun_last_contact_at: ids.dealLastContact,
        piperun_stage_changed_at: ids.dealStageChangedAt,
        piperun_created_at: ids.dealCreatedAt,
        piperun_closed_at: ids.dealClosedAt,
        piperun_probably_closed_at: ids.dealProbablyClosedAt,
        piperun_custom_fields: deal.custom_fields || [],
        piperun_tags_raw: tags || null,
        piperun_involved_users: ids.dealInvolvedUsers || null,
      };

      // Deal status
      const dealStatus = deal.status;
      if (dealStatus !== undefined) {
        const numStatus = typeof dealStatus === "number" ? dealStatus : (dealStatus === "won" ? 1 : dealStatus === "lost" ? 2 : 0);
        newLeadData.status_oportunidade = DEAL_STATUS_MAP[numStatus] || "aberta";
        newLeadData.piperun_status = numStatus;
      }
      if (deal.value != null) newLeadData.valor_oportunidade = Number(deal.value) || null;

      // Proposals
      const proposalAgg = aggregateProposals(ids.dealProposals);
      if (proposalAgg) {
        newLeadData.proposals_data = proposalAgg.data;
        newLeadData.proposals_total_value = proposalAgg.totalValue;
        newLeadData.proposals_total_mrr = proposalAgg.totalMrr;
        if (proposalAgg.lastStatus != null) newLeadData.proposals_last_status = proposalAgg.lastStatus;
      }

      const { data: newLead, error: insertError } = await supabase
        .from("lia_attendances")
        .upsert(newLeadData, { onConflict: "email" })
        .select("id, nome, telefone_normalized, produto_interesse, lead_status, tags_crm, piperun_deals_history")
        .single();

      if (insertError || !newLead) {
        console.error("[piperun-webhook] Erro ao criar lead:", insertError);
        return new Response(JSON.stringify({ error: insertError?.message || "Erro ao criar lead" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[piperun-webhook] Lead CRIADO:", newLead.id, "| deal:", dealId);
      leadId = newLead.id;
      leadNome = newLead.nome;
      leadTelefone = newLead.telefone_normalized;
      leadProduto = newLead.produto_interesse;
      leadStatus = newLead.lead_status;
      currentTagsCrm = newLead.tags_crm;
      currentDealsHistory = newLead.piperun_deals_history;
    } else {
      leadId = currentLead.id;
      leadNome = currentLead.nome;
      leadTelefone = currentLead.telefone_normalized;
      leadProduto = currentLead.produto_interesse;
      leadStatus = currentLead.lead_status;
      currentTagsCrm = currentLead.tags_crm;
      currentDealsHistory = currentLead.piperun_deals_history;
    }

    // ─── Build update payload ───
    const updateData: Record<string, unknown> = {};

    // Always update piperun_id to current deal + link
    updateData.piperun_id = dealId;
    updateData.piperun_link = `https://app.pipe.run/#/deals/${dealId}`;

    // Always update nome & telefone from PipeRun (source of truth)
    if (ids.personName) updateData.nome = ids.personName;
    if (ids.personPhone) {
      updateData.telefone_raw = ids.personPhone;
      let digits = ids.personPhone.replace(/\D/g, "");
      if (digits.startsWith("0")) digits = digits.slice(1);
      if (!digits.startsWith("55")) digits = "55" + digits;
      if (digits.length >= 12 && digits.length <= 13) updateData.telefone_normalized = "+" + digits;
    }

    // Identity keys (always persist, never overwrite with null)
    if (ids.personHash) updateData.pessoa_hash = ids.personHash;
    if (ids.personId) updateData.pessoa_piperun_id = ids.personId;
    if (ids.companyHash) updateData.empresa_hash = ids.companyHash;
    if (ids.companyId) updateData.empresa_piperun_id = ids.companyId;

    // Owner
    if (ids.ownerName) updateData.proprietario_lead_crm = ids.ownerName;
    else if (ids.ownerId && PIPERUN_USERS[ids.ownerId]) updateData.proprietario_lead_crm = PIPERUN_USERS[ids.ownerId].name;
    if (ids.stageName) updateData.status_atual_lead_crm = ids.stageName;
    if (ids.pipelineName) updateData.funil_entrada_crm = ids.pipelineName;
    else if (ids.pipelineId && PIPELINE_NAMES[ids.pipelineId]) updateData.funil_entrada_crm = PIPELINE_NAMES[ids.pipelineId];

    // Deal metadata
    if (ids.pipelineId) updateData.piperun_pipeline_id = ids.pipelineId;
    if (ids.pipelineName) updateData.piperun_pipeline_name = ids.pipelineName;
    if (ids.stageId) updateData.piperun_stage_id = ids.stageId;
    if (ids.stageName) updateData.piperun_stage_name = ids.stageName;
    if (ids.dealOriginId) updateData.piperun_origin_id = ids.dealOriginId;
    if (ids.dealOriginName) updateData.piperun_origin_name = ids.dealOriginName;
    if (ids.dealOriginSubName) updateData.piperun_origin_sub_name = ids.dealOriginSubName;
    if (ids.ownerId) updateData.piperun_owner_id = ids.ownerId;
    updateData.piperun_deleted = ids.dealDeleted;
    updateData.piperun_frozen = ids.dealFreezed;
    if (ids.dealFrozenAt) updateData.piperun_frozen_at = ids.dealFrozenAt;
    if (ids.dealProbability != null) updateData.piperun_probability = ids.dealProbability;
    if (ids.dealLeadTime != null) updateData.piperun_lead_time = ids.dealLeadTime;
    if (ids.dealValueMrr != null) updateData.piperun_value_mrr = ids.dealValueMrr;
    if (ids.dealLastContact) updateData.piperun_last_contact_at = ids.dealLastContact;
    if (ids.dealStageChangedAt) updateData.piperun_stage_changed_at = ids.dealStageChangedAt;
    if (ids.dealCreatedAt) updateData.piperun_created_at = ids.dealCreatedAt;
    if (ids.dealClosedAt) updateData.piperun_closed_at = ids.dealClosedAt;
    if (ids.dealProbablyClosedAt) updateData.piperun_probably_closed_at = ids.dealProbablyClosedAt;
    if (deal.custom_fields) updateData.piperun_custom_fields = deal.custom_fields;
    if (ids.dealInvolvedUsers) updateData.piperun_involved_users = ids.dealInvolvedUsers;

    // Deal status
    const dealStatus = deal.status;
    if (dealStatus !== undefined) {
      const numStatus = typeof dealStatus === "number" ? dealStatus : (dealStatus === "won" ? 1 : dealStatus === "lost" ? 2 : 0);
      updateData.status_oportunidade = DEAL_STATUS_MAP[numStatus] || "aberta";
      updateData.piperun_status = numStatus;
    }
    if (deal.value != null) updateData.valor_oportunidade = Number(deal.value) || null;
    if (deal.temperature) updateData.temperatura_lead = String(deal.temperature);
    if (lossReason?.name) updateData.motivo_perda = String(lossReason.name);
    if (lossReason?.description) updateData.comentario_perda = String(lossReason.description);
    else if (lossReason?.comment) updateData.comentario_perda = String(lossReason.comment);
    if (deal.lead_timing != null) updateData.lead_timing_dias = Number(deal.lead_timing) || null;
    if (deal.closed_at) updateData.data_fechamento_crm = String(deal.closed_at);

    // Person fields (smart merge: only set if value exists)
    if (ids.personCity) updateData.cidade = ids.personCity;
    if (ids.personState) updateData.uf = ids.personState;
    if (ids.personCpf) updateData.pessoa_cpf = ids.personCpf;
    if (ids.personJobTitle) { updateData.pessoa_cargo = ids.personJobTitle; updateData.area_atuacao = ids.personJobTitle; }
    if (ids.personGender) updateData.pessoa_genero = ids.personGender;
    if (ids.personLinkedin) updateData.pessoa_linkedin = ids.personLinkedin;
    if (ids.personFacebook) updateData.pessoa_facebook = ids.personFacebook;
    if (ids.personObservation) updateData.pessoa_observation = ids.personObservation;
    if (ids.personWebsite) updateData.pessoa_website = ids.personWebsite;
    if (ids.personBirthDay) updateData.pessoa_nascimento = ids.personBirthDay;
    if (ids.personAddress) updateData.pessoa_endereco = ids.personAddress;

    // Company fields
    if (ids.companyName) updateData.empresa_nome = ids.companyName;
    if (ids.companyRazaoSocial) updateData.empresa_razao_social = ids.companyRazaoSocial;
    if (ids.companyCnpj) updateData.empresa_cnpj = ids.companyCnpj;
    if (ids.companyIe) updateData.empresa_ie = ids.companyIe;
    if (ids.companyCnae) updateData.empresa_cnae = ids.companyCnae;
    if (ids.companyWebsite) updateData.empresa_website = ids.companyWebsite;
    if (ids.companySituacao) updateData.empresa_situacao = ids.companySituacao;
    if (ids.companyFacebook) updateData.empresa_facebook = ids.companyFacebook;
    if (ids.companyLinkedin) updateData.empresa_linkedin = ids.companyLinkedin;
    if (ids.companyTouchModel) updateData.empresa_touch_model = ids.companyTouchModel;
    if (ids.companyCity) updateData.empresa_cidade = ids.companyCity;
    if (ids.companyState) updateData.empresa_uf = ids.companyState;
    if (ids.companyAddress) updateData.empresa_endereco = ids.companyAddress;
    if (ids.companyCustomFields) updateData.empresa_custom_fields = ids.companyCustomFields;
    if (ids.companySegment) updateData.empresa_segmento = ids.companySegment;

    // Custom fields from shared mapping
    if (customFields.produtoInteresse) updateData.produto_interesse = customFields.produtoInteresse;
    if (customFields.temScanner) updateData.tem_scanner = customFields.temScanner;
    if (customFields.temImpressora) updateData.tem_impressora = customFields.temImpressora;
    if (customFields.idCliente) updateData.id_cliente_smart = customFields.idCliente;
    if (customFields.especialidade) updateData.especialidade = customFields.especialidade;
    if (customFields.paisOrigem) updateData.pais_origem = customFields.paisOrigem;

    // Proposals aggregation
    const proposalAgg = aggregateProposals(ids.dealProposals);
    if (proposalAgg) {
      updateData.proposals_data = proposalAgg.data;
      updateData.proposals_total_value = proposalAgg.totalValue;
      updateData.proposals_total_mrr = proposalAgg.totalMrr;
      if (proposalAgg.lastStatus != null) updateData.proposals_last_status = proposalAgg.lastStatus;
    }

    // ─── Deals History (upsert current deal snapshot) ───
    const currentDealStatus = dealStatus !== undefined
      ? (typeof dealStatus === "number" ? (DEAL_STATUS_MAP[dealStatus] || "aberta") : String(dealStatus))
      : "aberta";

    const dealSnapshot: DealSnapshot = {
      deal_id: dealId,
      deal_hash: ids.dealHash,
      pipeline_id: ids.pipelineId,
      pipeline_name: ids.pipelineName || (ids.pipelineId ? PIPELINE_NAMES[ids.pipelineId] : null) || null,
      stage_name: ids.stageName,
      status: currentDealStatus,
      value: deal.value != null ? Number(deal.value) || null : null,
      created_at: ids.dealCreatedAt,
      closed_at: ids.dealClosedAt,
      product: customFields.produtoInteresse || leadProduto || null,
    };

    updateData.piperun_deals_history = upsertDealHistory(currentDealsHistory, dealSnapshot);

    // ─── Journey TAG logic ───
    let journeyTagsAdded: string[] = [];
    let newStatus: string | null = null;

    if (ids.stageId) {
      const mappedStatus = STAGE_TO_ETAPA[ids.stageId] || "sem_contato";

      if (isStagnantPipeline(ids.pipelineId) && !isInStagnantStatus(leadStatus) && leadStatus !== "estagnado_final") {
        updateData.ultima_etapa_comercial = leadStatus;
        updateData.lead_status = mappedStatus;
        newStatus = mappedStatus;
        updateData.updated_at = new Date().toISOString();
        console.log("[piperun-webhook] Iniciando funil estagnação:", leadId);
      } else if (!isStagnantPipeline(ids.pipelineId) && (isInStagnantStatus(leadStatus) || leadStatus === "estagnado_final")) {
        updateData.lead_status = mappedStatus;
        newStatus = mappedStatus;
        updateData.updated_at = new Date().toISOString();
        const { tags: recoveredTags } = computeTagsFromStage(mappedStatus, currentTagsCrm);
        const finalTags = mergeTagsCrm(recoveredTags, ["C_RECUPERADO"], ALL_STAGNATION_TAGS);
        updateData.tags_crm = finalTags;
        journeyTagsAdded = ["C_RECUPERADO"];
        console.log("[piperun-webhook] Resgatando lead:", leadId, "→", mappedStatus, "+C_RECUPERADO");
      } else {
        if (mappedStatus !== leadStatus) {
          updateData.lead_status = mappedStatus;
          newStatus = mappedStatus;

          fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ leadId }),
          }).catch(e => console.warn("[piperun-webhook] cognitive re-analysis error:", e));
        }
        const { tags: updatedTags, add } = computeTagsFromStage(mappedStatus, currentTagsCrm);
        updateData.tags_crm = updatedTags;
        journeyTagsAdded = add;
      }
    }

    // ─── Oportunidade Encerrada (won/lost) → Cross-sell/Upsell ───
    const isWon = deal.status === "won" || deal.status === 1;
    const isLost = deal.status === "lost" || deal.status === 2;
    const produtoEncerrado = (updateData.produto_interesse as string) || leadProduto || null;

    if (isWon || isLost) {
      const closedType = isWon ? "COMPRA" : "NAO_COMPROU";
      const baseTags = (updateData.tags_crm as string[]) || currentTagsCrm || [];

      const addTags: string[] = [
        `C_OPP_ENCERRADA_${closedType}`,
        "C_REENTRADA_NUTRICAO",
      ];
      if (isWon) {
        addTags.push(JOURNEY_TAGS.J04_COMPRA, "C_CONTRATO_FECHADO", "C_PQL_RECOMPRA");
        if (produtoEncerrado) addTags.push(`COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      } else {
        if (produtoEncerrado) addTags.push(`NAO_COMPROU_${produtoEncerrado.toUpperCase().replace(/\s+/g, "_")}`);
      }

      const removeTags = [JOURNEY_TAGS.J03_NEGOCIACAO, "C_PERDIDO"];
      updateData.tags_crm = mergeTagsCrm(baseTags, addTags, removeTags);
      updateData.status_oportunidade = isWon ? "ganha" : "perdida_renutrir";

      if (isWon) {
        const { data: leadData } = await supabase
          .from("lia_attendances")
          .select("itens_proposta_crm")
          .eq("id", leadId)
          .maybeSingle();
        const rawItems = leadData?.itens_proposta_crm;
        if (rawItems) {
          const parsed = parseProposalItems(rawItems);
          updateData.itens_proposta_parsed = parsed.parsed;
          if (parsed.equipments.scanner) updateData.equip_scanner = parsed.equipments.scanner;
          if (parsed.equipments.impressora) updateData.equip_impressora = parsed.equipments.impressora;
          if (parsed.equipments.cad) updateData.equip_cad = parsed.equipments.cad;
          if (parsed.equipments.pos_impressao) updateData.equip_pos_impressao = parsed.equipments.pos_impressao;
          if (parsed.equipments.notebook) updateData.equip_notebook = parsed.equipments.notebook;
          if (parsed.equipments.insumos) updateData.insumos_adquiridos = parsed.equipments.insumos;
          console.log(`[piperun-webhook] Parsed ${parsed.parsed.length} proposal items for won deal ${dealId}`);
        }
      }

      fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, trigger: "opp_closed", closedType, produtoEncerrado }),
      }).catch(e => console.warn("[piperun-webhook] cross-sell cognitive error:", e));

      if (isWon) {
        try {
          const { data: cogLead } = await supabase
            .from("lia_attendances")
            .select("cognitive_analysis, lead_stage_detected")
            .eq("id", leadId)
            .maybeSingle();

          if (cogLead?.cognitive_analysis) {
            const predicted = cogLead.lead_stage_detected;
            const accuracy = predicted === "SQL_decisor" ? 1.0 : predicted === "SAL_comparador" ? 0.6 : predicted === "PQL_recompra" ? 0.8 : predicted === "MQL_pesquisador" ? 0.3 : 0.5;
            await supabase.from("lia_attendances").update({ prediction_accuracy: accuracy }).eq("id", leadId);
            console.log(`[piperun-webhook] prediction_accuracy: ${accuracy} (predicted: ${predicted})`);
          }
        } catch (e) {
          console.warn("[piperun-webhook] prediction_accuracy error:", e);
        }
      }

      console.log(`[piperun-webhook] Opp encerrada (${closedType}): lead=${leadId}, produto=${produtoEncerrado} → reentrada nutrição cross-sell`);
    }

    // PipeRun tags merge
    if (tags && Array.isArray(tags)) {
      const piperunTags = tags.map((t) => t.name).filter(Boolean) as string[];
      if (piperunTags.length > 0) {
        const base = (updateData.tags_crm as string[]) || currentTagsCrm || [];
        updateData.tags_crm = mergeTagsCrm(base, piperunTags);
      }
      updateData.piperun_tags_raw = tags;
    }

    // Update lead
    const { error: updateError } = await supabase
      .from("lia_attendances")
      .update(updateData)
      .eq("id", leadId);

    if (updateError) {
      console.error("[piperun-webhook] Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find team member
    let teamMember = null;
    const resolvedOwnerEmail = ids.ownerEmail || (ids.ownerId ? PIPERUN_USERS[ids.ownerId]?.email : null);
    if (resolvedOwnerEmail) {
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number, nome_completo")
        .eq("email", resolvedOwnerEmail)
        .eq("ativo", true)
        .single();
      teamMember = data;
    }

    // ─── SellFlux welcome (preferred) ───
    let messageStatus = "skipped";
    let errorDetails: string | null = null;

    if (SELLFLUX_WEBHOOK_CAMPANHAS && leadTelefone && isNewLead) {
      const { data: fullLead } = await supabase
        .from("lia_attendances")
        .select("*")
        .eq("id", leadId)
        .single();

      if (fullLead) {
        const result = await sendCampaignViaSellFlux(SELLFLUX_WEBHOOK_CAMPANHAS, fullLead as Record<string, unknown>, "BOAS_VINDAS_NOVO_LEAD");
        messageStatus = result.success ? "enviado" : "erro";
        if (!result.success) errorDetails = result.response;
      }
    } else if (MANYCHAT_API_KEY && leadTelefone) {
      try {
        const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${MANYCHAT_API_KEY}`,
          },
          body: JSON.stringify({
            subscriber_id: leadTelefone,
            flow_ns: "boas_vindas_lead",
          }),
        });
        const mcData = await mcRes.json();
        messageStatus = mcRes.ok ? "enviado" : "erro";
        if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
      } catch (mcErr) {
        messageStatus = "erro";
        errorDetails = String(mcErr);
      }
    }

    // Log message
    await supabase.from("message_logs").insert({
      lead_id: leadId,
      team_member_id: teamMember?.id || null,
      whatsapp_number: teamMember?.whatsapp_number || null,
      tipo: "boas_vindas",
      mensagem_preview: `Atribuição de ${ids.ownerName || "vendedor"} para ${leadNome}${journeyTagsAdded.length ? ` +TAGs: ${journeyTagsAdded.join(",")}` : ""}`,
      status: messageStatus,
      error_details: errorDetails,
    });

    // ─── Post-update Consolidation Verification (inline, no AI cost) ───
    try {
      const { data: check } = await supabase
        .from("lia_attendances")
        .select("pessoa_hash, empresa_hash, nome, email, telefone_normalized, etapa_crm, piperun_deals_history, empresa_nome, empresa_piperun_id, proposals_data, proposals_total_value, piperun_id, pessoa_piperun_id, cidade, produto_interesse, proprietario_lead_crm")
        .eq("id", leadId)
        .single();

      if (check) {
        const missing: string[] = [];
        const totalFields = 15;

        if (!check.pessoa_hash) missing.push("pessoa_hash");
        if (!check.empresa_hash) missing.push("empresa_hash");
        if (!check.telefone_normalized) missing.push("telefone");
        if (!check.etapa_crm) missing.push("etapa_crm");
        if (!check.cidade) missing.push("cidade");
        if (!check.produto_interesse) missing.push("produto_interesse");
        if (!check.proprietario_lead_crm) missing.push("proprietario_lead_crm");
        if (!check.pessoa_piperun_id) missing.push("pessoa_piperun_id");
        // Consistency checks
        if (check.empresa_piperun_id && !check.empresa_nome) missing.push("empresa_nome (has empresa_id)");
        if (check.piperun_id && (!Array.isArray(check.piperun_deals_history) || check.piperun_deals_history.length === 0)) missing.push("deals_history_empty");
        if (check.proposals_data && (!check.proposals_total_value || check.proposals_total_value <= 0)) missing.push("proposals_value_zero");

        const completeness = Math.round(((totalFields - missing.length) / totalFields) * 100);

        if (missing.length > 3) {
          await supabase.from("system_health_logs").insert({
            function_name: "piperun-webhook-consolidation",
            severity: missing.length > 6 ? "error" : "warning",
            error_type: "incomplete_consolidation",
            lead_email: personEmail,
            details: {
              lead_id: leadId,
              deal_id: dealId,
              is_new: isNewLead,
              missing_fields: missing,
              missing_count: missing.length,
              completeness_pct: completeness,
              timestamp: new Date().toISOString(),
            },
          });
          console.log(`[piperun-webhook] Consolidation check: ${completeness}% complete, missing: ${missing.join(", ")}`);
        }
      }
    } catch (verifyErr) {
      console.warn("[piperun-webhook] Consolidation verify error (non-blocking):", verifyErr);
    }

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      is_new: isNewLead,
      message_status: messageStatus,
      tags_added: journeyTagsAdded,
      deals_history_count: (updateData.piperun_deals_history as unknown[])?.length || 0,
      stagnant_funnel: newStatus?.startsWith("est") ? newStatus : null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[piperun-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

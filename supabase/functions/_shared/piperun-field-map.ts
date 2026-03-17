/**
 * Centralized PipeRun field mapping
 * All IDs, stages, pipelines, custom fields, and users mapped from PipeRun API
 * Used across all smart-ops edge functions for bidirectional sync
 */

export const PIPERUN_API_BASE = "https://api.pipe.run/v1";

// ─── Origins ───

export const ORIGINS = {
  DRA_LIA: { id: 762002, name: "Dra. L.I.A." },
} as const;

// ─── Pipelines ───

export const PIPELINES = {
  VENDAS: 18784,
  ATOS: 73999,
  EXPORTACAO: 39047,
  DISTRIBUIDOR_LEADS: 70898,
  ESTAGNADOS: 72938,
  EBOOK: 82128,
  TULIP_TESTE: 83813,
  CS_ONBOARDING: 83896,
  INTERESSE_CURSOS: 93303,
  INSUMOS: 100412,
  ECOMMERCE: 102702,
} as const;

export const PIPELINE_NAMES: Record<number, string> = {
  [PIPELINES.VENDAS]: "Funil de vendas",
  [PIPELINES.ATOS]: "Funil Atos",
  [PIPELINES.EXPORTACAO]: "Exportação",
  [PIPELINES.DISTRIBUIDOR_LEADS]: "Distribuidor de Leads",
  [PIPELINES.ESTAGNADOS]: "Funil Estagnados",
  [PIPELINES.EBOOK]: "Funil E-book",
  [PIPELINES.TULIP_TESTE]: "Tulip-Teste-Nv-Automação",
  [PIPELINES.CS_ONBOARDING]: "CS Onboarding",
  [PIPELINES.INTERESSE_CURSOS]: "Interesse em cursos",
  [PIPELINES.INSUMOS]: "Funil Insumos",
  [PIPELINES.ECOMMERCE]: "Funil E-commerce",
};

// ─── Stages (Etapas) ───

// Funil de Vendas (18784) — order-sorted
export const STAGES_VENDAS = {
  SEM_CONTATO: 99293,
  CONTATO_FEITO: 99294,
  EM_CONTATO: 379942,
  APRESENTACAO_VISITA: 99295,
  PROPOSTA_ENVIADA: 99296,
  NEGOCIACAO: 448526,
  FECHAMENTO: 99818,
} as const;

// Funil Estagnados (72938) — order-sorted
export const STAGES_ESTAGNADOS = {
  ETAPA_00_NOVOS: 447250,
  ETAPA_01_REATIVACAO: 447251,
  ETAPA_02_REATIVACAO: 542160,
  ETAPA_03_REATIVACAO: 542161,
  ETAPA_04_REATIVACAO: 447252,
  APRESENTACAO_VISITA_ESTAG: 447253,
  PROPOSTA_ENVIADA_ESTAG: 447254,
  FECHAMENTO_ESTAG: 447255,
  AUXILIAR: 544565,
  GET_NEW_OWNER: 545087,
} as const;

// CS Onboarding (83896) — order-sorted
export const STAGES_CS_ONBOARDING = {
  AUXILIAR_EMAIL: 535466,
  EM_ESPERA: 535465,
  SEM_DATA_AGENDAR: 523977,
  NAO_QUER_IMERSAO: 619883,
  TREINAMENTO_AGENDADO: 583087,
  TREINAMENTO_REALIZADO: 583110,
  ENVIAR_IMP3D: 523978,
  EQUIPAMENTOS_ENTREGUES: 523980,
  RETIRAR_SCAN_IMP3D: 523979,
  ACOMPANHAMENTO_15_DIAS_CS: 612326,
  ACOMP_30_DIAS_COMERCIAL: 525468,
  ACOMPANHAMENTO_ATENCAO: 612327,
  ACOMPANHAMENTO_FINALIZADO: 583337,
  NAO_USE_DKMNGR: 538897,
  NAO_USE_OMIE_FIX: 568247,
} as const;

// Funil Insumos (100412) — order-sorted
export const STAGES_INSUMOS = {
  SEM_CONTATO: 644260,
  CONTATO_FEITO: 644261,
  AMOSTRA_ENVIADA: 644262,
  RETORNO_AMOSTRA: 644263,
  FECHAMENTO: 644264,
} as const;

// Interesse em cursos (93303)
export const STAGES_CURSOS = {
  INTERESSADOS_BOT: 593305,
  IOCONNECT: 593306,
} as const;

// E-commerce (102702) — order-sorted (IDs to be confirmed via API)
export const STAGES_ECOMMERCE = {
  VISITANTES: 660001,
  NAVEGACAO_SITE: 660002,
  CHECKOUT_INICIADO: 660003,
  ABANDONO_CARRINHO: 660004,
  STATUS_TRANSACAO: 660005,
  STATUS_PEDIDO: 660006,
  POS_VENDA: 660007,
  ATIVACAO_MENSAL: 660008,
} as const;

// ─── Stage ID → lia_attendances.ultima_etapa_comercial mapping ───

export const STAGE_TO_ETAPA: Record<number, string> = {
  // Vendas
  [STAGES_VENDAS.SEM_CONTATO]: "sem_contato",
  [STAGES_VENDAS.CONTATO_FEITO]: "contato_feito",
  [STAGES_VENDAS.EM_CONTATO]: "em_contato",
  [STAGES_VENDAS.APRESENTACAO_VISITA]: "apresentacao",
  [STAGES_VENDAS.PROPOSTA_ENVIADA]: "proposta_enviada",
  [STAGES_VENDAS.NEGOCIACAO]: "negociacao",
  [STAGES_VENDAS.FECHAMENTO]: "fechamento",
  // Estagnados
  [STAGES_ESTAGNADOS.ETAPA_00_NOVOS]: "est_etapa1",
  [STAGES_ESTAGNADOS.ETAPA_01_REATIVACAO]: "est_etapa1",
  [STAGES_ESTAGNADOS.ETAPA_02_REATIVACAO]: "est_etapa2",
  [STAGES_ESTAGNADOS.ETAPA_03_REATIVACAO]: "est_etapa3",
  [STAGES_ESTAGNADOS.ETAPA_04_REATIVACAO]: "est_etapa4",
  [STAGES_ESTAGNADOS.APRESENTACAO_VISITA_ESTAG]: "est_apresentacao",
  [STAGES_ESTAGNADOS.PROPOSTA_ENVIADA_ESTAG]: "est_proposta",
  [STAGES_ESTAGNADOS.FECHAMENTO_ESTAG]: "estagnado_final",
  // CS Onboarding
  [STAGES_CS_ONBOARDING.AUXILIAR_EMAIL]: "cs_auxiliar_email",
  [STAGES_CS_ONBOARDING.EM_ESPERA]: "cs_em_espera",
  [STAGES_CS_ONBOARDING.SEM_DATA_AGENDAR]: "cs_sem_data_agendar",
  [STAGES_CS_ONBOARDING.NAO_QUER_IMERSAO]: "cs_nao_quer_imersao",
  [STAGES_CS_ONBOARDING.TREINAMENTO_AGENDADO]: "cs_treinamento_agendado",
  [STAGES_CS_ONBOARDING.TREINAMENTO_REALIZADO]: "cs_treinamento_realizado",
  [STAGES_CS_ONBOARDING.ENVIAR_IMP3D]: "cs_enviar_imp3d",
  [STAGES_CS_ONBOARDING.EQUIPAMENTOS_ENTREGUES]: "cs_equipamentos_entregues",
  [STAGES_CS_ONBOARDING.RETIRAR_SCAN_IMP3D]: "cs_retirar_scan",
  [STAGES_CS_ONBOARDING.ACOMPANHAMENTO_15_DIAS_CS]: "cs_acompanhamento_15d",
  [STAGES_CS_ONBOARDING.ACOMP_30_DIAS_COMERCIAL]: "cs_acomp_30d_comercial",
  [STAGES_CS_ONBOARDING.ACOMPANHAMENTO_ATENCAO]: "cs_acompanhamento_atencao",
  [STAGES_CS_ONBOARDING.ACOMPANHAMENTO_FINALIZADO]: "cs_finalizado",
  [STAGES_CS_ONBOARDING.NAO_USE_DKMNGR]: "cs_nao_use_dkmngr",
  [STAGES_CS_ONBOARDING.NAO_USE_OMIE_FIX]: "cs_nao_use_omie_fix",
  // Insumos
  [STAGES_INSUMOS.SEM_CONTATO]: "insumos_sem_contato",
  [STAGES_INSUMOS.CONTATO_FEITO]: "insumos_contato_feito",
  [STAGES_INSUMOS.AMOSTRA_ENVIADA]: "insumos_amostra_enviada",
  [STAGES_INSUMOS.RETORNO_AMOSTRA]: "insumos_retorno_amostra",
  [STAGES_INSUMOS.FECHAMENTO]: "insumos_fechamento",
  // E-commerce
  [STAGES_ECOMMERCE.VISITANTES]: "ecom_visitantes",
  [STAGES_ECOMMERCE.NAVEGACAO_SITE]: "ecom_navegacao",
  [STAGES_ECOMMERCE.CHECKOUT_INICIADO]: "ecom_checkout",
  [STAGES_ECOMMERCE.ABANDONO_CARRINHO]: "ecom_abandono",
  [STAGES_ECOMMERCE.STATUS_TRANSACAO]: "ecom_transacao",
  [STAGES_ECOMMERCE.STATUS_PEDIDO]: "ecom_pedido",
  [STAGES_ECOMMERCE.POS_VENDA]: "ecom_pos_venda",
  [STAGES_ECOMMERCE.ATIVACAO_MENSAL]: "ecom_ativacao",
};

// Reverse: etapa label → stage ID (for writing back to PipeRun)
export const ETAPA_TO_STAGE: Record<string, { pipeline_id: number; stage_id: number }> = {};
for (const [stageId, etapa] of Object.entries(STAGE_TO_ETAPA)) {
  const id = Number(stageId);
  // Find pipeline for this stage
  const pipeline =
    Object.values(STAGES_VENDAS).includes(id as never) ? PIPELINES.VENDAS :
    Object.values(STAGES_ESTAGNADOS).includes(id as never) ? PIPELINES.ESTAGNADOS :
    Object.values(STAGES_CS_ONBOARDING).includes(id as never) ? PIPELINES.CS_ONBOARDING :
    Object.values(STAGES_INSUMOS).includes(id as never) ? PIPELINES.INSUMOS :
    Object.values(STAGES_ECOMMERCE).includes(id as never) ? PIPELINES.ECOMMERCE :
    Object.values(STAGES_CURSOS).includes(id as never) ? PIPELINES.INTERESSE_CURSOS :
    0;
  if (!ETAPA_TO_STAGE[etapa]) {
    ETAPA_TO_STAGE[etapa] = { pipeline_id: pipeline, stage_id: id };
  }
}

// ─── Custom Fields ───

// Deal-level custom fields (belongs=1)
export const DEAL_CUSTOM_FIELDS = {
  ESPECIALIDADE: 549059,
  PRODUTO_INTERESSE: 549058,
  PRODUTO_INTERESSE_AUTO: 549148,
  WHATSAPP: 549150,
  AREA_ATUACAO: 549241,
  TEM_SCANNER: 549242,
  TEM_IMPRESSORA: 549243,
  PAIS_ORIGEM: 621083,
  INFORMACAO_DESEJADA: 623602,
  BANCO_DADOS_ID: 650066,
  CODIGO_CONTRATO: 673917,
  DATA_TREINAMENTO: 673925,
} as const;

// Hash keys for PUT /deals (PipeRun requires hash as flat keys for updates)
export const DEAL_CUSTOM_FIELD_HASHES: Record<number, string> = {
  [DEAL_CUSTOM_FIELDS.ESPECIALIDADE]: "ebe365a77c419c61857ceabb23d0bb54",
  [DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE]: "619a7f62bf5de569fc5dd9ee6b3b4048",
  [DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE_AUTO]: "eb81efa44c668c5b741cdf43928db450",
  [DEAL_CUSTOM_FIELDS.WHATSAPP]: "f7dc3e9b085802a19fcd444e46e69637",
  [DEAL_CUSTOM_FIELDS.AREA_ATUACAO]: "304e7f2d011a3307c6f409728b3ed7d0",
  [DEAL_CUSTOM_FIELDS.TEM_SCANNER]: "cd2c1cc55889d78f63ed0ff639e6ecbb",
  [DEAL_CUSTOM_FIELDS.TEM_IMPRESSORA]: "0d362620234c1dd5163a0942af8326e0",
  [DEAL_CUSTOM_FIELDS.PAIS_ORIGEM]: "eac51ba89e4b48965d9342a93563c3a4",
  [DEAL_CUSTOM_FIELDS.INFORMACAO_DESEJADA]: "9a93b104e94ffc08c7155be86436cfcc",
  [DEAL_CUSTOM_FIELDS.BANCO_DADOS_ID]: "9adaf79b1e29a77c82a2ed42cf27df6c",
  [DEAL_CUSTOM_FIELDS.CODIGO_CONTRATO]: "35b82d194615f358358c1fc4742a4f7d",
  [DEAL_CUSTOM_FIELDS.DATA_TREINAMENTO]: "e7f176ea20026552e19a2933ec77c122",
};

// Person/Organization custom fields (belongs=2)
export const PERSON_CUSTOM_FIELDS = {
  ESPECIALIDADE: 445631,
  TEM_IMPRESSORA: 546566,
  TEM_SCANNER: 546567,
  INFORMACAO_DESEJADA: 546568,
  ID_BANCO_DADOS: 646806,
  AREA_ATUACAO: 673900,
} as const;

// Pessoa custom fields (belongs=3)
export const PESSOA_CUSTOM_FIELDS = {
  AREA_ATUACAO: 674001,
  ESPECIALIDADE: 674002,
} as const;

// Pessoa custom field hashes (for PUT /persons)
export const PESSOA_CUSTOM_FIELD_HASHES: Record<number, string> = {
  [PESSOA_CUSTOM_FIELDS.AREA_ATUACAO]: "397dd33134e9a63c642636bf5fff3ae1",
  [PESSOA_CUSTOM_FIELDS.ESPECIALIDADE]: "7a5764a42970b6cb0868dc203251936f",
};

// ─── Users (Vendedores) ───

export const PIPERUN_USERS: Record<number, { name: string; email: string; role: string; cellphone?: string }> = {
  100600: { name: "Marcela Brito", email: "marcela.brito@smartdent.com.br", role: "vendedora" },
  98054: { name: "Gabriella Ferreira", email: "gabriella.ferreira@smartdent.com.br", role: "vendedora" },
  95097: { name: "Paulo Sérgio", email: "paulo.sergio@smartdent.com.br", role: "vendedor", cellphone: "5516993014067" },
  92511: { name: "Alexandre", email: "alexandre@novapremier.com.br", role: "distribuidor" },
  90409: { name: "RH SmartDent", email: "rh@smartdent.com.br", role: "rh" },
  79280: { name: "Daniele Oliveira", email: "dani.oliveira@smartdent.com.br", role: "vendedora", cellphone: "5516996333053" },
  77312: { name: "Thiago Godoy", email: "thiago.godoy@smartdent.com.br", role: "vendedor" },
  64367: { name: "Thiago Nicoletti", email: "sdpp@smartdent.com.br", role: "gestor" },
  51616: { name: "Janaina Santos", email: "janaina.santos@smartdent.com.br", role: "vendedora", cellphone: "5516994364731" },
  47802: { name: "Lucas Silva", email: "lucas.silva@smartdent.com.br", role: "vendedor", cellphone: "5516999939130" },
  47675: { name: "Patricia Gastaldi", email: "patricia.gastaldi@smartdent.com.br", role: "vendedora", cellphone: "5516981158403" },
  33626: { name: "Evandro Silva", email: "evandro.silva@smartdent.com.br", role: "vendedor", cellphone: "5516993895371" },
};

// ─── Deal status mapping ───

export const DEAL_STATUS_MAP: Record<number, string> = {
  0: "aberta",
  1: "ganha",
  2: "perdida",
};

// ─── Field extraction from PipeRun deal → lia_attendances ───

export interface PipeRunDealData {
  id: number;
  title?: string;
  pipeline_id?: number;
  stage_id?: number;
  owner_id?: number;
  status?: number;
  value?: number;
  created_at?: string;
  closed_at?: string;
  lost_reason?: string;
  reference?: string;
  rdstation_reference?: string;
  person_id?: number;
  company_id?: number;
  origin_id?: number;
  origin?: { id?: number; name?: string; origin?: { name?: string } | string };
  stage?: { id?: number; name?: string };
  // Deal deep metadata
  hash?: string;
  description?: string;
  observation?: string;
  deleted?: boolean;
  freezed?: boolean;
  frozen_at?: string;
  probability?: number;
  lead_time?: number;
  value_mrr?: number;
  last_contact?: string;
  stage_changed_at?: string;
  probably_closed_at?: string;
  updated_at?: string;
  involved_users?: unknown[];
  tags?: Array<{ name?: string }>;
  proposals?: unknown[];
  activities?: unknown;
  files?: unknown;
  forms?: unknown;
  action?: unknown;
  order?: number;
  city?: { name?: string };
  person?: {
    name?: string;
    // API list format
    emails?: Array<{ email: string }>;
    phones?: Array<{ phone: string }>;
    // Webhook format
    contact_emails?: Array<{ address?: string }>;
    contact_phones?: Array<{ number?: string }>;
    job_title?: string;
    city?: { name?: string; uf?: string };
    state?: { initials?: string; abbr?: string; name?: string };
    // Deep person fields
    hash?: string;
    cpf?: string;
    gender?: string;
    linkedin?: string;
    facebook?: string;
    observation?: string;
    birth_day?: string;
    website?: string;
    address?: Record<string, unknown>;
    email?: string;
    phone?: string;
    mobile?: string;
    rdstation?: string;
    manager?: Record<string, unknown>;
    data_legal_basis_processing?: unknown;
    data_legal_origin_id?: unknown;
    lgpd_declaration_accepted?: unknown;
    custom_fields?: unknown[];
    company?: Record<string, unknown>;
  };
  company?: {
    id?: number;
    name?: string;
    // API list format
    phones?: Array<{ phone: string }>;
    emails?: Array<{ email: string }>;
    // Webhook format
    contact_phones?: Array<{ number?: string }>;
    contact_emails?: Array<{ address?: string }>;
    segment?: { id?: number; name?: string } | string;
    company_situation?: string;
    situation?: string;
    city?: { name?: string; uf?: string };
    state?: { abbr?: string; name?: string };
    address_street?: string;
    address_number?: string;
    address_complement?: string;
    address_postal_code?: string;
    district?: string;
    // Deep company fields
    hash?: string;
    company_name?: string;
    cnpj?: string;
    ie?: string;
    cnae?: string;
    website?: string;
    facebook?: string;
    linkedin?: string;
    status_touch?: string;
    size?: string;
    country?: string;
    email_nf?: string;
    open_at?: string;
    cnaes?: unknown[];
    address?: Record<string, unknown>;
    custom_fields?: unknown[];
    email?: string;
    phone?: string;
  };
  custom_fields?: Array<{
    custom_field_id: number;
    value?: string | number | null;
  }>;
}

/**
 * Extract custom field value from PipeRun deal
 */
export function getCustomFieldValue(
  customFields: PipeRunDealData["custom_fields"],
  fieldId: number
): string | null {
  if (!customFields) return null;
  const field = customFields.find((f) => f.custom_field_id === fieldId);
  if (!field || field.value === null || field.value === undefined || field.value === "") return null;
  return String(field.value);
}

/**
 * Clean deal title to extract real name
 * Deals often have format "Name - 12345 - Nova Interação" or "Name - timestamp"
 */
export function cleanDealName(title: string | undefined): string | null {
  if (!title) return null;
  // Remove common suffixes: " - 1234567890", " - Nova Interação", " - New Interaction"
  let name = title.split(" - ")[0].trim();
  // If result is empty or just numbers, return null
  if (!name || /^\d+$/.test(name)) return null;
  return name;
}

/**
 * Clean person name by removing trailing timestamps
 * PipeRun often appends " - 2025-12-08 22:56:51.531617-03:00" to person names
 */
export function cleanPersonName(name: string | undefined): string | null {
  if (!name) return null;
  // Remove trailing timestamp pattern: " - YYYY-MM-DD HH:MM:SS..." 
  const cleaned = name.replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}.*$/, "").trim();
  if (!cleaned) return null;
  return cleaned;
}

/**
 * Map PipeRun deal data to lia_attendances fields
 */
export function mapDealToAttendance(deal: PipeRunDealData): Record<string, unknown> {
  const cf = deal.custom_fields;
  const person = deal.person;
  const company = deal.company;

  const fields: Record<string, unknown> = {
    piperun_id: String(deal.id),
    funil_entrada_crm: deal.pipeline_id ? PIPELINE_NAMES[deal.pipeline_id] || String(deal.pipeline_id) : null,
    ultima_etapa_comercial: deal.stage_id ? STAGE_TO_ETAPA[deal.stage_id] || String(deal.stage_id) : null,
    proprietario_lead_crm: deal.owner_id ? PIPERUN_USERS[deal.owner_id]?.name || String(deal.owner_id) : null,
    status_oportunidade: deal.status !== undefined ? DEAL_STATUS_MAP[deal.status] || "aberta" : null,
    valor_oportunidade: deal.value || null,
    data_primeiro_contato: deal.created_at || null,
    data_fechamento_crm: deal.closed_at || null,
    motivo_perda: deal.lost_reason || null,
    piperun_link: `https://app.pipe.run/#/deals/${deal.id}`,
    origem_campanha: deal.origin?.name || (deal.origin_id ? String(deal.origin_id) : null),
    // PipeRun metadata preservation
    piperun_created_at: deal.created_at || null,
    piperun_pipeline_id: deal.pipeline_id || null,
    piperun_pipeline_name: deal.pipeline_id ? PIPELINE_NAMES[deal.pipeline_id] || null : null,
    piperun_stage_id: deal.stage_id || null,
    piperun_stage_name: deal.stage?.name || (deal.stage_id ? STAGE_TO_ETAPA[deal.stage_id] : null) || null,
    piperun_status: deal.status ?? null,
    piperun_owner_id: deal.owner_id || null,
    pessoa_piperun_id: deal.person_id || null,
    empresa_piperun_id: deal.company_id || null,
    piperun_origin_id: deal.origin_id || null,
    piperun_origin_name: deal.origin?.name || null,
    piperun_title: deal.title || null,
    // ─── Deal deep metadata ───
    piperun_hash: deal.hash || null,
    piperun_description: deal.description || null,
    piperun_observation: deal.observation || null,
    piperun_deleted: deal.deleted === true,
    piperun_frozen: deal.freezed === true,
    piperun_frozen_at: deal.frozen_at || null,
    piperun_probability: deal.probability != null ? Number(deal.probability) : null,
    piperun_lead_time: deal.lead_time != null ? Number(deal.lead_time) : null,
    piperun_value_mrr: deal.value_mrr != null ? Number(deal.value_mrr) : null,
    piperun_last_contact_at: deal.last_contact || null,
    piperun_stage_changed_at: deal.stage_changed_at || null,
    piperun_closed_at: deal.closed_at || null,
    piperun_probably_closed_at: deal.probably_closed_at || null,
    piperun_updated_at: deal.updated_at || null,
    piperun_custom_fields: cf || [],
    piperun_tags_raw: deal.tags || null,
    piperun_involved_users: deal.involved_users || null,
    piperun_activities: deal.activities || null,
    piperun_files: deal.files || null,
    piperun_forms: deal.forms || null,
    piperun_action: deal.action || null,
    piperun_deal_order: deal.order != null ? Number(deal.order) : null,
    piperun_deal_city: deal.city?.name || null,
    // Origin sub-name
    piperun_origin_sub_name: (() => {
      const originSub = deal.origin?.origin;
      if (!originSub) return null;
      if (typeof originSub === "object" && (originSub as Record<string, unknown>).name) return String((originSub as Record<string, unknown>).name);
      return String(originSub);
    })(),
    // ─── Raw payload for full audit trail ───
    piperun_raw_payload: deal,
  };

  // ─── Email extraction cascade ───
  const email =
    person?.contact_emails?.[0]?.address ||
    person?.emails?.[0]?.email ||
    person?.email ||
    deal.reference ||
    deal.rdstation_reference ||
    company?.contact_emails?.[0]?.address ||
    company?.emails?.[0]?.email ||
    company?.email ||
    null;
  if (email) fields.email = String(email).trim().toLowerCase();

  // ─── Name extraction cascade ───
  const nome = cleanPersonName(person?.name) || cleanDealName(deal.title) || null;
  if (nome) fields.nome = nome;

  // ─── Phone extraction cascade ───
  const whatsappPhone = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.WHATSAPP);
  const personPhone = person?.contact_phones?.[0]?.number || person?.phones?.[0]?.phone || person?.phone || person?.mobile || null;
  const companyPhone = company?.contact_phones?.[0]?.number || company?.phones?.[0]?.phone || company?.phone || null;
  const phone = whatsappPhone || personPhone || companyPhone || null;
  if (phone) fields.telefone_raw = phone;

  // ─── Person deep fields ───
  if (person) {
    if (person.job_title) fields.area_atuacao = person.job_title;
    if (person.city?.name) fields.cidade = person.city.name;
    const personUf = person.city?.uf || person.state?.initials || person.state?.abbr || null;
    if (personUf) fields.uf = personUf;
    // Identity
    if (person.hash) fields.pessoa_hash = person.hash;
    // Deep person data
    if (person.cpf) fields.pessoa_cpf = person.cpf;
    if (person.job_title) fields.pessoa_cargo = person.job_title;
    if (person.gender) fields.pessoa_genero = person.gender;
    if (person.linkedin) fields.pessoa_linkedin = person.linkedin;
    if (person.facebook) fields.pessoa_facebook = person.facebook;
    if (person.observation) fields.pessoa_observation = person.observation;
    if (person.website) fields.pessoa_website = person.website;
    if (person.birth_day) fields.pessoa_nascimento = person.birth_day;
    if (person.address) fields.pessoa_endereco = person.address;
    if (person.rdstation) fields.pessoa_rdstation = person.rdstation;
    if (person.manager) fields.pessoa_manager = person.manager;
    // LGPD
    const lgpdBasis = person.data_legal_basis_processing;
    const lgpdOrigin = person.data_legal_origin_id;
    const lgpdAccepted = person.lgpd_declaration_accepted;
    if (lgpdBasis || lgpdOrigin || lgpdAccepted) {
      fields.pessoa_lgpd = { basis: lgpdBasis, origin: lgpdOrigin, accepted: lgpdAccepted };
    }
  }

  // ─── Company deep fields ───
  if (company) {
    // Identity
    if (company.hash) fields.empresa_hash = company.hash;
    // Segment: object.name or string
    const seg = company.segment;
    if (seg) {
      fields.empresa_segmento = typeof seg === "object" ? ((seg as Record<string, unknown>).name ? String((seg as Record<string, unknown>).name) : null) : String(seg);
    }
    // Situation: cascade
    const situacao = company.company_situation || company.situation;
    if (situacao) fields.empresa_situacao = String(situacao);
    // City/UF
    if (company.city?.name) fields.empresa_cidade = String(company.city.name);
    const companyUf = company.city?.uf || company.state?.abbr || null;
    if (companyUf) fields.empresa_uf = String(companyUf);
    // Deep company data
    if (company.name) fields.empresa_nome = company.name;
    if (company.company_name) fields.empresa_razao_social = company.company_name;
    if (company.cnpj) fields.empresa_cnpj = company.cnpj;
    if (company.ie) fields.empresa_ie = company.ie;
    if (company.cnae) fields.empresa_cnae = company.cnae;
    if (company.website) fields.empresa_website = company.website;
    if (company.facebook) fields.empresa_facebook = company.facebook;
    if (company.linkedin) fields.empresa_linkedin = company.linkedin;
    if (company.status_touch) fields.empresa_touch_model = company.status_touch;
    if (company.size) fields.empresa_porte = company.size;
    if (company.country) fields.empresa_pais = company.country;
    if (company.email_nf) fields.empresa_email_nf = company.email_nf;
    if (company.open_at) fields.empresa_data_abertura = company.open_at;
    if (company.cnaes) fields.empresa_cnaes = company.cnaes;
    if (company.custom_fields) fields.empresa_custom_fields = company.custom_fields;
    // Company address: merge flat fields + nested object
    const companyAddress = (() => {
      const nested = company.address;
      const flat: Record<string, unknown> = {};
      if (company.address_street) flat.street = company.address_street;
      if (company.address_number) flat.number = company.address_number;
      if (company.address_complement) flat.complement = company.address_complement;
      if (company.address_postal_code) flat.postal_code = company.address_postal_code;
      if (company.district) flat.district = company.district;
      const hasFlat = Object.keys(flat).length > 0;
      if (hasFlat) return { ...(nested || {}), ...flat };
      return nested || null;
    })();
    if (companyAddress) fields.empresa_endereco = companyAddress;
    // Company phone/email
    const cPhone = company.contact_phones?.[0]?.number || company.phones?.[0]?.phone || company.phone || null;
    if (cPhone) fields.empresa_telefone = cPhone;
    const cEmail = company.contact_emails?.[0]?.address || company.emails?.[0]?.email || company.email || null;
    if (cEmail) fields.empresa_email = cEmail;
  }

  // Custom fields
  const especialidade = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.ESPECIALIDADE);
  if (especialidade) fields.especialidade = especialidade;

  const produtoInteresse = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE);
  if (produtoInteresse) fields.produto_interesse = produtoInteresse;

  const temScanner = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.TEM_SCANNER);
  if (temScanner) fields.tem_scanner = temScanner;

  const temImpressora = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.TEM_IMPRESSORA);
  if (temImpressora) fields.tem_impressora = temImpressora;

  const paisOrigem = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.PAIS_ORIGEM);
  if (paisOrigem) fields.pais_origem = paisOrigem;

  const bdId = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.BANCO_DADOS_ID);
  if (bdId) fields.id_cliente_smart = bdId;

  const informacaoDesejada = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.INFORMACAO_DESEJADA);
  if (informacaoDesejada) fields.informacao_desejada = informacaoDesejada;

  const codigoContrato = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.CODIGO_CONTRATO);
  if (codigoContrato) fields.codigo_contrato = codigoContrato;

  const dataTreinamento = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.DATA_TREINAMENTO);
  if (dataTreinamento) fields.data_treinamento = dataTreinamento;

  const produtoInteresseAuto = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE_AUTO);
  if (produtoInteresseAuto) fields.produto_interesse_auto = produtoInteresseAuto;

  // Parse proposal items and auto-populate equipment fields
  const itensProposta = fields.itens_proposta_crm as string | undefined;
  if (itensProposta) {
    const parsed = parseProposalItems(itensProposta);
    fields.itens_proposta_parsed = parsed.parsed;
    const statusOpp = fields.status_oportunidade;
    if (statusOpp === "ganha") {
      if (parsed.equipments.scanner) fields.equip_scanner = parsed.equipments.scanner;
      if (parsed.equipments.impressora) fields.equip_impressora = parsed.equipments.impressora;
      if (parsed.equipments.cad) fields.equip_cad = parsed.equipments.cad;
      if (parsed.equipments.pos_impressao) fields.equip_pos_impressao = parsed.equipments.pos_impressao;
      if (parsed.equipments.notebook) fields.equip_notebook = parsed.equipments.notebook;
      if (parsed.equipments.insumos) fields.insumos_adquiridos = parsed.equipments.insumos;
    }
  }

  // ─── Proposals aggregation (from with[]=proposals) ───
  if (deal.proposals && Array.isArray(deal.proposals) && deal.proposals.length > 0) {
    let totalValue = 0;
    let totalMrr = 0;
    const itemTexts: string[] = [];

    for (const p of deal.proposals) {
      const prop = p as Record<string, unknown>;
      if (prop.value != null) totalValue += Number(prop.value) || 0;
      if (prop.value_mrr != null) totalMrr += Number(prop.value_mrr) || 0;
      const items = prop.items as Array<Record<string, unknown>> | undefined;
      if (items) {
        for (const item of items) {
          const name = item.name || item.description || "";
          const qty = item.quantity || 1;
          if (name) itemTexts.push(`[${qty}] ${name}`);
        }
      }
    }

    fields.proposals_data = deal.proposals;
    if (totalValue > 0) fields.proposals_total_value = totalValue;
    if (totalMrr > 0) fields.proposals_total_mrr = totalMrr;

    if (itemTexts.length && !fields.itens_proposta_crm) {
      const rawText = itemTexts.join(", ");
      fields.itens_proposta_crm = rawText;
      const parsed = parseProposalItems(rawText);
      fields.itens_proposta_parsed = parsed.parsed;
      const statusOpp = fields.status_oportunidade;
      if (statusOpp === "ganha") {
        if (parsed.equipments.scanner) fields.equip_scanner = parsed.equipments.scanner;
        if (parsed.equipments.impressora) fields.equip_impressora = parsed.equipments.impressora;
        if (parsed.equipments.cad) fields.equip_cad = parsed.equipments.cad;
        if (parsed.equipments.pos_impressao) fields.equip_pos_impressao = parsed.equipments.pos_impressao;
        if (parsed.equipments.notebook) fields.equip_notebook = parsed.equipments.notebook;
        if (parsed.equipments.insumos) fields.insumos_adquiridos = parsed.equipments.insumos;
      }
    }
  }

  return fields;
}

// ─── Proposal Items Parser ───

export interface ParsedProposalItem {
  name: string;
  qty: number;
  category: "scanner" | "impressora" | "cad" | "pos_impressao" | "notebook" | "insumos" | "outro";
}

const CATEGORY_KEYWORDS: Array<{ category: ParsedProposalItem["category"]; patterns: RegExp }> = [
  { category: "scanner", patterns: /scanner|medit|i[- ]?[3567]00|i[- ]?700|trios|primescan|aoralscan/i },
  { category: "impressora", patterns: /halot|mars|miicraft|ino\s?\d|prusa|phrozen|impressora|printer|anycubic|elegoo|creality|sonic|ultra\s?\d/i },
  { category: "pos_impressao", patterns: /wash.*cure|mercury|uw\s?\d|cura|pos.?impress|lavadora|polymeriz/i },
  { category: "notebook", patterns: /notebook|avell|laptop/i },
  { category: "cad", patterns: /\bcad\b|smartmake|exocad|3shape|meshmixer|software|licen[cç]/i },
  { category: "insumos", patterns: /resina|kit|glaze|nano|consumiv|insumo|pelicul|fep|vat|parafuso|spray|ipa|alcool/i },
];

function classifyItem(name: string): ParsedProposalItem["category"] {
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.test(name)) return category;
  }
  return "outro";
}

export function parseProposalItems(rawText: string): {
  parsed: ParsedProposalItem[];
  equipments: { scanner: string | null; impressora: string | null; cad: string | null; pos_impressao: string | null; notebook: string | null; insumos: string | null };
} {
  if (!rawText || rawText.trim() === "") {
    return { parsed: [], equipments: { scanner: null, impressora: null, cad: null, pos_impressao: null, notebook: null, insumos: null } };
  }

  // Split by comma or semicolon
  const segments = rawText.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const parsed: ParsedProposalItem[] = [];

  for (const seg of segments) {
    // Try to extract pattern: "PRO XXXX [qty] Name" or just "Name"
    const match = seg.match(/^(?:PRO\s*\d+\s*)?\[?([\d.]+)\]?\s*(.+)$/i);
    if (match) {
      const qty = parseFloat(match[1]) || 1;
      const name = match[2].trim();
      const category = classifyItem(name);
      parsed.push({ name, qty, category });
    } else {
      const name = seg.trim();
      if (name) {
        const category = classifyItem(name);
        parsed.push({ name, qty: 1, category });
      }
    }
  }

  // Group equipment names by category
  const equipments = { scanner: null as string | null, impressora: null as string | null, cad: null as string | null, pos_impressao: null as string | null, notebook: null as string | null, insumos: null as string | null };
  const byCategory: Record<string, string[]> = {};
  for (const item of parsed) {
    if (item.category !== "outro") {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item.name);
    }
  }
  if (byCategory.scanner) equipments.scanner = byCategory.scanner.join(", ");
  if (byCategory.impressora) equipments.impressora = byCategory.impressora.join(", ");
  if (byCategory.cad) equipments.cad = byCategory.cad.join(", ");
  if (byCategory.pos_impressao) equipments.pos_impressao = byCategory.pos_impressao.join(", ");
  if (byCategory.notebook) equipments.notebook = byCategory.notebook.join(", ");
  if (byCategory.insumos) equipments.insumos = byCategory.insumos.join(", ");

  return { parsed, equipments };
}

/**
 * Map lia_attendances fields back to PipeRun custom fields payload
 * Returns array of { custom_field_id, value } for PipeRun API
 */
export function mapAttendanceToDealCustomFields(
  attendance: Record<string, unknown>
): Array<{ custom_field_id: number; value: string }> {
  const fields: Array<{ custom_field_id: number; value: string }> = [];

  if (attendance.especialidade) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.ESPECIALIDADE, value: String(attendance.especialidade) });
  }
  if (attendance.produto_interesse) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE, value: String(attendance.produto_interesse) });
  }
  if (attendance.area_atuacao) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.AREA_ATUACAO, value: String(attendance.area_atuacao) });
  }
  if (attendance.tem_scanner) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.TEM_SCANNER, value: String(attendance.tem_scanner) });
  }
  if (attendance.tem_impressora) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.TEM_IMPRESSORA, value: String(attendance.tem_impressora) });
  }
  if (attendance.pais_origem) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.PAIS_ORIGEM, value: String(attendance.pais_origem) });
  }
  if (attendance.id_cliente_smart) {
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.BANCO_DADOS_ID, value: String(attendance.id_cliente_smart) });
  }

  return fields;
}

/**
 * Convert custom fields array to hash-keyed flat object for PUT /deals
 * PipeRun PUT requires { "hash_key": "value" } format, not array
 */
export function customFieldsToHashMap(
  fields: Array<{ custom_field_id: number; value: string }>
): Record<string, string> {
  const hashMap: Record<string, string> = {};
  for (const f of fields) {
    const hash = DEAL_CUSTOM_FIELD_HASHES[f.custom_field_id];
    if (hash) {
      hashMap[hash] = f.value;
    }
  }
  return hashMap;
}

// ─── PipeRun API helpers ───

export async function piperunGet(
  apiToken: string,
  path: string,
  params?: Record<string, string | number>,
  arrayParams?: Record<string, string[]>
): Promise<{ success: boolean; data: unknown; status: number }> {
  let url = `${PIPERUN_API_BASE}/${path.replace(/^\/+/, "")}`;
  const searchParams = new URLSearchParams({ token: apiToken });
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      searchParams.set(k, String(v));
    }
  }
  // Support array params like with[]=person&with[]=origin
  let extraParams = "";
  if (arrayParams) {
    for (const [k, values] of Object.entries(arrayParams)) {
      for (const v of values) {
        extraParams += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      }
    }
  }
  url += (url.includes("?") ? "&" : "?") + searchParams.toString() + extraParams;

  try {
    const res = await fetch(url);
    const json = await res.json();
    return { success: res.ok, data: json, status: res.status };
  } catch (err) {
    return { success: false, data: String(err), status: 0 };
  }
}

export async function piperunPost(
  apiToken: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ success: boolean; data: unknown; status: number }> {
  const url = `${PIPERUN_API_BASE}/${path.replace(/^\/+/, "")}?token=${apiToken}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { success: res.ok, data: json, status: res.status };
  } catch (err) {
    return { success: false, data: String(err), status: 0 };
  }
}

export async function piperunPut(
  apiToken: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ success: boolean; data: unknown; status: number }> {
  const url = `${PIPERUN_API_BASE}/${path.replace(/^\/+/, "")}?token=${apiToken}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { success: res.ok, data: json, status: res.status };
  } catch (err) {
    return { success: false, data: String(err), status: 0 };
  }
}

/**
 * Add a note to a PipeRun deal (for L.I.A. cognitive analysis injection)
 */
export async function addDealNote(
  apiToken: string,
  dealId: number,
  note: string
): Promise<{ success: boolean; data: unknown }> {
  return piperunPost(apiToken, "notes", {
    deal_id: dealId,
    text: note,
  });
}

/**
 * Fetch notes from a PipeRun deal (for longitudinal memory enrichment)
 */
export async function fetchDealNotes(
  apiToken: string,
  dealId: number,
  limit = 5
): Promise<Array<{ text: string; created_at: string }>> {
  try {
    const result = await piperunGet(apiToken, "notes", {
      deal_id: String(dealId),
      show: String(limit),
    });
    if (!result.success || !result.data) return [];
    const items = (result.data as { data?: Array<{ text?: string; created_at?: string }> })?.data;
    if (!Array.isArray(items)) return [];
    return items
      .filter((n) => n.text && n.text.trim())
      .slice(0, limit)
      .map((n) => ({
        text: (n.text || "").slice(0, 200),
        created_at: n.created_at || "",
      }));
  } catch {
    return [];
  }
}

/**
 * Move a deal to a different stage (for L.I.A. stagnation management)
 */
export async function moveDealToStage(
  apiToken: string,
  dealId: number,
  stageId: number
): Promise<{ success: boolean; data: unknown }> {
  return piperunPut(apiToken, `deals/${dealId}`, {
    stage_id: stageId,
  });
}

/**
 * Centralized PipeRun field mapping
 * All IDs, stages, pipelines, custom fields, and users mapped from PipeRun API
 * Used across all smart-ops edge functions for bidirectional sync
 */

// ─── API Configuration ───

export const PIPERUN_API_BASE = "https://api.pipe.run/v1";

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
  person?: {
    name?: string;
    emails?: Array<{ email: string }>;
    phones?: Array<{ phone: string }>;
    job_title?: string;
    city?: { name?: string };
    state?: { initials?: string };
  };
  company?: {
    name?: string;
    phones?: Array<{ phone: string }>;
    emails?: Array<{ email: string }>;
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
  };

  // ─── Email extraction cascade ───
  // 1. person.emails (webhook format)
  // 2. deal.reference (API list format - most common)
  // 3. deal.rdstation_reference (RD Station fallback)
  // 4. company.emails (organization fallback)
  const email =
    person?.emails?.[0]?.email ||
    deal.reference ||
    deal.rdstation_reference ||
    company?.emails?.[0]?.email ||
    null;
  if (email) fields.email = String(email).trim().toLowerCase();

  // ─── Name extraction cascade ───
  // 1. person.name (webhook/with[]=person)
  // 2. deal.title cleaned (API list format - remove " - timestamp" suffixes)
  const nome = person?.name || cleanDealName(deal.title) || null;
  if (nome) fields.nome = nome;

  // ─── Phone extraction cascade ───
  // 1. person.phones (webhook format)
  // 2. company.phones (organization)
  // 3. Custom field WHATSAPP (549150)
  const phone =
    person?.phones?.[0]?.phone ||
    company?.phones?.[0]?.phone ||
    null;
  if (phone) fields.telefone_raw = phone;

  // Person extra data
  if (person) {
    if (person.job_title) fields.area_atuacao = person.job_title;
    if (person.city?.name) fields.cidade = person.city.name;
    if (person.state?.initials) fields.uf = person.state.initials;
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

  // WhatsApp custom field as phone fallback
  const whatsapp = getCustomFieldValue(cf, DEAL_CUSTOM_FIELDS.WHATSAPP);
  if (whatsapp && !fields.telefone_raw) fields.telefone_raw = whatsapp;

  return fields;
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

// ─── PipeRun API helpers ───

export async function piperunGet(
  apiToken: string,
  path: string,
  params?: Record<string, string | number>
): Promise<{ success: boolean; data: unknown; status: number }> {
  let url = `${PIPERUN_API_BASE}/${path.replace(/^\/+/, "")}`;
  const searchParams = new URLSearchParams({ token: apiToken });
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      searchParams.set(k, String(v));
    }
  }
  url += (url.includes("?") ? "&" : "?") + searchParams.toString();

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

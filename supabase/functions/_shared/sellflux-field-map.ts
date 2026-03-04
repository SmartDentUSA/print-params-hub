/**
 * Centralized SellFlux + TAG management utilities
 * Used across all smart-ops edge functions
 */

// ─── TAG Constants ───

export const TAG_PREFIXES = {
  JOURNEY: "J",
  ECOMMERCE: "EC_",
  QUALIFICATION: "Q_",
  COMMERCIAL: "C_",
  CS: "CS_",
  LIA: "LIA_",
  ALERT: "A_",
} as const;

export const LIA_TAGS = {
  LIA_LEAD_NOVO: "LIA_LEAD_NOVO",
  LIA_LEAD_REATIVADO: "LIA_LEAD_REATIVADO",
  LIA_LEAD_ATIVADO: "LIA_LEAD_ATIVADO",
  LIA_ATENDEU: "LIA_ATENDEU",
} as const;

export const ALL_LIA_CLASSIFICATION_TAGS = [
  LIA_TAGS.LIA_LEAD_NOVO,
  LIA_TAGS.LIA_LEAD_REATIVADO,
  LIA_TAGS.LIA_LEAD_ATIVADO,
] as const;

export const JOURNEY_TAGS = {
  J01_CONSCIENCIA: "J01_CONSCIENCIA",
  J02_CONSIDERACAO: "J02_CONSIDERACAO",
  J03_NEGOCIACAO: "J03_NEGOCIACAO",
  J04_COMPRA: "J04_COMPRA",
  J05_RETENCAO: "J05_RETENCAO",
  J06_APOIO: "J06_APOIO",
} as const;

export const ALL_JOURNEY_TAGS = Object.values(JOURNEY_TAGS);

export const ECOMMERCE_TAGS = {
  EC_VISITOU_LOJA: "EC_VISITOU_LOJA",
  EC_ADICIONOU_CARRINHO: "EC_ADICIONOU_CARRINHO",
  EC_ABANDONOU_CARRINHO: "EC_ABANDONOU_CARRINHO",
  EC_INICIOU_CHECKOUT: "EC_INICIOU_CHECKOUT",
  EC_GEROU_BOLETO: "EC_GEROU_BOLETO",
  EC_BOLETO_VENCIDO: "EC_BOLETO_VENCIDO",
  EC_PAGAMENTO_APROVADO: "EC_PAGAMENTO_APROVADO",
  EC_PEDIDO_CANCELADO: "EC_PEDIDO_CANCELADO",
  EC_PEDIDO_ENVIADO: "EC_PEDIDO_ENVIADO",
  EC_PEDIDO_ENTREGUE: "EC_PEDIDO_ENTREGUE",
  EC_PROD_RESINA: "EC_PROD_RESINA",
  EC_PROD_INSUMO: "EC_PROD_INSUMO",
  EC_PROD_KIT_CARAC: "EC_PROD_KIT_CARAC",
  EC_PROD_SMARTMAKE: "EC_PROD_SMARTMAKE",
} as const;

export const STAGNATION_TAGS = {
  A_ESTAGNADO_3D: "A_ESTAGNADO_3D",
  A_ESTAGNADO_7D: "A_ESTAGNADO_7D",
  A_ESTAGNADO_15D: "A_ESTAGNADO_15D",
  A_SEM_RESPOSTA: "A_SEM_RESPOSTA",
  A_RISCO_CHURN: "A_RISCO_CHURN",
} as const;

export const ALL_STAGNATION_TAGS = Object.values(STAGNATION_TAGS);

// ─── Stage → Journey TAG mapping ───

export const JOURNEY_STAGE_MAP: Record<string, { add: string[]; remove: string[] }> = {
  novo: { add: [JOURNEY_TAGS.J01_CONSCIENCIA], remove: [] },
  sem_contato: { add: [JOURNEY_TAGS.J01_CONSCIENCIA], remove: [] },
  contato_feito: { add: [JOURNEY_TAGS.J02_CONSIDERACAO, "C_PRIMEIRO_CONTATO"], remove: [JOURNEY_TAGS.J01_CONSCIENCIA] },
  em_contato: { add: [JOURNEY_TAGS.J02_CONSIDERACAO], remove: [JOURNEY_TAGS.J01_CONSCIENCIA] },
  apresentacao: { add: [JOURNEY_TAGS.J02_CONSIDERACAO], remove: [JOURNEY_TAGS.J01_CONSCIENCIA] },
  proposta_enviada: { add: [JOURNEY_TAGS.J03_NEGOCIACAO, "C_PROPOSTA_ENVIADA"], remove: [JOURNEY_TAGS.J02_CONSIDERACAO] },
  negociacao: { add: [JOURNEY_TAGS.J03_NEGOCIACAO, "C_NEGOCIACAO_ATIVA"], remove: [JOURNEY_TAGS.J02_CONSIDERACAO] },
  fechamento: { add: [JOURNEY_TAGS.J04_COMPRA, "C_CONTRATO_FECHADO"], remove: [JOURNEY_TAGS.J03_NEGOCIACAO] },
};

// ─── Stagnation stage → TAG mapping ───

export const STAGNATION_STAGE_TAG_MAP: Record<string, string> = {
  est_etapa1: STAGNATION_TAGS.A_ESTAGNADO_3D,
  est_etapa2: STAGNATION_TAGS.A_ESTAGNADO_3D,
  est_etapa3: STAGNATION_TAGS.A_ESTAGNADO_7D,
  est_etapa4: STAGNATION_TAGS.A_ESTAGNADO_7D,
  est_apresentacao: STAGNATION_TAGS.A_ESTAGNADO_15D,
  est_proposta: STAGNATION_TAGS.A_ESTAGNADO_15D,
  estagnado_final: STAGNATION_TAGS.A_ESTAGNADO_15D,
};

// ─── Legacy TAG migration map (SellFlux organic → standardized) ───

export const LEGACY_TAG_MAP: Record<string, string[]> = {
  "compra-realizada": ["EC_PAGAMENTO_APROVADO", "J04_COMPRA"],
  "pedido-pago": ["EC_PAGAMENTO_APROVADO"],
  "cancelado": ["EC_PEDIDO_CANCELADO"],
  "pedido-cancelado": ["EC_PEDIDO_CANCELADO"],
  "aguardando-pagamento": ["EC_INICIOU_CHECKOUT"],
  "aguardando-pagamento-boleto": ["EC_GEROU_BOLETO"],
  "gerou-boleto": ["EC_GEROU_BOLETO"],
  "gerouboleto": ["EC_GEROU_BOLETO"],
  "iniciou-pagamento-cartao": ["EC_INICIOU_CHECKOUT"],
  "cancelado-cartao-credito": ["EC_PEDIDO_CANCELADO"],
  "cancelado-boleto": ["EC_BOLETO_VENCIDO"],
  "bought-resin-auto": ["EC_PROD_RESINA"],
  "resina-comprado": ["EC_PROD_RESINA"],
  "ios-comprado": ["Q_TEM_SCANNER"],
  "smartmakegum-comprado": ["EC_PROD_SMARTMAKE"],
  "cliente-smart": ["J05_RETENCAO"],
  "plataforma-confirmada": ["CS_ONBOARDING_INICIO"],
  "cursos-onboarding": ["CS_ONBOARDING_INICIO"],
  "cursos-lives": ["CS_TREINAMENTO_OK"],
  "cursos-caracterizacao": ["CS_TREINAMENTO_OK"],
  "cursos-kit-imp": ["CS_TREINAMENTO_OK"],
  "bot-treinamento": ["CS_TREINAMENTO_PENDENTE"],
  "chatbot-client-enviado": ["LIA_ATENDEU"],
  "ativo-sac": ["LIA_ATENDEU"],
};

// Pattern-based legacy tag mappings (for tags with vendor suffixes like "estagnados-paulo")
export const LEGACY_TAG_PATTERNS: Array<{ pattern: RegExp; tags: string[]; extract?: Record<string, string> }> = [
  { pattern: /^estagnados?-/i, tags: ["A_ESTAGNADO_7D"] },
  { pattern: /^\w+-7stagnant$/i, tags: ["A_ESTAGNADO_7D"] },
  { pattern: /^\w+-15stagnant$/i, tags: ["A_ESTAGNADO_15D"] },
  { pattern: /^lead-/i, tags: [] }, // vendor attribution — skip
  { pattern: /^\w+-ios-enviado$/i, tags: [] },
  { pattern: /^\w+-blz-intra-enviado$/i, tags: [] },
  { pattern: /^produto-\d+$/i, tags: ["EC_PROD_INSUMO"] },
  { pattern: /^compra-realizada-\d+$/i, tags: ["EC_PAGAMENTO_APROVADO"] },
  { pattern: /^cancelado-?\d+$/i, tags: ["EC_PEDIDO_CANCELADO"] },
  { pattern: /^canceladoboleto\d+$/i, tags: ["EC_BOLETO_VENCIDO"] },
  { pattern: /^aguardando-pagamento-\d+$/i, tags: ["EC_INICIOU_CHECKOUT"] },
  { pattern: /^webhook-/i, tags: [] },
  { pattern: /^godi-reativa-enviado$/i, tags: ["A_ESTAGNADO_7D"] },
];

// ─── Tag field extraction from legacy tags ───

export const LEGACY_TAG_FIELD_MAP: Record<string, Record<string, string>> = {
  "clinica-consul": { area_atuacao: "Clínica" },
  "labproteses": { area_atuacao: "Laboratório" },
  "outras-areas": { area_atuacao: "Outras" },
  "professor": { area_atuacao: "Professor" },
  "sem-imp": { tem_impressora: "não" },
  "sem-scanner": { tem_scanner: "não" },
};

// Pattern-based field extraction
export const LEGACY_TAG_FIELD_PATTERNS: Array<{ pattern: RegExp; fields: Record<string, string> }> = [
  { pattern: /^imp-(.+)$/i, fields: { tem_impressora: "sim" } },
  { pattern: /^scanner-(.+)$/i, fields: { tem_scanner: "sim" } },
];

// ─── Utility functions ───

export function replaceVariables(text: string, lead: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = lead[key];
    return val ? String(val) : `{{${key}}}`;
  });
}

export function mergeTagsCrm(
  currentTags: string[] | null,
  toAdd: string[],
  toRemove: string[] = []
): string[] {
  const set = new Set(currentTags || []);
  for (const tag of toRemove) set.delete(tag);
  for (const tag of toAdd) set.add(tag);
  return [...set].sort();
}

export function computeTagsFromStage(
  newStatus: string,
  currentTags: string[] | null
): { tags: string[]; add: string[]; remove: string[] } {
  const mapping = JOURNEY_STAGE_MAP[newStatus];
  if (!mapping) return { tags: currentTags || [], add: [], remove: [] };
  const merged = mergeTagsCrm(currentTags, mapping.add, mapping.remove);
  return { tags: merged, add: mapping.add, remove: mapping.remove };
}

export function computeStagnationTag(stagnationStage: string): string | null {
  return STAGNATION_STAGE_TAG_MAP[stagnationStage] || null;
}

/**
 * Migrate legacy SellFlux tags to standardized tags + extract field values
 */
export function migrateLegacyTags(legacyTags: string[]): {
  standardizedTags: string[];
  extractedFields: Record<string, string>;
  unmappedTags: string[];
} {
  const standardized = new Set<string>();
  const fields: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const tag of legacyTags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;

    // Direct mapping
    if (LEGACY_TAG_MAP[normalized]) {
      for (const t of LEGACY_TAG_MAP[normalized]) standardized.add(t);
      continue;
    }

    // Field extraction
    if (LEGACY_TAG_FIELD_MAP[normalized]) {
      Object.assign(fields, LEGACY_TAG_FIELD_MAP[normalized]);
      continue;
    }

    // Pattern matching for tags
    let matched = false;
    for (const { pattern, tags } of LEGACY_TAG_PATTERNS) {
      if (pattern.test(tag)) {
        for (const t of tags) standardized.add(t);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Pattern matching for fields
    for (const { pattern, fields: f } of LEGACY_TAG_FIELD_PATTERNS) {
      if (pattern.test(tag)) {
        Object.assign(fields, f);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // If tag already looks standardized (has a known prefix), keep it
    if (tag.startsWith("J0") || tag.startsWith("EC_") || tag.startsWith("Q_") ||
        tag.startsWith("C_") || tag.startsWith("CS_") || tag.startsWith("LIA_") ||
        tag.startsWith("A_")) {
      standardized.add(tag);
      continue;
    }

    unmapped.push(tag);
  }

  return {
    standardizedTags: [...standardized].sort(),
    extractedFields: fields,
    unmappedTags: unmapped,
  };
}

// ─── Phone formatting for WaLeads API ───

/**
 * Format phone number for WaLeads API: digits only, with country code 55 for BR numbers.
 * WaLeads rejects numbers with "+" prefix — always return digits only.
 */
export function formatPhoneForWaLeads(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // If 10-11 digits (BR without country code), prepend 55
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith("55")) {
    return "55" + digits;
  }
  return digits;
}

// ─── Phone normalization helpers ───

export function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

export function matchPhoneLoose(a: string, b: string): boolean {
  const na = normalizePhoneForMatch(a);
  const nb = normalizePhoneForMatch(b);
  return na.length >= 8 && nb.length >= 8 && (na.endsWith(nb) || nb.endsWith(na));
}

// ─── SellFlux Webhook helpers ───

/**
 * Build lead fields for SellFlux webhook query params (V1 - Leads)
 */
export function buildSellFluxLeadParams(lead: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  const set = (key: string, val: unknown) => {
    if (val !== null && val !== undefined && val !== "") params[key] = String(val);
  };
  set("email", lead.email);
  set("nome", lead.nome);
  set("phone", lead.telefone_normalized);
  set("area_atuacao", lead.area_atuacao);
  set("especialidade", lead.especialidade);
  set("produto_interesse", lead.produto_interesse);
  set("impressora", lead.impressora_modelo);
  set("scanner", lead.tem_scanner);
  set("resina", lead.resina_interesse);
  set("cidade", lead.cidade);
  set("uf", lead.uf);
  set("source", lead.source);
  set("score", lead.score);
  set("status_lead", lead.lead_status);
  set("proprietario", lead.proprietario_lead_crm);
  set("piperun_id", lead.piperun_id);
  set("software_cad", lead.software_cad);
  set("volume_pecas", lead.volume_mensal_pecas);
  set("aplicacao", lead.principal_aplicacao);
  return params;
}

/**
 * Send lead to SellFlux via V1 webhook (GET with query params)
 * Used to sync/create contacts in SellFlux
 */
export async function sendLeadToSellFlux(
  webhookUrl: string,
  lead: Record<string, unknown>
): Promise<{ success: boolean; status: number; response: string }> {
  try {
    const url = new URL(webhookUrl);
    const params = buildSellFluxLeadParams(lead);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    console.log(`[sellflux] Lead webhook response: status=${res.status} body=${text.slice(0, 300)}`);
    return { success: res.ok, status: res.status, response: text.slice(0, 500) };
  } catch (err) {
    return { success: false, status: 0, response: String(err) };
  }
}

/**
 * Build campaign payload for SellFlux V2 webhook (POST with JSON)
 */
export function buildSellFluxCampaignPayload(
  lead: Record<string, unknown>,
  templateId?: string
): Record<string, unknown> {
  return {
    email: lead.email || null,
    phone: lead.telefone_normalized || null,
    nome: lead.nome || null,
    ...(templateId ? { template_id: templateId } : {}),
    area_atuacao: lead.area_atuacao || "",
    especialidade: lead.especialidade || "",
    produto_interesse: lead.produto_interesse || "",
    impressora: lead.impressora_modelo || "",
    scanner: lead.tem_scanner || "",
    resina: lead.resina_interesse || "",
    cidade: lead.cidade || "",
    uf: lead.uf || "",
    score: String(lead.score || 0),
    status_lead: lead.lead_status || "",
    proprietario: lead.proprietario_lead_crm || "",
    etapa_comercial: lead.ultima_etapa_comercial || "",
    tags: (lead.tags_crm as string[]) || [],
  };
}

/**
 * Send campaign/automation trigger to SellFlux via V2 webhook (POST with JSON)
 */
export async function sendCampaignViaSellFlux(
  webhookUrl: string,
  lead: Record<string, unknown>,
  templateId?: string
): Promise<{ success: boolean; status: number; response: string }> {
  const payload = buildSellFluxCampaignPayload(lead, templateId);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[sellflux] Campaign webhook response: status=${res.status} body=${text.slice(0, 300)}`);
    return { success: res.ok, status: res.status, response: text.slice(0, 500) };
  } catch (err) {
    return { success: false, status: 0, response: String(err) };
  }
}

// Legacy alias for backward compatibility
export const sendViaSellFlux = sendCampaignViaSellFlux;
export const buildSellFluxPayload = buildSellFluxCampaignPayload;

// ─── SellFlux Lead API (GET) ───

/**
 * Fetch lead data from SellFlux via GET API.
 * Uses SELLFLUX_WEBHOOK_LEADS secret as base URL.
 * Returns parsed JSON with lead tags and fields, or null on failure.
 */
export async function fetchLeadFromSellFlux(
  email: string
): Promise<{ tags: string[]; fields: Record<string, unknown>; raw: unknown } | null> {
  const baseUrl = Deno.env.get("SELLFLUX_WEBHOOK_LEADS");
  if (!baseUrl) {
    console.warn("[sellflux] SELLFLUX_WEBHOOK_LEADS secret not set");
    return null;
  }
  try {
    const url = `${baseUrl}?email=${encodeURIComponent(email.toLowerCase())}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.log(`[sellflux] Lead API returned ${res.status} for ${email}`);
      return null;
    }
    const data = await res.json();
    console.log(`[sellflux] Lead API response for ${email}:`, JSON.stringify(data).slice(0, 500));

    // Extract tags — SellFlux may return tags as array or comma-separated string
    let rawTags: string[] = [];
    if (Array.isArray(data.tags)) {
      rawTags = data.tags;
    } else if (typeof data.tags === "string" && data.tags) {
      rawTags = data.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
    }

    // Extract known fields
    const fields: Record<string, unknown> = {};
    if (data.name || data.nome) fields.nome = data.name || data.nome;
    if (data.phone || data.telefone) fields.telefone = data.phone || data.telefone;
    if (data.city || data.cidade) fields.cidade = data.city || data.cidade;
    if (data.state || data.uf) fields.uf = data.state || data.uf;

    return { tags: rawTags, fields, raw: data };
  } catch (err) {
    console.error("[sellflux] Lead API fetch error:", err);
    return null;
  }
}

// ─── E-commerce product name → TAG mapping ───

export function detectProductTags(productName: string): string[] {
  const name = productName.toLowerCase();
  const tags: string[] = [];
  if (name.includes("resina") || name.includes("resin") || name.includes("bio bite") || name.includes("vitality")) {
    tags.push(ECOMMERCE_TAGS.EC_PROD_RESINA);
  }
  if (name.includes("smartmake") || name.includes("smart make")) {
    tags.push(ECOMMERCE_TAGS.EC_PROD_SMARTMAKE);
  }
  if (name.includes("kit") && (name.includes("carac") || name.includes("acabamento"))) {
    tags.push(ECOMMERCE_TAGS.EC_PROD_KIT_CARAC);
  }
  if (tags.length === 0) tags.push(ECOMMERCE_TAGS.EC_PROD_INSUMO);
  return tags;
}

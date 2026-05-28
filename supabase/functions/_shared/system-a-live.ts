/**
 * Sistema A — Live Product API client.
 *
 * Fetches authoritative product data from
 *   GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id=<external_id>
 * with in-memory cache (10 min) and soft-fail (returns null on error).
 *
 * The live API exposes richer fields than our local `system_a_catalog`
 * mirror — notably: features, applications, document_transcriptions,
 * workflow_stages, competitor_comparison, forbidden_products,
 * required_products, anti_hallucination_rules, bot_trigger_words,
 * market_keywords, search_intent_keywords, target_audience.
 *
 * Used by:
 *  - product-rag.ts → fetchEnrichedProductDossier (merges into ProductDossier)
 *  - workflow-diagnosis.ts → resolveIntent (token boost) + SPIN prompt enrichment
 *  - smart-ops-refresh-system-a-cache → persists snapshot in system_a_catalog.extra_data.system_a_live
 */

const SYSTEM_A_BASE = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

const CACHE = new Map<string, { exp: number; value: LiveProductDossier | null }>();

export interface LiveProductDossier {
  id: string;                 // Sistema A product id (== system_a_catalog.external_id)
  name: string;
  applications: string;       // 1-line clinical application
  benefits: string[];         // up to 8
  features: string[];         // up to 10
  technical_specs: Array<{ label: string; value: string }>;
  document_extracts: Array<{
    filename: string;
    summary: string;
    key_specs: string[];      // compatible resins, cure devices, etc.
  }>;
  workflow_stages: Record<string, {
    role: string | null;
    applicable: boolean;
    description: string | null;
    related_materials: string[];
    pain_points_addressed: string[];
    competitive_advantages: string[];
  }>;
  competitor_comparison?: {
    title: string;
    table_headers: string[];
    table_data: unknown[][];
  };
  forbidden_products: string[];
  required_products: string[];
  anti_hallucination: {
    never_claim: string[];
    always_explain: string[];
    always_require: string[];
    never_mix_with: string[];
    never_use_in_stages: string[];
  };
  target_audience: string[];
  market_keywords: string[];
  bot_trigger_words: string[];
  search_intent_keywords: string[];
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

function asStrArr(v: unknown, max = 50): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter(Boolean)
    .slice(0, max);
}

function asSpecArr(v: unknown, max = 12): Array<{ label: string; value: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = String(obj.label ?? obj.key ?? "").trim();
    const value = String(obj.value ?? "").trim();
    if (label && value) out.push({ label, value: truncate(value, 280) });
    if (out.length >= max) break;
  }
  return out;
}

/** Pull a compact "extract" from each PDF/Ebook transcription (Gemini-extracted). */
function asDocumentExtracts(
  v: unknown,
): LiveProductDossier["document_extracts"] {
  if (!Array.isArray(v)) return [];
  const out: LiveProductDossier["document_extracts"] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const doc = raw as Record<string, unknown>;
    const ed = (doc.extracted_data ?? {}) as Record<string, unknown>;
    const filename = String(doc.filename ?? "").trim();
    if (!filename) continue;

    const specsBag: string[] = [];
    const bagOfStrings = (val: unknown) => {
      if (Array.isArray(val)) {
        for (const x of val) {
          const s = typeof x === "string" ? x : String(x ?? "");
          if (s.trim()) specsBag.push(truncate(s.trim(), 200));
        }
      } else if (typeof val === "string" && val.trim()) {
        specsBag.push(truncate(val.trim(), 200));
      }
    };
    bagOfStrings(ed.compatible_materials);
    bagOfStrings(ed.compatible_resins);
    bagOfStrings(ed.cure_devices);
    bagOfStrings(ed.cure_protocols);
    bagOfStrings(ed.indications);
    bagOfStrings(ed.contraindications);
    bagOfStrings(ed.technical_specs);
    bagOfStrings(ed.usage_instructions);

    const summaryParts: string[] = [];
    for (const k of ["summary", "description", "overview", "what_is"]) {
      const s = ed[k];
      if (typeof s === "string" && s.trim()) summaryParts.push(s.trim());
    }
    const benefits = ed.benefits;
    if (Array.isArray(benefits) && benefits.length) {
      summaryParts.push(`Benefícios: ${benefits.slice(0, 3).map(String).join("; ")}`);
    }
    const summary = truncate(summaryParts.join(" • ").trim(), 500);

    out.push({
      filename,
      summary,
      key_specs: Array.from(new Set(specsBag)).slice(0, 10),
    });
    if (out.length >= 3) break;
  }
  return out;
}

function asAntiHall(v: unknown): LiveProductDossier["anti_hallucination"] {
  const empty = {
    never_claim: [], always_explain: [], always_require: [],
    never_mix_with: [], never_use_in_stages: [],
  };
  if (!v || typeof v !== "object") return empty;
  const obj = v as Record<string, unknown>;
  return {
    never_claim: asStrArr(obj.never_claim, 8),
    always_explain: asStrArr(obj.always_explain, 8),
    always_require: asStrArr(obj.always_require, 8),
    never_mix_with: asStrArr(obj.never_mix_with, 8),
    never_use_in_stages: asStrArr(obj.never_use_in_stages, 8),
  };
}

function asWorkflowStages(v: unknown): LiveProductDossier["workflow_stages"] {
  if (!v || typeof v !== "object") return {};
  const out: LiveProductDossier["workflow_stages"] = {};
  for (const [stage, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    out[stage] = {
      role: typeof r.role === "string" ? r.role : null,
      applicable: Boolean(r.applicable),
      description: typeof r.description === "string" ? r.description : null,
      related_materials: asStrArr(r.related_materials, 8),
      pain_points_addressed: asStrArr(r.pain_points_addressed, 8),
      competitive_advantages: asStrArr(r.competitive_advantages, 8),
    };
  }
  return out;
}

function asCompetitorTable(v: unknown): LiveProductDossier["competitor_comparison"] {
  if (!v || typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;
  if (!obj.enabled) return undefined;
  const headers = asStrArr(obj.table_headers, 12);
  const rows = Array.isArray(obj.table_data) ? (obj.table_data as unknown[][]).slice(0, 8) : [];
  if (!headers.length || !rows.length) return undefined;
  return {
    title: String(obj.title ?? "").trim(),
    table_headers: headers,
    table_data: rows,
  };
}

/** Normalize the raw Sistema A `get-product-data` payload. */
export function mapSystemAToLiveDossier(raw: unknown): LiveProductDossier | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = String(d.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    name: String(d.name ?? "").trim(),
    applications: truncate(String(d.applications ?? "").trim(), 400),
    benefits: asStrArr(d.benefits, 8),
    features: asStrArr(d.features, 10),
    technical_specs: asSpecArr(d.technical_specifications),
    document_extracts: asDocumentExtracts(d.document_transcriptions),
    workflow_stages: asWorkflowStages(d.workflow_stages),
    competitor_comparison: asCompetitorTable(d.competitor_comparison),
    forbidden_products: asStrArr(d.forbidden_products, 8),
    required_products: asStrArr(d.required_products, 8),
    anti_hallucination: asAntiHall(d.anti_hallucination_rules),
    target_audience: asStrArr(d.target_audience, 6),
    market_keywords: asStrArr(d.market_keywords, 16),
    bot_trigger_words: asStrArr(d.bot_trigger_words, 16),
    search_intent_keywords: asStrArr(d.search_intent_keywords, 16),
  };
}

export interface FetchSystemAOptions {
  force?: boolean;            // bypass cache
  timeoutMs?: number;
}

/** Fetch + map a Sistema A product. Soft-fails (returns null on any error). */
export async function fetchSystemAProduct(
  externalId: string | null | undefined,
  opts: FetchSystemAOptions = {},
): Promise<LiveProductDossier | null> {
  const id = String(externalId ?? "").trim();
  if (!id) return null;
  if (!opts.force) {
    const hit = CACHE.get(id);
    if (hit && hit.exp > Date.now()) return hit.value;
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const url = `${SYSTEM_A_BASE}/get-product-data?product_id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      CACHE.set(id, { exp: Date.now() + CACHE_TTL_MS, value: null });
      return null;
    }
    const json = await res.json();
    if (!json?.success || !json?.data) {
      CACHE.set(id, { exp: Date.now() + CACHE_TTL_MS, value: null });
      return null;
    }
    const mapped = mapSystemAToLiveDossier(json.data);
    CACHE.set(id, { exp: Date.now() + CACHE_TTL_MS, value: mapped });
    return mapped;
  } catch (e) {
    console.warn("[system-a-live] fetch failed for", id, e instanceof Error ? e.message : e);
    CACHE.set(id, { exp: Date.now() + 60_000, value: null }); // short negative cache
    return null;
  } finally {
    clearTimeout(to);
  }
}

/** Render a compact prompt block from a LiveProductDossier (for Gemini SPIN). */
export function renderLiveDossierForPrompt(d: LiveProductDossier | null): string {
  if (!d) return "";
  const out: string[] = [`### CONTEXTO DO PRODUTO (Sistema A live): ${d.name}`];
  if (d.applications) out.push(`Aplicação clínica: ${d.applications}`);
  if (d.target_audience.length) out.push(`Persona-alvo: ${d.target_audience.join("; ")}`);
  if (d.features.length) out.push(`Features: ${d.features.slice(0, 8).join("; ")}`);
  if (d.benefits.length) out.push(`Benefícios: ${d.benefits.slice(0, 6).join("; ")}`);
  if (d.technical_specs.length) {
    out.push(`Specs técnicas: ${d.technical_specs.slice(0, 6).map(s => `${s.label}=${s.value}`).join(" | ")}`);
  }
  if (d.document_extracts.length) {
    const docs = d.document_extracts.slice(0, 2).map(e => {
      const specs = e.key_specs.length ? ` [requisitos: ${e.key_specs.slice(0, 5).join("; ")}]` : "";
      return `${e.filename}: ${e.summary || "(sem resumo)"}${specs}`;
    });
    out.push(`Documentos oficiais: ${docs.join(" || ")}`);
  }
  const ws = Object.entries(d.workflow_stages).filter(([, s]) => s.applicable && (s.role || s.description));
  if (ws.length) {
    out.push(
      `Papel no fluxo 7×3: ` +
        ws.slice(0, 4).map(([stg, s]) => {
          const pains = s.pain_points_addressed.slice(0, 2).join(", ");
          return `${stg}=${s.role || s.description || ""}${pains ? ` (resolve: ${pains})` : ""}`;
        }).join(" | "),
    );
  }
  if (d.competitor_comparison) {
    out.push(`Comparativo oficial vs concorrentes: ${d.competitor_comparison.title} (${d.competitor_comparison.table_headers.join(" | ")})`);
  }
  return out.join("\n");
}

/** Render anti-hallucination block (hard rules) for the prompt. */
export function renderAntiHallucinationForPrompt(d: LiveProductDossier | null): string {
  if (!d) return "";
  const ah = d.anti_hallucination;
  const lines: string[] = [];
  if (ah.never_claim.length) lines.push(`NUNCA AFIRME: ${ah.never_claim.join(" | ")}`);
  if (ah.always_explain.length) lines.push(`SEMPRE EXPLIQUE: ${ah.always_explain.join(" | ")}`);
  if (ah.always_require.length) lines.push(`SEMPRE PERGUNTE / EXIJA: ${ah.always_require.join(" | ")}`);
  if (ah.never_mix_with.length) lines.push(`NUNCA COMBINE COM: ${ah.never_mix_with.join(" | ")}`);
  if (ah.never_use_in_stages.length) lines.push(`NUNCA USE NAS ETAPAS: ${ah.never_use_in_stages.join(" | ")}`);
  if (d.forbidden_products.length) lines.push(`PRODUTOS PROIBIDOS NO COMBO: ${d.forbidden_products.join(" | ")}`);
  if (d.required_products.length) lines.push(`PRODUTOS REQUERIDOS NO COMBO: ${d.required_products.join(" | ")}`);
  if (!lines.length) return "";
  return `### REGRAS ANTI-ALUCINAÇÃO (Sistema A oficial)\n${lines.join("\n")}`;
}

/** Discovery tokens used by intent matching and SPIN problem questions. */
export function getDiscoveryTokens(d: LiveProductDossier | null): string[] {
  if (!d) return [];
  const bag = [
    ...d.bot_trigger_words,
    ...d.market_keywords,
    ...d.search_intent_keywords,
  ]
    .flatMap((s) => s.split(/[,;|/]+/))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);
  return Array.from(new Set(bag));
}

/** Persist-ready snapshot for system_a_catalog.extra_data.system_a_live. */
export function snapshotForPersistence(d: LiveProductDossier): Record<string, unknown> {
  return {
    fetched_at: new Date().toISOString(),
    id: d.id,
    applications: d.applications,
    features: d.features,
    benefits: d.benefits,
    technical_specs: d.technical_specs,
    document_extracts: d.document_extracts,
    workflow_stages: d.workflow_stages,
    competitor_comparison: d.competitor_comparison,
    forbidden_products: d.forbidden_products,
    required_products: d.required_products,
    anti_hallucination: d.anti_hallucination,
    target_audience: d.target_audience,
    market_keywords: d.market_keywords,
    bot_trigger_words: d.bot_trigger_words,
    search_intent_keywords: d.search_intent_keywords,
  };
}
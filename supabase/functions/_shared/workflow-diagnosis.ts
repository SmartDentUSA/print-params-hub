/**
 * Workflow Diagnosis 7×3 — cross-references the lead's current stack
 * (equipment, software, form responses) with the workflow_cell_mappings
 * editor (products/sdr_fields/competitors per cell) to produce an
 * actionable seller briefing: what the lead has, what's missing, what
 * competitor he uses, what combo to offer next, and a short positioning
 * script (DeepSeek, soft-fail).
 *
 * Pure read-only over workflow_cell_mappings + lia_attendances +
 * smartops_form_field_responses + raw_payload.custom_fields. No writes.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchProductDossier,
  fetchRayshapeDossier,
  renderDossierForPrompt,
  fetchEnrichedProductDossier,
} from "./product-rag.ts";
import {
  type LiveProductDossier,
  renderLiveDossierForPrompt,
  renderAntiHallucinationForPrompt,
  getDiscoveryTokens,
} from "./system-a-live.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export interface MappingRow {
  workflow_stage: string;
  workflow_cell: string;
  mapping_type: "product" | "sdr_field" | "competitor";
  mapped_value: string;
  mapped_label: string | null;
}

export interface StackEntry {
  stage: string;
  cell: string;
  field: string;            // sdr_field mapped_value used to read the lead
  field_label: string;      // human label from mapping
  value: string;            // raw value found on the lead
  is_competitor: boolean;
  competitor_label: string | null;
}

export interface LeadIntent {
  produto: string;
  target_stage: string | null;
  target_cell: string | null;
  matched_product_label: string | null;
  source: string;
}

export interface ComboBlock {
  mesma_celula: string[];
  celula_adjacente: string[];
  cursos: string[];
}

export interface WorkflowDiagnosis {
  stack_atual: StackEntry[];
  intent: LeadIntent | null;
  lacunas: Array<{ stage: string; cell: string; reason: string }>;
  combo_sugerido: ComboBlock;
  perguntas_qualificacao: string[];
  concorrentes_detectados: Array<{ stage: string; cell: string; label: string }>;
  llm_script?: string;       // optional DeepSeek positioning bullets
  spin?: SpinBriefing;       // NEW — SPIN briefing for the seller
  /**
   * Cells where the lead explicitly declared they DO NOT own equipment
   * (e.g. equip_printer_model = "não"). Used by SPIN to avoid implying
   * ownership of the product-of-interest.
   */
  declared_empty_cells?: string[];
}

export interface SpinBriefing {
  situacao: string;
  timing?: {
    faixa: "AGORA" | "CURTO" | "MEDIO" | "FRIO" | "TIMING_INDETERMINADO" | string;
    justificativa: string;
    acao_recomendada: string;
  };
  perfil_profissional?: {
    persona: string;
    porte: string;
    maturidade_digital: string;
    tom_recomendado: string;
    gatilhos_de_valor: string[];
  };
  dores_provaveis: Array<{ dor: string; evidencia: string }>;
  implicacoes: string[];
  ponte_produto: string;
  perguntas_spin: {
    situacao: string[];
    problema: string[];
    implicacao: string[];
    necessidade: string[];
  };
  alerta_lacuna?: string;
  /**
   * Roteiro canônico de perfilamento — espelha o formulário
   * "# - Formulário exocad I.A." em 9 pontos fixos. Cada item indica
   * se o lead já declarou aquele dado (`declarado`), se o vendedor
   * precisa perguntar (`a_descobrir`) ou se declarou negativa explícita
   * (`gap_ofensivo` — terceiriza/não internalizou → ofensiva comercial).
   */
  roteiro_perfilamento?: RoteiroItem[];
}

export interface RoteiroItem {
  ordem: number;
  etapa_label: string;        // ex.: "1 · Captura"
  titulo: string;             // título curto (Scanner, CAD, Modelos…)
  pergunta_canonica: string;  // pergunta exata como no form
  status: "declarado" | "a_descobrir" | "gap_ofensivo";
  valor_declarado?: string;
  hipotese?: string;          // só quando gap_ofensivo
  gancho_smartdent?: string;  // produto/lane Smart Dent que resolve esta etapa
}

// ────────────────────────────────────────────────────────────────
// Stage ordering + simple pré-requisitos para a régua de lacunas
// ────────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  "etapa_1_scanner",
  "etapa_2_cad",
  "etapa_3_impressao",
  "etapa_4_pos_impressao",
  "etapa_5_finalizacao",
  "etapa_6_cursos",
  "etapa_7_fresagem",
];

const STAGE_LABEL: Record<string, string> = {
  etapa_1_scanner: "1 · Captura/Scanner",
  etapa_2_cad: "2 · CAD",
  etapa_3_impressao: "3 · Impressão 3D",
  etapa_4_pos_impressao: "4 · Pós-impressão",
  etapa_5_finalizacao: "5 · Finalização",
  etapa_6_cursos: "6 · Cursos",
  etapa_7_fresagem: "7 · Fresagem",
};

// Pré-requisitos: para vender X na etapa N o lead idealmente já tem N-1, N-2.
const STAGE_PREREQS: Record<string, string[]> = {
  etapa_2_cad: ["etapa_1_scanner"],
  etapa_3_impressao: ["etapa_1_scanner", "etapa_2_cad"],
  etapa_4_pos_impressao: ["etapa_3_impressao"],
  etapa_5_finalizacao: ["etapa_3_impressao", "etapa_4_pos_impressao"],
  etapa_7_fresagem: ["etapa_2_cad"],
};

// Mapa label→pergunta humana curta (para sdr_field labels comuns).
const QUESTION_TEMPLATES: Record<string, string> = {
  scanner: "Qual scanner intraoral/bancada você usa hoje?",
  impressora: "Qual marca/modelo de impressora 3D está em produção hoje?",
  resina: "Quais resinas você usa hoje e em qual indicação?",
  software: "Usa exocad, 3Shape, Blue Sky? Tem licença própria ou de laboratório?",
  cad: "Faz o desenho CAD internamente ou terceiriza para laboratório?",
  caracterizacao: "Como faz a caracterização e acabamento final hoje?",
  limpeza: "Como faz pós-cura, limpeza e brilho final das peças?",
  fresadora: "Tem fresadora? Qual modelo e indicação principal?",
  presencial: "Já fez curso presencial de fluxo digital? Qual ano?",
  online: "Acompanha cursos online de odontologia digital?",
  volume: "Quantas peças por mês você imprime hoje?",
};

// ────────────────────────────────────────────────────────────────
// Cache do mapeamento 7×3 (5 min)
// ────────────────────────────────────────────────────────────────
let _cache: { at: number; rows: MappingRow[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadMappings(supabase: SupabaseClient): Promise<MappingRow[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.rows;
  const { data } = await supabase
    .from("workflow_cell_mappings")
    .select("workflow_stage,workflow_cell,mapping_type,mapped_value,mapped_label")
    .limit(2000);
  const rows = (data ?? []) as MappingRow[];
  _cache = { at: Date.now(), rows };
  return rows;
}

// ────────────────────────────────────────────────────────────────
// Discovery-token index — used by resolveIntent to boost matching
// using Sistema A `bot_trigger_words` + `market_keywords` + local
// `keywords` from system_a_catalog. Keyed by normalized product label
// from the mapping. Cached 5 min.
// ────────────────────────────────────────────────────────────────
let _tokenCache: { at: number; index: Map<string, Set<string>> } | null = null;

async function loadProductTokenIndex(
  supabase: SupabaseClient,
  mappings: MappingRow[],
): Promise<Map<string, Set<string>>> {
  if (_tokenCache && Date.now() - _tokenCache.at < CACHE_TTL_MS) return _tokenCache.index;
  const labels = Array.from(new Set(
    mappings
      .filter((m) => m.mapping_type === "product")
      .map((m) => (m.mapped_label || m.mapped_value || "").trim())
      .filter(Boolean),
  ));
  const index = new Map<string, Set<string>>();
  if (!labels.length) {
    _tokenCache = { at: Date.now(), index };
    return index;
  }
  try {
    // pull all catalog rows in one shot, then match by includes/equality.
    const { data } = await supabase
      .from("system_a_catalog")
      .select("name, slug, external_id, keywords, extra_data")
      .eq("active", true)
      .limit(800);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[®©™]/g, "").trim();
    for (const label of labels) {
      const ln = normalize(label);
      let row = rows.find((r) => normalize(String(r.name || "")) === ln);
      if (!row) row = rows.find((r) => {
        const n = normalize(String(r.name || ""));
        return n && (n.includes(ln) || ln.includes(n));
      });
      if (!row) continue;
      const extra = (row.extra_data as Record<string, unknown> | null) ?? {};
      const live = (extra?.system_a_live as Record<string, unknown> | undefined) ?? undefined;
      const bag: string[] = [];
      const pushArr = (v: unknown) => {
        if (Array.isArray(v)) for (const x of v) if (typeof x === "string") bag.push(x);
      };
      // local fields (when previously synced or natively populated)
      pushArr(row.keywords);
      pushArr(extra.bot_trigger_words);
      pushArr(extra.market_keywords);
      pushArr(extra.search_intent_keywords);
      // live snapshot from refresh-system-a-cache
      if (live) {
        pushArr(live.bot_trigger_words);
        pushArr(live.market_keywords);
        pushArr(live.search_intent_keywords);
      }
      const tokens = bag
        .flatMap((s) => s.split(/[,;|/]+/))
        .map((s) => normalize(s).replace(/[^a-z0-9\s]/g, " ").trim())
        .flatMap((s) => s.split(/\s+/))
        .filter((t) => t.length >= 3 && t.length <= 32);
      const set = new Set<string>(tokens);
      if (set.size) index.set(label, set);
    }
  } catch (e) {
    console.warn("[workflow-diagnosis] loadProductTokenIndex failed:", e);
  }
  _tokenCache = { at: Date.now(), index };
  return index;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().trim();
}

function isFilled(v: unknown): boolean {
  const s = norm(v);
  return s !== "" && s !== "não" && s !== "nao" && s !== "n/a" && s !== "—";
}

function pickLeadValue(
  lead: Record<string, unknown>,
  field: string,
  formIndex: Map<string, string>,
  customFieldsIndex: Map<string, string>,
): string {
  const direct = lead[field];
  if (isFilled(direct)) return String(direct);
  const lower = field.toLowerCase();
  const fromForm = formIndex.get(lower);
  if (isFilled(fromForm)) return fromForm!;
  const fromCustom = customFieldsIndex.get(lower);
  if (isFilled(fromCustom)) return fromCustom!;
  return "";
}

function questionFor(label: string): string {
  const l = label.toLowerCase();
  for (const [k, q] of Object.entries(QUESTION_TEMPLATES)) {
    if (l.includes(k)) return q;
  }
  // fallback: turn the label into a question
  const clean = label.replace(/^(SDR:|Campo:|Equipamento:)\s*/i, "").trim();
  return `${clean}?`;
}

// ────────────────────────────────────────────────────────────────
// Main: diagnose
// ────────────────────────────────────────────────────────────────
export async function diagnoseLead(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
  opts: { enableLLM?: boolean } = {},
): Promise<WorkflowDiagnosis> {
  const mappings = await loadMappings(supabase);
  if (mappings.length === 0) {
    return emptyDiagnosis();
  }
  const tokenIndex = await loadProductTokenIndex(supabase, mappings);

  // Index form responses (latest by label) + custom_fields
  const formIndex = new Map<string, string>();
  if (lead.id) {
    try {
      const { data: forms } = await supabase
        .from("smartops_form_field_responses")
        .select("field_name,field_label,value,created_at")
        .eq("lead_id", lead.id as string)
        .order("created_at", { ascending: false })
        .limit(80);
      for (const r of (forms ?? []) as Array<Record<string, unknown>>) {
        const fn = norm(r.field_name);
        const fl = norm(r.field_label);
        const v = String(r.value ?? "");
        if (fn && !formIndex.has(fn)) formIndex.set(fn, v);
        if (fl && !formIndex.has(fl)) formIndex.set(fl, v);
      }
    } catch (_e) { /* swallow */ }
  }

  const customFieldsIndex = new Map<string, string>();
  const rawCustom = (lead.raw_payload as Record<string, unknown> | undefined)?.custom_fields as
    | Record<string, unknown> | undefined;
  if (rawCustom && typeof rawCustom === "object") {
    for (const [k, v] of Object.entries(rawCustom)) {
      customFieldsIndex.set(norm(k), String(v ?? ""));
    }
  }

  // Group mappings by cell
  type CellBucket = {
    stage: string; cell: string;
    products: MappingRow[]; competitors: MappingRow[]; sdr_fields: MappingRow[];
  };
  const cells = new Map<string, CellBucket>();
  for (const m of mappings) {
    const key = `${m.workflow_stage}::${m.workflow_cell}`;
    let b = cells.get(key);
    if (!b) {
      b = { stage: m.workflow_stage, cell: m.workflow_cell, products: [], competitors: [], sdr_fields: [] };
      cells.set(key, b);
    }
    if (m.mapping_type === "product") b.products.push(m);
    else if (m.mapping_type === "competitor") b.competitors.push(m);
    else if (m.mapping_type === "sdr_field") b.sdr_fields.push(m);
  }

  // ── Stack atual + concorrentes ──
  const stack: StackEntry[] = [];
  const concorrentes: WorkflowDiagnosis["concorrentes_detectados"] = [];
  const cellsWithStack = new Set<string>();
  const declaredEmpty = new Set<string>();

  // Raw value lookup that does NOT filter out "não/nao" — used to detect
  // cells where the lead explicitly declared they do NOT own equipment.
  const rawLeadValue = (field: string): string => {
    const direct = lead[field];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
    const fromForm = formIndex.get(field.toLowerCase());
    if (fromForm !== undefined && fromForm !== "") return fromForm;
    const fromCustom = customFieldsIndex.get(field.toLowerCase());
    if (fromCustom !== undefined && fromCustom !== "") return fromCustom;
    return "";
  };
  const isExplicitNo = (v: string): boolean => {
    const s = v.toLowerCase().trim();
    return s === "não" || s === "nao" || s === "n/a" || s === "—" || s === "no" || s === "nenhum" || s === "nenhuma";
  };

  for (const b of cells.values()) {
    for (const sf of b.sdr_fields) {
      // Declared-empty detection: equipment-style fields with explicit "não"
      const rawVal = rawLeadValue(sf.mapped_value);
      if (rawVal && isExplicitNo(rawVal) && /equip|printer|scanner|impress|cad|fresa|forno|cura/i.test(sf.mapped_value + " " + (sf.mapped_label || ""))) {
        declaredEmpty.add(`${b.stage}::${b.cell}`);
      }
      const val = pickLeadValue(lead, sf.mapped_value, formIndex, customFieldsIndex);
      if (!val) continue;
      // Check if value matches any competitor of this cell
      let comp: MappingRow | null = null;
      const valN = norm(val);
      for (const c of b.competitors) {
        const cn = norm(c.mapped_value);
        if (cn && (valN.includes(cn) || cn.includes(valN))) { comp = c; break; }
      }
      stack.push({
        stage: b.stage,
        cell: b.cell,
        field: sf.mapped_value,
        field_label: sf.mapped_label || sf.mapped_value,
        value: val.slice(0, 120),
        is_competitor: !!comp,
        competitor_label: comp?.mapped_label || comp?.mapped_value || null,
      });
      cellsWithStack.add(`${b.stage}::${b.cell}`);
      if (comp) {
        concorrentes.push({
          stage: b.stage,
          cell: b.cell,
          label: comp.mapped_label || comp.mapped_value,
        });
      }
    }
  }

  // ── Intent (produto buscado) ──
  const intent = resolveIntent(lead, mappings, tokenIndex);

  // ── Intent-leak guard: drop stack entries that are actually echoing the
  // form-declared interest (e.g. SDR field "qual impressora você busca?"
  // captured the product-of-interest, not an installed equipment).
  if (intent) {
    const tokenize = (s: string): Set<string> => {
      const stop = new Set([
        "de", "da", "do", "para", "com", "e", "a", "o", "the", "of",
      ]);
      const compact = norm(s).replace(/[^a-z0-9\s]/g, " ");
      const tokens = compact.split(/\s+/).filter((t) => t.length >= 4 && !stop.has(t));
      // Also include a no-space squashed form so "edgemini" and "edge mini" match
      const squashed = compact.replace(/\s+/g, "");
      const out = new Set(tokens);
      if (squashed.length >= 6) out.add(squashed);
      return out;
    };
    const intentTokenSet = new Set<string>();
    for (const src of [intent.matched_product_label, intent.produto]) {
      if (!src) continue;
      for (const t of tokenize(String(src))) intentTokenSet.add(t);
    }
    const INTEREST_RE = /interesse|busca|deseja|quer|procura|alvo|gostaria|pretende/i;
    // Value-side leak: any stack value whose RAW text is clearly a form-interest
    // echo (e.g. "SDR: Interesse em Scanner: ...") is NEVER installed equipment.
    const INTEREST_VALUE_RE = /^\s*sdr\s*:|interesse\s+em|busca\s+por|procurando|gostaria\s+de|deseja\s+adquirir|pretendo\s+comprar/i;
    for (let i = stack.length - 1; i >= 0; i--) {
      const s = stack[i];
      // Hard-drop: value itself looks like an interest declaration.
      if (INTEREST_VALUE_RE.test(String(s.value || ""))) {
        stack.splice(i, 1);
        continue;
      }
      const valTokens = tokenize(s.value);
      const valSquashed = norm(s.value).replace(/[^a-z0-9]/g, "");
      let shared = 0;
      for (const t of valTokens) if (intentTokenSet.has(t)) shared++;
      // Also check squashed-form overlap (catches "edgemini" vs "edge mini")
      const squashedHit = valSquashed.length >= 6 && Array.from(intentTokenSet).some(
        (t) => t.length >= 6 && (valSquashed.includes(t) || t.includes(valSquashed)),
      );
      const hitIntent = shared >= 1 || squashedHit;
      const isInterestField = INTEREST_RE.test(s.field + " " + s.field_label);
      if (hitIntent && isInterestField) {
        stack.splice(i, 1);
      }
    }
    // Recompute cellsWithStack after scrubbing
    cellsWithStack.clear();
    for (const s of stack) cellsWithStack.add(`${s.stage}::${s.cell}`);
  }

  // If a cell is in declaredEmpty AND has no equipment-grade stack entry,
  // also drop any leftover non-equipment stack entries on that cell — they
  // are almost certainly intent/interest noise.
  for (let i = stack.length - 1; i >= 0; i--) {
    const s = stack[i];
    const cellKey = `${s.stage}::${s.cell}`;
    if (declaredEmpty.has(cellKey) && !/equip|printer|scanner|impress|cad|fresa|forno|cura/i.test(s.field + " " + s.field_label)) {
      stack.splice(i, 1);
    }
  }
  cellsWithStack.clear();
  for (const s of stack) cellsWithStack.add(`${s.stage}::${s.cell}`);

  // ── Lacunas (em relação ao alvo) ──
  const lacunas: WorkflowDiagnosis["lacunas"] = [];
  if (intent?.target_stage) {
    const prereqs = STAGE_PREREQS[intent.target_stage] ?? [];
    for (const pre of prereqs) {
      // any cell of this prereq stage filled?
      const filledHere = Array.from(cellsWithStack).some(k => k.startsWith(pre + "::"));
      if (!filledHere) {
        lacunas.push({ stage: pre, cell: "*", reason: `Pré-requisito para ${STAGE_LABEL[intent.target_stage!]} sem dados` });
      }
    }
    // próprio cell-alvo vazio?
    if (intent.target_cell && !cellsWithStack.has(`${intent.target_stage}::${intent.target_cell}`)) {
      lacunas.push({ stage: intent.target_stage, cell: intent.target_cell, reason: "Célula-alvo do interesse ainda sem dados declarados" });
    }
  }

  // ── Combo sugerido ──
  const combo: ComboBlock = { mesma_celula: [], celula_adjacente: [], cursos: [] };
  if (intent?.target_stage && intent.target_cell) {
    // REGRA: NUNCA citar outro produto da mesma etapa/célula como alternativa.
    // Quando temos um produto-âncora (matched_product_label), `mesma_celula` contém
    // SOMENTE esse produto. Quando não há match, fica vazio — o vendedor deve
    // qualificar antes de sugerir. Acessórios/upgrades vêm de `celula_adjacente`.
    if (intent.matched_product_label) {
      combo.mesma_celula = [intent.matched_product_label];
    }
    // adjacent = next stage (any cell), top 2 products
    const idx = STAGE_ORDER.indexOf(intent.target_stage);
    const nextStage = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
    if (nextStage) {
      const adjProducts: string[] = [];
      for (const b of cells.values()) {
        if (b.stage !== nextStage) continue;
        for (const p of b.products) adjProducts.push(p.mapped_label || p.mapped_value);
      }
      combo.celula_adjacente = Array.from(new Set(adjProducts)).slice(0, 2);
    }
  }
  // cursos: se etapa 6 vazia, sugerir top 1 curso
  const hasCourses = Array.from(cellsWithStack).some(k => k.startsWith("etapa_6_cursos::"));
  if (!hasCourses) {
    const cursoProducts: string[] = [];
    for (const b of cells.values()) {
      if (b.stage !== "etapa_6_cursos") continue;
      for (const p of b.products) cursoProducts.push(p.mapped_label || p.mapped_value);
    }
    combo.cursos = Array.from(new Set(cursoProducts)).slice(0, 1);
  }

  // ── Perguntas de qualificação ──
  const perguntas: string[] = [];
  const seenQuestions = new Set<string>();
  const askForCell = (b: CellBucket) => {
    for (const sf of b.sdr_fields) {
      const val = pickLeadValue(lead, sf.mapped_value, formIndex, customFieldsIndex);
      if (val) continue; // já temos
      const q = questionFor(sf.mapped_label || sf.mapped_value);
      if (!seenQuestions.has(q)) { perguntas.push(q); seenQuestions.add(q); }
    }
  };
  if (intent?.target_stage && intent.target_cell) {
    const ownCell = cells.get(`${intent.target_stage}::${intent.target_cell}`);
    if (ownCell) askForCell(ownCell);
  }
  for (const l of lacunas) {
    if (l.cell === "*") {
      for (const b of cells.values()) if (b.stage === l.stage) { askForCell(b); break; }
    } else {
      const b = cells.get(`${l.stage}::${l.cell}`);
      if (b) askForCell(b);
    }
  }
  // limite e prioriza top 4
  const perguntasTop = perguntas.slice(0, 4);

  const diag: WorkflowDiagnosis = {
    stack_atual: stack,
    intent,
    lacunas,
    combo_sugerido: combo,
    perguntas_qualificacao: perguntasTop,
    concorrentes_detectados: concorrentes,
    declared_empty_cells: Array.from(declaredEmpty),
  };

  // ── LLM positioning script (best-effort, soft-fail) ──
  if (opts.enableLLM !== false) {
    try {
      diag.llm_script = await generatePositioningScript(supabase, diag, lead);
    } catch (e) {
      console.warn("[workflow-diagnosis] LLM script failed:", e);
    }
  }

  // ── SPIN briefing (heuristic seed + Gemini enrichment, soft-fail) ──
  try {
    // Pre-fetch enriched dossier (local + Sistema A live) for the matched
    // product. Used by both the seed (deterministic) and Gemini (LLM).
    const intentLabel = diag.intent?.matched_product_label || diag.intent?.produto || null;
    const enriched = intentLabel ? await fetchEnrichedProductDossier(supabase, intentLabel) : null;
    const liveDossier = enriched?.live ?? null;

    const seed = seedSpinBriefing(diag, lead, liveDossier);
    diag.spin = seed;
    if (opts.enableLLM !== false) {
      const llm = await enrichSpinWithLLM(supabase, diag, lead, seed, liveDossier);
      if (llm) diag.spin = llm;
    }
  } catch (e) {
    console.warn("[workflow-diagnosis] SPIN briefing failed:", e);
  }

  return diag;
}

function emptyDiagnosis(): WorkflowDiagnosis {
  return {
    stack_atual: [], intent: null, lacunas: [],
    combo_sugerido: { mesma_celula: [], celula_adjacente: [], cursos: [] },
    perguntas_qualificacao: [], concorrentes_detectados: [],
  };
}

function resolveIntent(
  lead: Record<string, unknown>,
  mappings: MappingRow[],
  tokenIndex?: Map<string, Set<string>>,
): LeadIntent | null {
  const candidates: Array<{ text: string; source: string }> = [];
  if (lead.produto_interesse) candidates.push({ text: String(lead.produto_interesse), source: "produto_interesse" });
  if (lead.produto_interesse_auto) candidates.push({ text: String(lead.produto_interesse_auto), source: "produto_interesse_auto" });
  if (lead.form_name) candidates.push({ text: String(lead.form_name), source: "form_name" });
  if (lead.resina_interesse) candidates.push({ text: String(lead.resina_interesse), source: "resina_interesse" });

  const products = mappings.filter(m => m.mapping_type === "product");
  // ── Scoring-based intent match ──
  // Stopwords: palavras genéricas que NÃO devem causar match (categoria, não produto).
  const STOPWORDS = new Set([
    "scanner","intraoral","intraorais","bancada","impressora","impressoras","resina","resinas",
    "software","softwares","cad","curso","cursos","dispositivo","credito","crédito","creditos","créditos",
    "plus","wireless","mini","pro","max","ultra","edge","kit","combo","produto","produtos",
    "notebook","leads","face","smart","dent","smartdent","dental","odonto","odontologia",
    "para","com","sem","novo","nova","de","da","do","das","dos","e","ou","em","no","na",
    "imp","impresoras","printer","printers",
  ]);
  // Tokens fortes de marca conhecidas (qualquer um conta como assinatura).
  const BRAND_TOKENS = new Set([
    "blz","medit","rayshape","exocad","phrozen","anycubic","elegoo","formlabs",
    "asiga","sprintray","creality","3shape","nextdent","detax","ackuretta","whip",
  ]);
  const tokenize = (s: string): string[] =>
    norm(s)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/([a-z])(\d)/g, "$1 $2") // ino110 -> ino 110, i500 -> i 500
      .replace(/(\d)([a-z])/g, "$1 $2")
      .split(/\s+/)
      .filter(Boolean);
  const significantTokens = (s: string): string[] =>
    tokenize(s).filter(t => !STOPWORDS.has(t) && t.length >= 2);

  for (const cand of candidates) {
    const candTokens = significantTokens(cand.text);
    if (!candTokens.length) continue;
    const candSet = new Set(candTokens);
    const candBrand = candTokens.find(t => BRAND_TOKENS.has(t)) || null;
    const candHasDigit = candTokens.some(t => /\d/.test(t));

    let best: { row: MappingRow; score: number; brandMatch: boolean; modelMatch: boolean } | null = null;
    for (const p of products) {
      const pl = p.mapped_label || p.mapped_value;
      const plTokens = significantTokens(pl);
      if (!plTokens.length) continue;
      const plBrand = plTokens.find(t => BRAND_TOKENS.has(t)) || null;

      // Hard guard: if both sides declare a brand and they differ, skip — NUNCA cruzar marcas.
      if (candBrand && plBrand && candBrand !== plBrand) continue;

      let score = 0;
      let brandMatch = false;
      let modelMatch = false;
      for (const tok of plTokens) {
        if (!candSet.has(tok)) continue;
        if (BRAND_TOKENS.has(tok)) { score += 5; brandMatch = true; }
        else if (/\d/.test(tok)) { score += 4; modelMatch = true; } // model number
        else { score += 1; }
      }
      // Bonus: substring exato do label dentro da intent ou vice-versa
      const ln = norm(pl);
      const cn = norm(cand.text);
      if (ln && cn && (cn.includes(ln) || ln.includes(cn))) score += 6;

      // Boost from Sistema A discovery tokens (bot_trigger_words,
      // market_keywords, search_intent_keywords). Each cand token that
      // hits the product's discovery set counts as a strong product
      // signal (weight 5, similar to a brand match).
      const discovery = tokenIndex?.get(pl);
      if (discovery && discovery.size) {
        let discHits = 0;
        for (const tok of candTokens) {
          if (discovery.has(tok)) discHits++;
        }
        if (discHits > 0) {
          score += discHits * 5;
          modelMatch = true; // treat discovery token as a strong signal
        }
      }

      if (score > (best?.score ?? 0)) best = { row: p, score, brandMatch, modelMatch };
    }

    // Threshold mínimo:
    //  - se a intent tem marca conhecida → exigimos brandMatch (peso 5).
    //  - se a intent tem número de modelo → exigimos modelMatch OU brandMatch.
    //  - caso geral → score >= 6 (≈ substring/duas palavras específicas).
    const accept = best && (
      (candBrand && best.brandMatch) ||
      (candHasDigit && (best.modelMatch || best.brandMatch)) ||
      (!candBrand && !candHasDigit && best.score >= 6)
    );

    if (accept && best) {
      return {
        produto: cand.text,
        target_stage: best.row.workflow_stage,
        target_cell: best.row.workflow_cell,
        matched_product_label: best.row.mapped_label || best.row.mapped_value,
        source: cand.source,
      };
    }
  }
  // intent declarada mas sem match no mapeamento
  if (candidates.length > 0) {
    return {
      produto: candidates[0].text,
      target_stage: null,
      target_cell: null,
      matched_product_label: null,
      source: candidates[0].source,
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// DeepSeek positioning script (short, capped, soft-fail)
// ────────────────────────────────────────────────────────────────
async function generatePositioningScript(
  supabase: SupabaseClient,
  diag: WorkflowDiagnosis,
  lead: Record<string, unknown>,
): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "";
  if (!diag.intent?.target_cell && diag.concorrentes_detectados.length === 0) return "";

  const stackSummary = diag.stack_atual.length
    ? diag.stack_atual.map(s => `${STAGE_LABEL[s.stage] || s.stage}/${s.cell}=${s.value}${s.is_competitor ? ` [concorrente: ${s.competitor_label}]` : ""}`).join("; ")
    : "(vazio)";

  const declaredEmptyList = (diag.declared_empty_cells ?? [])
    .map((k) => {
      const [st] = k.split("::");
      return STAGE_LABEL[st] || st;
    });
  const declaredEmptyTxt = declaredEmptyList.length ? Array.from(new Set(declaredEmptyList)).join(", ") : "nenhuma";

  const targetCellKey2 = diag.intent?.target_stage && diag.intent.target_cell
    ? `${diag.intent.target_stage}::${diag.intent.target_cell}`
    : null;
  const targetCellHasStack2 = targetCellKey2
    ? diag.stack_atual.some((s) => `${s.stage}::${s.cell}` === targetCellKey2)
    : false;
  const targetNotOwned2 = !!diag.intent && (
    !targetCellHasStack2 ||
    (targetCellKey2 ? (diag.declared_empty_cells ?? []).includes(targetCellKey2) : false)
  );
  const ownershipStatus = !diag.intent
    ? "—"
    : targetNotOwned2
      ? "AINDA NÃO POSSUI — busca adquirir (alvo de compra)"
      : "já consta no stack instalado";
  const comboList = [
    ...diag.combo_sugerido.mesma_celula,
    ...diag.combo_sugerido.celula_adjacente,
    ...diag.combo_sugerido.cursos,
  ];

  // ── RAG dossiers from system_a_catalog (soft-fail) ──
  const intentLabel = diag.intent?.matched_product_label || diag.intent?.produto || null;
  const comboTop = diag.combo_sugerido.mesma_celula.slice(0, 2);
  const printerInvolved =
    diag.concorrentes_detectados.some(c =>
      /\b(impress|printer|anycubic|phrozen|elegoo|formlabs|asiga|sprintray|creality)\b/i.test(c.label),
    ) ||
    diag.stack_atual.some(s => s.stage === "etapa_3_impressao") ||
    ["etapa_3_impressao", "etapa_4_pos_impressao", "etapa_5_finalizacao"].includes(diag.intent?.target_stage || "");

  const [intentDossier, comboDossiers, rayshapeDossier] = await Promise.all([
    fetchProductDossier(supabase, intentLabel),
    Promise.all(comboTop.map(p => fetchProductDossier(supabase, p))),
    printerInvolved ? fetchRayshapeDossier(supabase) : Promise.resolve(null),
  ]);

  const ragBlocks: string[] = [];
  const intentBlock = renderDossierForPrompt(intentDossier, "DOSSIÊ PRODUTO DE INTENÇÃO");
  if (intentBlock) ragBlocks.push(intentBlock);
  comboDossiers.forEach((d, i) => {
    const block = renderDossierForPrompt(d, `DOSSIÊ COMBO ${i + 1}`);
    if (block) ragBlocks.push(block);
  });
  let rayshapeRule = "";
  if (printerInvolved && rayshapeDossier) {
    ragBlocks.push(renderDossierForPrompt(rayshapeDossier, "DOSSIÊ RAYSHAPE"));
    rayshapeRule =
      "\nREGRA RAYSHAPE: Impressoras 3D genéricas (Anycubic, Phrozen, Elegoo, Creality, etc.) têm limitações operacionais reais — curva de calibração, perfis não validados para resinas odontológicas, perda de produtividade clínica. A Rayshape elimina essas dificuldades e é sempre superior em facilidade de uso no fluxo digital odontológico. Use isso como gancho de upgrade, citando APENAS specs/benefícios presentes no DOSSIÊ RAYSHAPE acima.";
  } else if (printerInvolved) {
    rayshapeRule =
      "\nREGRA RAYSHAPE: quando lead usa impressora genérica, mencione brevemente que a Rayshape elimina dificuldades operacionais comuns de impressoras genéricas no fluxo odontológico (sem inventar specs).";
  }

  const ragSection = ragBlocks.length
    ? "\n\n=== RAG OFICIAL SMART DENT (use SOMENTE estes fatos) ===\n" + ragBlocks.join("\n\n") + rayshapeRule + "\n========================================================="
    : "";

  const prompt = `Você é consultor técnico Smart Dent (odontologia digital).
Lead:
  Especialidade: ${lead.especialidade || lead.area_atuacao || "N/I"}
  Stack atual: ${stackSummary}
  Concorrentes detectados: ${diag.concorrentes_detectados.map(c => c.label).join(", ") || "nenhum"}
  Intenção declarada: ${diag.intent?.produto || "—"} (${diag.intent?.matched_product_label || "sem match no portfólio"})
  Etapa-alvo: ${diag.intent?.target_stage ? (STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage) : "—"}
  Lacunas: ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ") || "nenhuma"}
  Combo sugerido pelo motor: ${comboList.join(" | ") || "nenhum"}${ragSection}

Escreva em PT-BR, no MÁXIMO 5 bullets curtos (uma linha cada, começando com "• "):
1) Apresente o PRODUTO DE INTENÇÃO (exatamente "${diag.intent?.matched_product_label || diag.intent?.produto || "—"}") com 1 benefício/spec do DOSSIÊ DE INTENÇÃO.
2) 1 pergunta consultiva de descoberta — qual a dor/necessidade que motivou o interesse nesse produto (volume, aplicação clínica, fluxo atual). NÃO é interrogatório, é convite.
3) 1 gancho contra cada concorrente detectado (se houver), apoiado em spec/benefício do dossiê RAG. Se não houver concorrente, PULE este bullet — não invente concorrente.
4) Se impressora estiver envolvida E o produto de intenção NÃO é Rayshape: 1 bullet de posicionamento Rayshape do DOSSIÊ RAYSHAPE. Se o próprio produto pedido já é Rayshape, PULE.
5) 1 alerta de risco — respeitar ordem do fluxo digital (lacunas: ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ") || "nenhuma"}), não empurrar fora de etapa.

REGRAS DURAS (violação = output inutilizado):
- PROIBIDO sugerir qualquer outro produto da mesma etapa como alternativa, upgrade ou substituto ao produto de intenção. Só o que o lead pediu.
- PROIBIDO citar produtos que não estejam em "Combo sugerido" acima ou nos dossiês RAG.
- PROIBIDO inventar specs, modelos, preços, prazos ou promessas absolutas.
- A marca pedida pelo lead (BLZ, MEDIT, Rayshape, etc.) NUNCA é "concorrente" — é a própria intenção.
- Foco do briefing: ensinar o vendedor a MAPEAR a necessidade real do lead (por que esse produto, qual problema resolve, qual aplicação) antes de empurrar combo.`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 450,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return "";
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || "").trim();
    return text;
  } finally {
    clearTimeout(to);
  }
}

// ────────────────────────────────────────────────────────────────
// Renderers
// ────────────────────────────────────────────────────────────────
const escHtml = (v: unknown): string => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderDiagnosisHTML(diag: WorkflowDiagnosis): string {
  if (!diag.stack_atual.length && !diag.intent && !diag.combo_sugerido.mesma_celula.length && !diag.spin) {
    return "";
  }
  const out: string[] = [];
  out.push(`<b>🧭 Diagnóstico SPIN (Fluxo Digital 7×3)</b><br>`);

  // ── SITUAÇÃO ──
  out.push(`<br>📍 <b>SITUAÇÃO</b><br>`);
  if (diag.spin?.situacao) {
    out.push(`${escHtml(diag.spin.situacao)}<br>`);
  }
  if (diag.stack_atual.length) {
    const stages = Array.from(new Set(diag.stack_atual.map(s => s.stage))).sort();
    out.push(`<i>Stack:</i> ${escHtml(stages.map(s => STAGE_LABEL[s] || s).join(" + "))}<br>`);
  }
  if (diag.intent) {
    const targ = diag.intent.target_stage
      ? `${escHtml(STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage)}${diag.intent.matched_product_label ? ` · ≈ ${escHtml(diag.intent.matched_product_label)}` : ""}`
      : `<i>sem match no portfólio — confirmar</i>`;
    out.push(`<i>Intenção:</i> ${escHtml(diag.intent.produto)} → ${targ}<br>`);
  }
  if (diag.concorrentes_detectados.length) {
    out.push(`<i>Concorrentes:</i> ${diag.concorrentes_detectados.map(c => `${escHtml(c.label)} (${escHtml(STAGE_LABEL[c.stage] || c.stage)})`).join(", ")}<br>`);
  }

  // ── TIMING + PERFIL PROFISSIONAL (destaque no topo) ──
  if (diag.spin?.timing) {
    const faixaLabel: Record<string, string> = {
      AGORA: "🔥 AGORA (≤7 dias)",
      CURTO: "⚡ CURTO (8–30 dias)",
      MEDIO: "🕐 MÉDIO (1–3 meses)",
      FRIO: "❄️ FRIO (>3 meses)",
      TIMING_INDETERMINADO: "❔ TIMING INDETERMINADO",
    };
    const label = faixaLabel[diag.spin.timing.faixa] || `⏱ ${escHtml(diag.spin.timing.faixa)}`;
    out.push(`<br><b>⏱ TIMING:</b> ${label}<br>`);
    if (diag.spin.timing.justificativa) out.push(`&nbsp;&nbsp;<i>Sinal:</i> ${escHtml(diag.spin.timing.justificativa)}<br>`);
    if (diag.spin.timing.acao_recomendada) out.push(`&nbsp;&nbsp;<i>Ação:</i> ${escHtml(diag.spin.timing.acao_recomendada)}<br>`);
  }
  if (diag.spin?.perfil_profissional) {
    const p = diag.spin.perfil_profissional;
    out.push(`<br>👤 <b>PERFIL DO PROFISSIONAL</b><br>`);
    out.push(`&nbsp;&nbsp;<i>Persona:</i> ${escHtml(p.persona)} · <i>Porte:</i> ${escHtml(p.porte)} · <i>Maturidade:</i> ${escHtml(p.maturidade_digital)}<br>`);
    out.push(`&nbsp;&nbsp;<i>Tom recomendado:</i> ${escHtml(p.tom_recomendado)}<br>`);
    if (p.gatilhos_de_valor?.length) {
      out.push(`&nbsp;&nbsp;<i>Gatilhos de valor:</i> ${p.gatilhos_de_valor.map(escHtml).join(" · ")}<br>`);
    }
  }

  // ── ROTEIRO DE PERFILAMENTO (siga nesta ordem — espelha # - Formulário exocad I.A.) ──
  const rot = diag.spin?.roteiro_perfilamento;
  if (rot && rot.length) {
    out.push(`<br>🧩 <b>ROTEIRO DE PERFILAMENTO</b> <i>(siga nesta ordem — perguntas do formulário exocad I.A.)</i><br>`);
    for (const r of rot) {
      const head = `${r.ordem}. <b>${escHtml(r.etapa_label)}</b> — ${escHtml(r.titulo)}`;
      if (r.status === "declarado") {
        out.push(`&nbsp;&nbsp;✅ ${head}: ${escHtml(r.valor_declarado || "")}<br>`);
      } else if (r.status === "gap_ofensivo") {
        out.push(`&nbsp;&nbsp;⚠️ ${head}: <i>${escHtml(r.valor_declarado || "—")}</i> → gancho: ${escHtml(r.gancho_smartdent || "")}<br>`);
      } else {
        out.push(`&nbsp;&nbsp;❓ ${head}: ${escHtml(r.pergunta_canonica)}<br>`);
      }
    }
  }

  // ── DORES PROVÁVEIS ──
  if (diag.spin?.dores_provaveis?.length) {
    out.push(`<br>⚠️ <b>DORES PROVÁVEIS</b> <i>(hipóteses a confirmar)</i><br>`);
    diag.spin.dores_provaveis.forEach(d => {
      out.push(`&nbsp;&nbsp;• ${escHtml(d.dor)}${d.evidencia ? ` — <i>evidência:</i> ${escHtml(d.evidencia)}` : ""}<br>`);
    });
  }

  // ── IMPLICAÇÕES ──
  if (diag.spin?.implicacoes?.length) {
    out.push(`<br>💸 <b>IMPLICAÇÕES</b><br>`);
    diag.spin.implicacoes.forEach(i => out.push(`&nbsp;&nbsp;• ${escHtml(i)}<br>`));
  }

  // ── PONTE PARA O PRODUTO ──
  if (diag.spin?.ponte_produto) {
    out.push(`<br>🎯 <b>PONTE PARA O PRODUTO DE INTERESSE</b><br>${escHtml(diag.spin.ponte_produto)}<br>`);
  }

  // ── PERGUNTAS SPIN ──
  const spinQ = diag.spin?.perguntas_spin;
  if (spinQ && (spinQ.situacao.length || spinQ.problema.length || spinQ.implicacao.length || spinQ.necessidade.length)) {
    out.push(`<br>📋 <b>PERGUNTAS SPIN</b> <i>(na ordem)</i><br>`);
    const row = (tag: string, qs: string[]) => qs.forEach(q => out.push(`&nbsp;&nbsp;<b>${tag}</b> → ${escHtml(q)}<br>`));
    row("S", spinQ.situacao);
    row("P", spinQ.problema);
    row("I", spinQ.implicacao);
    row("N", spinQ.necessidade);
  } else if (diag.perguntas_qualificacao.length) {
    // fallback antigo
    out.push(`<br>📋 <b>Pergunte ao lead:</b><br>`);
    diag.perguntas_qualificacao.forEach((q, i) => out.push(`&nbsp;&nbsp;${i + 1}. ${escHtml(q)}<br>`));
  }

  // ── COMBO ──
  const c = diag.combo_sugerido;
  if (c.mesma_celula.length || c.celula_adjacente.length || c.cursos.length) {
    out.push(`<br>🛒 <b>Combo natural</b> <i>(após confirmar necessidade)</i><br>`);
    if (c.mesma_celula.length) out.push(`&nbsp;&nbsp;◦ Etapa-alvo: ${c.mesma_celula.map(escHtml).join(" · ")}<br>`);
    if (c.celula_adjacente.length) out.push(`&nbsp;&nbsp;◦ Próxima etapa: ${c.celula_adjacente.map(escHtml).join(" · ")}<br>`);
    if (c.cursos.length) out.push(`&nbsp;&nbsp;◦ Curso: ${c.cursos.map(escHtml).join(" · ")}<br>`);
  }

  // ── ALERTA ──
  if (diag.spin?.alerta_lacuna) {
    out.push(`<br>🚨 <b>${escHtml(diag.spin.alerta_lacuna)}</b><br>`);
  } else if (diag.lacunas.length) {
    out.push(`<br>🚨 <b>Atenção:</b> lacunas em ${diag.lacunas.map(l => escHtml(STAGE_LABEL[l.stage] || l.stage)).join(", ")} — respeitar ordem do fluxo.<br>`);
  }

  // ── Fallback bullets antigos (se SPIN faltou) ──
  if (!diag.spin && diag.llm_script) {
    const safe = escHtml(diag.llm_script).replace(/\n/g, "<br>");
    out.push(`<br>💡 <b>Como posicionar:</b><br>${safe}<br>`);
  }

  return out.join("");
}

export function renderDiagnosisWhatsApp(diag: WorkflowDiagnosis): string {
  if (!diag.stack_atual.length && !diag.intent && !diag.spin) return "";
  const lines: string[] = [];
  lines.push("🧭 *SPIN — Briefing do Lead*");

  if (diag.spin?.situacao) lines.push(`*Situação:* ${diag.spin.situacao}`);
  if (diag.spin?.timing) {
    lines.push(`*Timing:* ${diag.spin.timing.faixa} — ${diag.spin.timing.acao_recomendada || diag.spin.timing.justificativa || ""}`.trim());
  }
  if (diag.spin?.perfil_profissional) {
    const p = diag.spin.perfil_profissional;
    lines.push(`*Perfil:* ${p.persona} · ${p.porte} · ${p.maturidade_digital} (tom: ${p.tom_recomendado})`);
  }
  if (diag.intent?.target_stage) {
    lines.push(`*Intenção:* ${diag.intent.produto} → ${STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage}`);
  } else if (diag.intent) {
    lines.push(`*Intenção:* ${diag.intent.produto} (validar)`);
  }
  if (diag.concorrentes_detectados.length) {
    lines.push(`*Concorrentes:* ${diag.concorrentes_detectados.map(c => c.label).join(", ")}`);
  }
  const rotW = diag.spin?.roteiro_perfilamento;
  if (rotW && rotW.length) {
    const pend = rotW.filter((r) => r.status !== "declarado").slice(0, 3);
    if (pend.length) {
      lines.push(`🧩 *Roteiro a descobrir:*`);
      for (const r of pend) {
        const icon = r.status === "gap_ofensivo" ? "⚠️" : "❓";
        lines.push(`  ${icon} ${r.etapa_label} — ${r.titulo}`);
      }
    }
  }
  if (diag.spin?.dores_provaveis?.length) {
    lines.push(`⚠️ *Dor #1:* ${diag.spin.dores_provaveis[0].dor}`);
  }
  if (diag.spin?.implicacoes?.length) {
    lines.push(`💸 *Impacto:* ${diag.spin.implicacoes[0]}`);
  }
  if (diag.spin?.ponte_produto) {
    lines.push(`🎯 *Ponte:* ${diag.spin.ponte_produto}`);
  }
  const sq = diag.spin?.perguntas_spin;
  if (sq) {
    lines.push(`📋 *Pergunte (SPIN):*`);
    if (sq.situacao[0]) lines.push(`  S- ${sq.situacao[0]}`);
    if (sq.problema[0]) lines.push(`  P- ${sq.problema[0]}`);
    if (sq.implicacao[0]) lines.push(`  I- ${sq.implicacao[0]}`);
    if (sq.necessidade[0]) lines.push(`  N- ${sq.necessidade[0]}`);
  }
  const combo = [
    ...diag.combo_sugerido.mesma_celula,
    ...diag.combo_sugerido.celula_adjacente,
    ...diag.combo_sugerido.cursos,
  ].slice(0, 4);
  if (combo.length) lines.push(`🛒 *Após confirmar:* ${combo.join(" · ")}`);
  if (diag.spin?.alerta_lacuna) lines.push(`🚨 ${diag.spin.alerta_lacuna}`);
  return lines.join("\n");
}

/** Compact text block for embedding into the cognitive prompt (no formatting). */
export function renderDiagnosisForPrompt(diag: WorkflowDiagnosis): string {
  if (!diag.stack_atual.length && !diag.intent && !diag.spin) return "";
  const lines: string[] = [];
  if (diag.spin?.situacao) lines.push(`SPIN-Situação: ${diag.spin.situacao}`);
  if (diag.stack_atual.length) {
    lines.push(`Stack atual: ${diag.stack_atual.map(s => `${STAGE_LABEL[s.stage] || s.stage}/${s.cell}=${s.value}${s.is_competitor ? " [concorrente]" : ""}`).join("; ")}`);
  }
  if (diag.intent?.target_stage) {
    lines.push(`Intenção mapeada: ${diag.intent.produto} → ${STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage}/${diag.intent.target_cell}`);
  }
  if (diag.lacunas.length) {
    lines.push(`Lacunas: ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ")}`);
  }
  if (diag.concorrentes_detectados.length) {
    lines.push(`Concorrentes: ${diag.concorrentes_detectados.map(c => c.label).join(", ")}`);
  }
  if (diag.spin?.dores_provaveis?.length) {
    lines.push(`Dores prováveis: ${diag.spin.dores_provaveis.map(d => d.dor).join(" | ")}`);
  }
  if (diag.spin?.implicacoes?.length) {
    lines.push(`Implicações: ${diag.spin.implicacoes.join(" | ")}`);
  }
  if (diag.spin?.ponte_produto) lines.push(`Ponte ao produto: ${diag.spin.ponte_produto}`);
  const rotP = diag.spin?.roteiro_perfilamento;
  if (rotP && rotP.length) {
    const dec = rotP.filter((r) => r.status === "declarado").length;
    const desc = rotP.filter((r) => r.status === "a_descobrir").length;
    const gap = rotP.filter((r) => r.status === "gap_ofensivo").length;
    lines.push(`Roteiro perfilamento: ${dec} declarados / ${desc} a descobrir / ${gap} gaps ofensivos`);
  }
  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────
// SPIN Briefing — heuristic seed + LLM enrichment
// ────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────
// Roteiro Canônico de Perfilamento (espelha "# - Formulário exocad I.A.")
// Espinha dorsal da SPIN: vendedor deve seguir esses 9 pontos na ordem,
// confirmando o que está ✅ declarado e perguntando o que está ❓ a descobrir
// (ou atacando o que virou ⚠️ gap_ofensivo).
// ──────────────────────────────────────────────────────────────────────
const ROTEIRO_NEG_RE =
  /^\s*(n[aã]o(?:\s|,|\.|$)|ainda\s*n[aã]o|n\/a|nenhum[ao]?|sem\s+|—|-|0)\s*/i;

function _pickFirst(lead: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = lead[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "—" && s !== "-" && s.toLowerCase() !== "null") return s;
  }
  return "";
}

export function buildLeadProfilingRoteiro(
  lead: Record<string, unknown>,
): RoteiroItem[] {
  const spec: Array<{
    ordem: number;
    etapa_label: string;
    titulo: string;
    pergunta_canonica: string;
    cols: string[];
    extra_cols?: string[];
    gancho: string;
  }> = [
    {
      ordem: 1,
      etapa_label: "Perfil",
      titulo: "Área + especialidade",
      pergunta_canonica:
        "Confirma sua área de atuação e especialidade (clínica, laboratório, radiologia, planning…)?",
      cols: ["area_atuacao"],
      extra_cols: ["especialidade"],
      gancho: "",
    },
    {
      ordem: 2,
      etapa_label: "1 · Captura",
      titulo: "Scanner intraoral",
      pergunta_canonica:
        "Hoje você digitaliza suas moldagens? Qual scanner usa (Medit, BLZ, iTero, Aoralscan…)?",
      cols: [
        "equip_scanner",
        "scanner_marca",
        "sdr_scanner_modelo",
        "tem_scanner",
        "como_digitaliza",
      ],
      gancho: "Scanner Smart Dent (BLZ INO100/200, Medit i700/i900)",
    },
    {
      ordem: 3,
      etapa_label: "2 · CAD",
      titulo: "Software CAD",
      pergunta_canonica:
        "Qual software CAD você utiliza hoje (exocad, Medit Clic App, Blz CAD, outro)?",
      cols: ["software_cad", "equip_cad"],
      gancho: "exocad DentalCAD Smart Dent",
    },
    {
      ordem: 4,
      etapa_label: "3 · Impressão (HW)",
      titulo: "Impressora 3D",
      pergunta_canonica:
        "Atualmente você utiliza qual impressora 3D no dia a dia (RayShape, Phrozen, Anycubic, FormLabs…)?",
      cols: ["equip_impressora", "impressora_modelo", "sdr_modelo_impressora_param"],
      gancho: "RayShape EdgeMini / EdgePro",
    },
    {
      ordem: 5,
      etapa_label: "3 · Impressão · Modelos",
      titulo: "Modelos de estudo/trabalho",
      pergunta_canonica:
        "Você imprime modelos? Com qual resina (Smart Dent, Yller, Makertech, outras)?",
      cols: ["imprime_modelos"],
      gancho: "Resina Smart Dent Model",
    },
    {
      ordem: 6,
      etapa_label: "3 · Impressão · Placas",
      titulo: "Placas miorrelaxantes",
      pergunta_canonica:
        "Você imprime placas miorrelaxantes? Com qual resina (Smart Dent Splint, FGM, importada…)?",
      cols: ["imprime_placas", "sdr_quantas_placas"],
      gancho: "Resina Smart Dent Splint",
    },
    {
      ordem: 7,
      etapa_label: "3 · Impressão · Longa duração",
      titulo: "Elementos dentários (LD)",
      pergunta_canonica:
        "Você imprime elementos dentários de longa duração? Com qual resina?",
      cols: ["imprime_resinas_ld"],
      gancho: "Resina Smart Dent Permanente",
    },
    {
      ordem: 8,
      etapa_label: "3 · Impressão · Guias",
      titulo: "Guias cirúrgicas",
      pergunta_canonica:
        "Você imprime guias cirúrgicas? Com qual resina?",
      cols: ["imprime_guias"],
      gancho: "Resina Smart Dent Surgical Guide",
    },
    {
      ordem: 9,
      etapa_label: "Recorrência",
      titulo: "Consumo de resina + fornecedor",
      pergunta_canonica:
        "Quanto de resina você consome por mês e com qual fornecedor compra hoje?",
      cols: ["sdr_resina_atual", "resina_consumo_mensal_estimado", "sdr_usa_resina_smartdent"],
      gancho: "Kit recorrente Smart Dent (assinatura mensal)",
    },
  ];

  return spec.map((it) => {
    const main = _pickFirst(lead, it.cols);
    const extra = it.extra_cols ? _pickFirst(lead, it.extra_cols) : "";
    const raw = [main, extra].filter(Boolean).join(" / ");
    const out: RoteiroItem = {
      ordem: it.ordem,
      etapa_label: it.etapa_label,
      titulo: it.titulo,
      pergunta_canonica: it.pergunta_canonica,
      status: "a_descobrir",
    };
    if (!raw) {
      out.status = "a_descobrir";
    } else if (ROTEIRO_NEG_RE.test(raw)) {
      out.status = "gap_ofensivo";
      out.valor_declarado = raw.slice(0, 200);
      out.hipotese = "declarou que não faz/não tem — terceiriza ou ainda não internalizou";
    } else {
      out.status = "declarado";
      out.valor_declarado = raw.slice(0, 200);
    }
    if (it.gancho && out.status !== "declarado") out.gancho_smartdent = it.gancho;
    return out;
  });
}

function seedSpinBriefing(
  diag: WorkflowDiagnosis,
  lead: Record<string, unknown>,
  live?: LiveProductDossier | null,
): SpinBriefing {
  const role = String(lead.area_atuacao || lead.especialidade || "profissional");
  const stackStages = Array.from(new Set(diag.stack_atual.map(s => STAGE_LABEL[s.stage] || s.stage)));

  // ── Intent-vs-stack separation ─────────────────────────────────
  // O produto vindo de form/produto_interesse é SEMPRE alvo de compra.
  // Só consideramos "instalado" se a célula do alvo aparece em stack_atual
  // e NÃO está em declared_empty_cells.
  const targetCellKey = diag.intent?.target_stage && diag.intent.target_cell
    ? `${diag.intent.target_stage}::${diag.intent.target_cell}`
    : null;
  const declaredEmptySet = new Set(diag.declared_empty_cells ?? []);
  const targetCellHasStack = targetCellKey
    ? diag.stack_atual.some((s) => `${s.stage}::${s.cell}` === targetCellKey)
    : false;
  const targetNotOwned = !!diag.intent && (
    !targetCellHasStack || (targetCellKey ? declaredEmptySet.has(targetCellKey) : false)
  );
  const targetLabel = diag.intent?.matched_product_label || diag.intent?.produto || "";
  const targetStageLbl = diag.intent?.target_stage ? (STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage) : "";

  const goalTxt = diag.intent
    ? `avaliando adquirir ${targetLabel}${targetStageLbl ? ` (${targetStageLbl})` : ""}`
    : "intenção a confirmar";

  let situacao: string;
  if (targetNotOwned && targetStageLbl) {
    const stackTail = stackStages.length ? ` Stack instalada hoje: ${stackStages.join(" + ")}.` : " Sem stack declarada.";
    situacao = `${role} ainda sem ${targetStageLbl} próprio, ${goalTxt}.${stackTail}`;
  } else if (stackStages.length) {
    situacao = `${role} com estrutura em ${stackStages.join(" + ")}, ${goalTxt}.`;
  } else {
    situacao = `${role} sem stack declarada, ${goalTxt}.`;
  }

  const dores: SpinBriefing["dores_provaveis"] = [];
  const implicacoes: string[] = [];

  // Dor primária quando o lead ainda não tem o produto-alvo
  if (targetNotOwned && targetStageLbl) {
    dores.push({
      dor: `Sem ${targetStageLbl} próprio — depende de terceiros ou não executa esse passo do fluxo`,
      evidencia: `declarou não possuir equipamento na célula-alvo (${targetStageLbl})`,
    });
    implicacoes.push(`Custo de terceirização e perda de margem por peça enquanto não internaliza ${targetStageLbl}`);
  }

  // Heurísticas por concorrente
  for (const c of diag.concorrentes_detectados) {
    const lbl = c.label.toLowerCase();
    if (/anycubic|phrozen|elegoo|creality|formlabs/.test(lbl)) {
      dores.push({
        dor: "Calibração instável e perfis de resina não validados para uso odontológico",
        evidencia: `usa ${c.label} (impressora genérica)`,
      });
      implicacoes.push("Horas perdidas em retrabalho de peças clínicas e risco de rejeição em consultório");
    } else if (c.stage === "etapa_1_scanner") {
      dores.push({
        dor: "Alinhamento de STL e exportação para o CAD pouco previsíveis",
        evidencia: `scanner ${c.label}`,
      });
      implicacoes.push("Atrasos no envio ao laboratório/CAD e retrabalho de escaneamento");
    } else if (c.stage === "etapa_2_cad") {
      dores.push({
        dor: "Licenciamento e curva de software CAD não integrados ao fluxo Smart Dent",
        evidencia: `CAD ${c.label}`,
      });
      implicacoes.push("Dependência de terceiros para desenho e perda de margem por terceirização");
    }
  }

  // Heurísticas por lacuna
  for (const l of diag.lacunas) {
    if (l.cell === "*") {
      dores.push({
        dor: `Fluxo quebrado: falta ${STAGE_LABEL[l.stage] || l.stage} antes da etapa de interesse`,
        evidencia: "pré-requisito do fluxo sem dados declarados",
      });
      implicacoes.push(`Risco do equipamento de interesse ficar parado sem ${STAGE_LABEL[l.stage] || l.stage}`);
    }
  }

  // Intent etapa 6 sem nada
  if (diag.intent?.target_stage === "etapa_6_cursos" && diag.stack_atual.length === 0) {
    dores.push({
      dor: "Curva de aprendizado sem equipamento próprio para praticar",
      evidencia: "intenção em curso sem stack instalada",
    });
    implicacoes.push("Investimento em treinamento sem produzir casos clínicos imediatos");
  }

  // Ponte (heurística): produto de intenção + 1 característica do RAG (live API quando disponível).
  let ponte = "";
  if (diag.intent?.matched_product_label) {
    const baseLabel = diag.intent.matched_product_label;
    const stageLbl = STAGE_LABEL[diag.intent.target_stage!] || diag.intent.target_stage;
    if (live?.applications) {
      ponte = `${baseLabel} (${live.applications}) cobre a etapa de ${stageLbl}; conecte ao gargalo declarado pelo lead.`;
    } else if (live?.features?.length) {
      ponte = `${baseLabel} entrega ${live.features.slice(0, 2).join(" + ")} e resolve a etapa de ${stageLbl}.`;
    } else {
      ponte = `${baseLabel} se conecta diretamente à etapa de ${stageLbl}, resolvendo o gargalo desse ponto do fluxo do lead.`;
    }
  } else if (diag.intent) {
    ponte = `Confirmar com o lead qual o uso real de "${diag.intent.produto}" antes de posicionar — sem match direto no portfólio mapeado.`;
  }

  // ── ROTEIRO CANÔNICO (espelha "# - Formulário exocad I.A.") ──
  // Vendedor segue na ordem; cada item ❓ a_descobrir ou ⚠️ gap_ofensivo
  // vira UMA pergunta de SITUAÇÃO. Itens ✅ declarado: só reconhecimento.
  const roteiro = buildLeadProfilingRoteiro(lead);
  const pendentes = roteiro.filter((r) => r.status !== "declarado");
  const gaps = roteiro.filter((r) => r.status === "gap_ofensivo");

  const situacaoQ: string[] = pendentes.map(
    (r) => `Etapa ${r.etapa_label} — ${r.titulo}: ${r.pergunta_canonica}`,
  );
  if (situacaoQ.length === 0) {
    const top = roteiro
      .filter((r) => r.valor_declarado)
      .slice(0, 3)
      .map((r) => `${r.titulo}: ${r.valor_declarado}`)
      .join("; ");
    situacaoQ.push(
      `Stack completa declarada (${top}). Reconheça e aprofunde direto no gargalo do produto-alvo.`,
    );
  }

  const problemaQ: string[] = [];
  // Gaps ofensivos do roteiro viram perguntas de PROBLEMA (atacar terceirização)
  for (const g of gaps.slice(0, 2)) {
    problemaQ.push(
      `Etapa ${g.etapa_label}: você declarou "${g.valor_declarado}" — hoje terceiriza essa entrega? Qual o custo mensal e a previsibilidade de prazo?`,
    );
  }
  if (targetNotOwned && targetLabel) {
    problemaQ.push(`Etapa ${targetStageLbl || "alvo"}: o que te levou a olhar especificamente para ${targetLabel} agora? Já avaliou outras opções?`);
  }
  if (diag.concorrentes_detectados.length) {
    problemaQ.push(`Onde o ${diag.concorrentes_detectados[0].label} mais te trava — calibração, perfil de material, suporte ou produtividade?`);
  }
  if (!targetNotOwned && diag.intent?.matched_product_label) {
    problemaQ.push(`O que te fez olhar especificamente para ${diag.intent.matched_product_label} agora?`);
  }
  // Live API → perguntas de PROBLEMA específicas: cada `always_require`,
  // cada `required_products` e cada `key_specs` de document_extracts vira
  // qualificador que o vendedor PRECISA cobrir.
  if (live) {
    for (const req of live.anti_hallucination.always_require.slice(0, 2)) {
      problemaQ.push(`Hoje você já tem ${req}? Sem isso, o ${live.name} não entrega o resultado esperado.`);
    }
    if (live.required_products.length) {
      problemaQ.push(`Para usar ${live.name} você precisa de ${live.required_products.slice(0, 2).join(" + ")}. Já tem ou precisamos combinar?`);
    }
    const docSpecs = live.document_extracts
      .flatMap((d) => d.key_specs || [])
      .map((s: unknown) => {
        if (typeof s === "string") return s;
        if (s && typeof s === "object") {
          const o = s as Record<string, unknown>;
          return String(o.label ?? o.name ?? o.spec ?? o.title ?? o.value ?? "");
        }
        return "";
      })
      .filter((s) => s && s.length > 2)
      .slice(0, 2);
    for (const ds of docSpecs) {
      problemaQ.push(`Qual "${ds.slice(0, 80)}" você usa hoje? Preciso confirmar a compatibilidade.`);
    }
  }
  if (problemaQ.length === 0) problemaQ.push("Qual é hoje o ponto do seu fluxo digital que mais consome tempo ou gera retrabalho?");

  // Lane resinas/protocolo já está coberta pelo roteiro (itens 5-9).
  // Só reforça PROBLEMA de protocolo quando intent envolve impressão e o
  // roteiro mostra que o lead já imprime (item 5 ou 6 ou 7 ou 8 declarado).
  const imprimeAlgo = roteiro.some(
    (r) => r.ordem >= 5 && r.ordem <= 8 && r.status === "declarado",
  );
  if (imprimeAlgo) {
    problemaQ.push(
      "Etapa Pós-impressão: qual seu protocolo de lavagem (álcool/solvente, tempo) e de cura (dispositivo, ciclo)? É o protocolo validado pelo fabricante da resina?",
    );
  }
  const triggersConsumables = roteiro.some(
    (r) => r.ordem >= 5 && r.ordem <= 9 && r.status !== "declarado",
  );

  const implicacaoQ: string[] = [
    "Quantas peças/mês esse gargalo impacta — em retrabalho, hora-cadeira ou casos perdidos?",
    "Se isso continuar travado mais 6 meses, qual o impacto direto na sua agenda e no faturamento?",
  ];

  const necessidadeQ: string[] = [];
  if (diag.intent?.matched_product_label) {
    necessidadeQ.push(
      `Se ${diag.intent.matched_product_label}${targetStageLbl ? ` resolver a etapa ${targetStageLbl}` : " resolver esse gargalo"}, faz sentido fecharmos uma demonstração ainda esta semana?`,
    );
  } else {
    necessidadeQ.push("Se a gente trouxer uma solução que resolva esse ponto específico, faz sentido avançarmos com uma demonstração?");
  }
  if (triggersConsumables) {
    necessidadeQ.push(
      `Se fecharmos ${diag.intent?.matched_product_label || "o equipamento-alvo"} + o pacote de resinas Smart Dent validadas e protocolo de pós-cura, faz sentido alinharmos também o kit inicial de consumíveis?`,
    );
  }

  const alerta = diag.lacunas.length
    ? `Atenção à ordem do fluxo: lead tem lacuna em ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ")}. Confirmar antes de empurrar combo fora de etapa.`
    : undefined;

  return {
    situacao,
    dores_provaveis: dores.slice(0, 4),
    implicacoes: Array.from(new Set(implicacoes)).slice(0, 3),
    ponte_produto: ponte,
    perguntas_spin: {
      situacao: situacaoQ.slice(0, 9),
      problema: problemaQ.slice(0, 5),
      implicacao: implicacaoQ,
      necessidade: necessidadeQ.slice(0, 2),
    },
    alerta_lacuna: alerta,
    roteiro_perfilamento: roteiro,
  };
}

async function enrichSpinWithLLM(
  supabase: SupabaseClient,
  diag: WorkflowDiagnosis,
  lead: Record<string, unknown>,
  seed: SpinBriefing,
  live?: LiveProductDossier | null,
): Promise<SpinBriefing | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  if (!diag.intent && diag.concorrentes_detectados.length === 0 && diag.stack_atual.length === 0) return null;

  // Reuse RAG dossiers (intent + Rayshape if printer involved)
  const intentLabel = diag.intent?.matched_product_label || diag.intent?.produto || null;
  const printerInvolved =
    diag.concorrentes_detectados.some(c => /\b(impress|printer|anycubic|phrozen|elegoo|formlabs|asiga|sprintray|creality)\b/i.test(c.label)) ||
    diag.stack_atual.some(s => s.stage === "etapa_3_impressao") ||
    ["etapa_3_impressao", "etapa_4_pos_impressao", "etapa_5_finalizacao"].includes(diag.intent?.target_stage || "");

  const [intentDossier, rayshapeDossier] = await Promise.all([
    fetchProductDossier(supabase, intentLabel),
    printerInvolved ? fetchRayshapeDossier(supabase) : Promise.resolve(null),
  ]);

  const ragBlocks: string[] = [];
  const intentBlock = renderDossierForPrompt(intentDossier, "DOSSIÊ PRODUTO DE INTENÇÃO");
  if (intentBlock) ragBlocks.push(intentBlock);
  const liveBlock = renderLiveDossierForPrompt(live ?? null);
  if (liveBlock) ragBlocks.push(liveBlock);
  const antiHallBlock = renderAntiHallucinationForPrompt(live ?? null);
  if (antiHallBlock) ragBlocks.push(antiHallBlock);
  if (printerInvolved && rayshapeDossier) {
    ragBlocks.push(renderDossierForPrompt(rayshapeDossier, "DOSSIÊ RAYSHAPE"));
  }
  const ragSection = ragBlocks.length
    ? "\n\n=== RAG OFICIAL SMART DENT (use SOMENTE estes fatos para specs/benefícios) ===\n" + ragBlocks.join("\n\n") + "\n========================================================="
    : "";

  const stackSummary = diag.stack_atual.length
    ? diag.stack_atual.map(s => `${STAGE_LABEL[s.stage] || s.stage}/${s.cell}=${s.value}${s.is_competitor ? ` [concorrente: ${s.competitor_label}]` : ""}`).join("; ")
    : "(vazio)";

  // Local context for prompt (mirrors generatePositioningScript helpers).
  const declaredEmptyListE = (diag.declared_empty_cells ?? []).map((k) => {
    const [st] = k.split("::");
    return STAGE_LABEL[st] || st;
  });
  const declaredEmptyTxt = declaredEmptyListE.length
    ? Array.from(new Set(declaredEmptyListE)).join(", ")
    : "nenhuma";
  const targetCellKeyE = diag.intent?.target_stage && diag.intent.target_cell
    ? `${diag.intent.target_stage}::${diag.intent.target_cell}`
    : null;
  const targetCellHasStackE = targetCellKeyE
    ? diag.stack_atual.some((s) => `${s.stage}::${s.cell}` === targetCellKeyE)
    : false;
  const targetNotOwnedE = !!diag.intent && (
    !targetCellHasStackE || (targetCellKeyE ? (diag.declared_empty_cells ?? []).includes(targetCellKeyE) : false)
  );
  const ownershipStatus = !diag.intent
    ? "—"
    : targetNotOwnedE
      ? "AINDA NÃO POSSUI — busca adquirir (alvo de compra)"
      : "já consta no stack instalado";

  // ── Roteiro canônico (não reordenar; LLM só refina o tom) ──
  const roteiroBlock = (seed.roteiro_perfilamento || [])
    .map((r) => {
      const tag =
        r.status === "declarado"
          ? `✅ ${r.valor_declarado || ""}`
          : r.status === "gap_ofensivo"
            ? `⚠️ gap (${r.valor_declarado || "—"}) → ${r.gancho_smartdent || ""}`
            : `❓ a descobrir`;
      return `${r.ordem}. ${r.etapa_label} — ${r.titulo}: ${tag}\n   pergunta canônica: ${r.pergunta_canonica}`;
    })
    .join("\n");
  const roteiroSection = roteiroBlock
    ? `\n\n=== ROTEIRO DE PERFILAMENTO (rota fixa do formulário exocad I.A. — NÃO reordene, NÃO pule) ===\n${roteiroBlock}\n=========================================================`
    : "";

  const prompt = `Você é coach SPIN de um vendedor consultivo da Smart Dent (odontologia digital).
Sua tarefa: gerar um briefing SPIN ESPECÍFICO deste lead — não genérico — para o vendedor abrir a conversa.

DADOS DO LEAD:
- Nome: ${lead.nome || "N/I"}
- Especialidade/área: ${lead.especialidade || lead.area_atuacao || "N/I"}
- Cargo/tipo declarado: ${lead.cargo || lead.tipo_profissional || lead.role || "N/I"}
- Empresa / razão social: ${lead.empresa_nome || lead.empresa || "N/I"}
- Cidade/UF: ${[lead.cidade, lead.uf || lead.estado].filter(Boolean).join("/") || "N/I"}
- Tempo de profissão / maturidade declarada: ${lead.tempo_profissao || lead.maturidade_digital || "N/I"}
- Urgência declarada: ${lead.urgency_level || lead.urgencia || "N/I"}
- Motivação primária: ${lead.primary_motivation || lead.motivacao || "N/I"}
- Primeiro contato: ${lead.first_contact_at || lead.primeiro_contato || lead.created_at || "N/I"}
- Origem / form_name: ${lead.form_name || lead.origem_primeiro_contato || "N/I"}
- Última interação: ${lead.last_interaction_at || lead.ultima_interacao || "N/I"}
- Stack atual: ${stackSummary}
- Concorrentes detectados: ${diag.concorrentes_detectados.map(c => c.label).join(", ") || "nenhum"}
- Intenção declarada: ${diag.intent?.produto || "—"} (match no portfólio: ${diag.intent?.matched_product_label || "sem match"})
- Etapa-alvo: ${diag.intent?.target_stage ? (STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage) : "—"}
- Lacunas no fluxo: ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ") || "nenhuma"}
- Células declaradas SEM equipamento: ${declaredEmptyTxt}
- Status do produto-alvo: ${ownershipStatus}${roteiroSection}${ragSection}

SEED HEURÍSTICO (use como base, REFINE com a stack específica do lead):
${JSON.stringify(seed, null, 2)}

REGRAS DURAS:
- LEITURA DE TIMING (obrigatória): combine "Primeiro contato", "Última interação", "Urgência declarada", "Motivação primária" e a origem para classificar a janela de compra em uma de 4 faixas: **AGORA (≤7d / urgência alta / pediu proposta), CURTO (8–30d / pesquisando ativo), MÉDIO (1–3 meses / mapeando opções), FRIO (>3 meses / só baixou material)**. Justifique em 1 frase citando o sinal usado. Se faltar dado, declare "TIMING_INDETERMINADO" e gere 1 pergunta de SITUAÇÃO que descubra o gatilho/prazo.
- LEITURA DE PERFIL PROFISSIONAL (obrigatória): a partir de Especialidade, Cargo, Empresa, Cidade/UF, Tempo de profissão e Stack, classifique o lead em UMA persona: **CD generalista, CD especialista (qual?), TPD/laboratório, clínica/grupo, distribuidor, estudante**. Estime porte (solo, 2-5 cadeiras, 6+ cadeiras / lab pequeno-médio-grande) e maturidade digital (iniciante / intermediário / avançado) com base na stack declarada. Adapte o tom: avançado → técnico e específico; iniciante → didático e consultivo. Para TPD/lab → foco em produtividade, custo por peça e recorrência de insumos; para CD clínico → foco em hora-cadeira, previsibilidade e experiência do paciente.
- ROTEIRO IMUTÁVEL: as perguntas de SITUAÇÃO devem cobrir EXATAMENTE os itens do "ROTEIRO DE PERFILAMENTO" cujo status é "❓ a descobrir" ou "⚠️ gap", NA MESMA ORDEM do roteiro (1→9). Para itens "✅ declarado" NÃO gere pergunta — só reconheça no campo "situacao". É proibido pular, reordenar ou substituir perguntas do roteiro.
- Cada pergunta de SITUAÇÃO deve PREFIXAR com "Etapa <etapa_label> — <titulo>:" e manter a essência da "pergunta canônica" (você pode refinar o tom, sem perder o foco).
- Itens "⚠️ gap" também viram 1 pergunta de PROBLEMA cada, atacando a terceirização/dependência e introduzindo o "gancho" Smart Dent listado no roteiro.
- SEPARAÇÃO INTENT vs STACK: "Stack atual" é a ÚNICA fonte do que o lead JÁ TEM. O produto-alvo (vindo de form/produto_interesse/campanha) é INTENÇÃO DE COMPRA, NUNCA equipamento instalado.
- Quando "Status do produto-alvo" = "AINDA NÃO POSSUI": NUNCA afirme ou implique posse ("já possui", "sua EdgeMini", "como gerencia seu X"). Use SEMPRE verbos como "avalia adquirir", "busca comprar", "está pesquisando".
- Quando o alvo está em "AINDA NÃO POSSUI": perguntas de SITUAÇÃO devem mapear COMO o lead resolve a etapa hoje (terceiriza? laboratório? não faz?); perguntas de PROBLEMA devem investigar gatilho de compra, alternativas avaliadas e critério de decisão.
- Perguntas DEVEM citar o que o lead JÁ TEM (nome do scanner, da impressora, software). Nada de "qual scanner você usa?" se já sabemos.
- Implicações concretas: peças/mês, hora-cadeira, retrabalho, garantia, custo de terceirização.
- Ponte ao produto: usar SOMENTE specs/benefícios do DOSSIÊ DE INTENÇÃO ou do bloco "CONTEXTO DO PRODUTO (Sistema A live)". Sem inventar.
- Se o bloco "REGRAS ANTI-ALUCINAÇÃO (Sistema A oficial)" existir, é OBRIGATÓRIO:
    • nunca afirme nada listado em "NUNCA AFIRME";
    • nunca combine produtos de "NUNCA COMBINE COM";
    • nunca posicione nas etapas listadas em "NUNCA USE NAS ETAPAS";
    • para CADA item de "SEMPRE PERGUNTE / EXIJA" gere uma pergunta de PROBLEMA específica (ex.: "qual resina?", "qual dispositivo de cura?") — sem isso o vendedor recomenda no escuro;
    • se houver "PRODUTOS REQUERIDOS NO COMBO", faça ao menos 1 pergunta confirmando se o lead já tem cada um;
    • NUNCA sugira "PRODUTOS PROIBIDOS NO COMBO".
- A marca pedida pelo lead NUNCA é concorrente.
- Se não houver concorrente, não invente.
- PT-BR, tom consultivo de colega especialista, NÃO interrogatório.
- TODA pergunta SPIN deve referenciar uma ETAPA do fluxo digital 7×3 (1·Captura/Scanner, 2·CAD, 3·Impressão 3D, 4·Pós-impressão, 5·Finalização, 6·Cursos, 7·Fresagem). Prefixe com "Etapa <nome>:" quando fizer sentido.
- OBRIGATÓRIO: o briefing DEVE conter ao menos 1 pergunta sobre RESINAS (qual usa, aplicação, consumo/mês) e 1 sobre PROTOCOLO de lavagem/cura, sempre que a intent ou stack envolver hardware (scanner, CAD, impressão, pós, finalização, fresagem). Consumíveis são o core de recorrência da Smart Dent — sem isso o briefing está incompleto.
- Pergunta de NECESSIDADE deve nomear EXPLICITAMENTE o produto Smart Dent que resolve a etapa (ex.: "EdgeMini + protocolo de resinas Smart Dent") — não vender "uma solução" genérica.

Responda APENAS com JSON válido (sem markdown, sem comentários), neste schema:
{
  "situacao": "string (1-2 frases — papel + stack-chave + intenção)",
  "timing": {
    "faixa": "AGORA | CURTO | MEDIO | FRIO | TIMING_INDETERMINADO",
    "justificativa": "string curta citando os sinais (datas, urgência, motivação, origem)",
    "acao_recomendada": "string — quando e como o vendedor deve abordar (ex.: 'ligar nas próximas 2h', 'mandar WA hoje', 'nutrir com case')"
  },
  "perfil_profissional": {
    "persona": "CD generalista | CD especialista (X) | TPD/laboratório | clínica/grupo | distribuidor | estudante",
    "porte": "solo | 2-5 cadeiras | 6+ cadeiras | lab pequeno | lab médio | lab grande | indefinido",
    "maturidade_digital": "iniciante | intermediário | avançado",
    "tom_recomendado": "didático | consultivo | técnico-pareado",
    "gatilhos_de_valor": ["1-3 itens que mais ressoam com este perfil (ex.: 'previsibilidade clínica', 'custo por peça', 'hora-cadeira')"]
  },
  "dores_provaveis": [{ "dor": "string", "evidencia": "string curta citando o que o lead tem" }],
  "implicacoes": ["string concreta", "string concreta"],
  "ponte_produto": "string (1-2 frases ligando intenção a benefício do dossiê RAG)",
  "perguntas_spin": {
    "situacao": ["1 pergunta POR item ❓/⚠️ do roteiro, na ordem 1→9"],
    "problema": ["2-3 perguntas (incluindo 1 por item de SEMPRE PERGUNTE / EXIJA quando existir)"],
    "implicacao": ["2 perguntas"],
    "necessidade": ["1 pergunta"]
  },
  "alerta_lacuna": "string opcional ou null"
}`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || "").trim();
    if (!text) return null;
    // Strip potential markdown fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    // Sanity check
    if (!parsed.situacao || !parsed.perguntas_spin) return null;
    return {
      situacao: String(parsed.situacao).slice(0, 400),
      dores_provaveis: Array.isArray(parsed.dores_provaveis)
        ? parsed.dores_provaveis.slice(0, 4).map((d: Record<string, unknown>) => ({
            dor: String(d.dor || "").slice(0, 250),
            evidencia: String(d.evidencia || "").slice(0, 200),
          })).filter((d: { dor: string }) => d.dor)
        : seed.dores_provaveis,
      implicacoes: Array.isArray(parsed.implicacoes)
        ? parsed.implicacoes.slice(0, 3).map((s: unknown) => String(s).slice(0, 250)).filter(Boolean)
        : seed.implicacoes,
      ponte_produto: String(parsed.ponte_produto || seed.ponte_produto).slice(0, 500),
      timing: parsed.timing && typeof parsed.timing === "object" ? {
        faixa: String((parsed.timing as Record<string, unknown>).faixa || "TIMING_INDETERMINADO").slice(0, 40),
        justificativa: String((parsed.timing as Record<string, unknown>).justificativa || "").slice(0, 300),
        acao_recomendada: String((parsed.timing as Record<string, unknown>).acao_recomendada || "").slice(0, 300),
      } : undefined,
      perfil_profissional: parsed.perfil_profissional && typeof parsed.perfil_profissional === "object" ? {
        persona: String((parsed.perfil_profissional as Record<string, unknown>).persona || "").slice(0, 80),
        porte: String((parsed.perfil_profissional as Record<string, unknown>).porte || "indefinido").slice(0, 40),
        maturidade_digital: String((parsed.perfil_profissional as Record<string, unknown>).maturidade_digital || "indefinido").slice(0, 40),
        tom_recomendado: String((parsed.perfil_profissional as Record<string, unknown>).tom_recomendado || "consultivo").slice(0, 40),
        gatilhos_de_valor: Array.isArray((parsed.perfil_profissional as Record<string, unknown>).gatilhos_de_valor)
          ? ((parsed.perfil_profissional as Record<string, unknown>).gatilhos_de_valor as unknown[]).slice(0, 4).map((x) => String(x).slice(0, 80)).filter(Boolean)
          : [],
      } : undefined,
      perguntas_spin: {
        situacao: arrStr(parsed.perguntas_spin?.situacao, 9) || seed.perguntas_spin.situacao,
        problema: arrStr(parsed.perguntas_spin?.problema, 3) || seed.perguntas_spin.problema,
        implicacao: arrStr(parsed.perguntas_spin?.implicacao, 2) || seed.perguntas_spin.implicacao,
        necessidade: arrStr(parsed.perguntas_spin?.necessidade, 1) || seed.perguntas_spin.necessidade,
      },
      alerta_lacuna: parsed.alerta_lacuna ? String(parsed.alerta_lacuna).slice(0, 300) : seed.alerta_lacuna,
      // Roteiro é determinístico — NUNCA confiar no LLM para reordenar/inventar.
      roteiro_perfilamento: seed.roteiro_perfilamento,
    };
  } catch (e) {
    console.warn("[spin-enrich] failed:", e);
    return null;
  } finally {
    clearTimeout(to);
  }
}

function arrStr(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, max).map(x => String(x).trim()).filter(Boolean);
  return out.length ? out : null;
}

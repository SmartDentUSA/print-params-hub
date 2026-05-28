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
} from "./product-rag.ts";

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

  for (const b of cells.values()) {
    for (const sf of b.sdr_fields) {
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
  const intent = resolveIntent(lead, mappings);

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
    const ownCell = cells.get(`${intent.target_stage}::${intent.target_cell}`);
    if (ownCell) {
      combo.mesma_celula = ownCell.products
        .map(p => p.mapped_label || p.mapped_value)
        .filter((p, i, a) => a.indexOf(p) === i)
        .slice(0, 3);
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
  };

  // ── LLM positioning script (best-effort, soft-fail) ──
  if (opts.enableLLM !== false) {
    try {
      diag.llm_script = await generatePositioningScript(supabase, diag, lead);
    } catch (e) {
      console.warn("[workflow-diagnosis] LLM script failed:", e);
    }
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
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) return "";
  if (!diag.intent?.target_cell && diag.concorrentes_detectados.length === 0) return "";

  const stackSummary = diag.stack_atual.length
    ? diag.stack_atual.map(s => `${STAGE_LABEL[s.stage] || s.stage}/${s.cell}=${s.value}${s.is_competitor ? ` [concorrente: ${s.competitor_label}]` : ""}`).join("; ")
    : "(vazio)";
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
1) Como o PRODUTO DE INTENÇÃO se conecta ao stack atual — cite 1 benefício/spec do DOSSIÊ DE INTENÇÃO (compatibilidade real, sem inventar)
2) 1 gancho contra cada concorrente detectado, apoiado em spec/benefício do dossiê RAG
3) Se impressora estiver envolvida: 1 bullet de posicionamento Rayshape baseado no DOSSIÊ RAYSHAPE
4) 1 alerta de risco — respeitar ordem do fluxo digital, não empurrar fora de etapa
REGRAS: NÃO invente produtos nem specs. Use APENAS produtos do "Combo sugerido" e fatos dos dossiês RAG acima. Sem preços. Sem promessas absolutas. Direto ao ponto.`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
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
  if (!diag.stack_atual.length && !diag.intent && !diag.combo_sugerido.mesma_celula.length) {
    return ""; // nada para mostrar
  }
  const out: string[] = [];
  out.push(`<b>🧭 Diagnóstico Fluxo Digital (7×3)</b><br>`);

  // Stack + concorrentes
  if (diag.stack_atual.length) {
    const stages = Array.from(new Set(diag.stack_atual.map(s => s.stage))).sort();
    const stageLabels = stages.map(s => STAGE_LABEL[s] || s).join(" + ");
    out.push(`• Etapas com dados: <b>${escHtml(stageLabels)}</b><br>`);
  }
  if (diag.concorrentes_detectados.length) {
    const list = diag.concorrentes_detectados
      .map(c => `${escHtml(c.label)} (${escHtml(STAGE_LABEL[c.stage] || c.stage)})`).join(", ");
    out.push(`• Concorrência detectada: ${list}<br>`);
  }

  // Intent
  if (diag.intent) {
    if (diag.intent.target_stage) {
      out.push(`🎯 <b>Intenção:</b> ${escHtml(diag.intent.produto)} → ${escHtml(STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage)} / ${escHtml(diag.intent.target_cell || "—")}${diag.intent.matched_product_label ? ` (≈ ${escHtml(diag.intent.matched_product_label)})` : ""}<br>`);
    } else {
      out.push(`🎯 <b>Intenção:</b> ${escHtml(diag.intent.produto)} <i>(sem match no portfólio mapeado — confirmar com o lead)</i><br>`);
    }
  }

  // Lacunas
  if (diag.lacunas.length) {
    out.push(`⚠️ <b>Lacunas no fluxo:</b> ${diag.lacunas.map(l => escHtml(STAGE_LABEL[l.stage] || l.stage)).join(", ")}<br>`);
  }

  // Perguntas
  if (diag.perguntas_qualificacao.length) {
    out.push(`📋 <b>Pergunte ao lead:</b><br>`);
    diag.perguntas_qualificacao.forEach((q, i) => {
      out.push(`&nbsp;&nbsp;${i + 1}. ${escHtml(q)}<br>`);
    });
  }

  // LLM script
  if (diag.llm_script) {
    const safe = escHtml(diag.llm_script).replace(/\n/g, "<br>");
    out.push(`💡 <b>Como posicionar com o setup dele:</b><br>${safe}<br>`);
  }

  // Combo
  const c = diag.combo_sugerido;
  if (c.mesma_celula.length || c.celula_adjacente.length || c.cursos.length) {
    out.push(`🛒 <b>Combo recomendado:</b><br>`);
    if (c.mesma_celula.length) out.push(`&nbsp;&nbsp;◦ Etapa-alvo: ${c.mesma_celula.map(escHtml).join(" · ")}<br>`);
    if (c.celula_adjacente.length) out.push(`&nbsp;&nbsp;◦ Próxima etapa: ${c.celula_adjacente.map(escHtml).join(" · ")}<br>`);
    if (c.cursos.length) out.push(`&nbsp;&nbsp;◦ Curso recomendado: ${c.cursos.map(escHtml).join(" · ")}<br>`);
  }

  return out.join("");
}

export function renderDiagnosisWhatsApp(diag: WorkflowDiagnosis): string {
  if (!diag.stack_atual.length && !diag.intent) return "";
  const lines: string[] = [];
  lines.push("🧭 *Diagnóstico Fluxo Digital*");

  if (diag.stack_atual.length) {
    const stages = Array.from(new Set(diag.stack_atual.map(s => STAGE_LABEL[s.stage] || s.stage)));
    lines.push(`Etapa(s) com dados: ${stages.join(" + ")}`);
  }
  if (diag.concorrentes_detectados.length) {
    lines.push(`Concorrentes: ${diag.concorrentes_detectados.map(c => c.label).join(", ")}`);
  }
  if (diag.intent?.target_stage) {
    lines.push(`🎯 Intent: ${diag.intent.produto} → ${STAGE_LABEL[diag.intent.target_stage] || diag.intent.target_stage}`);
  } else if (diag.intent) {
    lines.push(`🎯 Intent: ${diag.intent.produto} (validar com lead)`);
  }
  if (diag.lacunas.length) {
    lines.push(`⚠️ Lacunas: ${diag.lacunas.map(l => STAGE_LABEL[l.stage] || l.stage).join(", ")}`);
  }
  if (diag.perguntas_qualificacao.length) {
    lines.push(`📋 Perguntar:`);
    diag.perguntas_qualificacao.slice(0, 3).forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  }
  const combo = [
    ...diag.combo_sugerido.mesma_celula,
    ...diag.combo_sugerido.celula_adjacente,
    ...diag.combo_sugerido.cursos,
  ].slice(0, 4);
  if (combo.length) lines.push(`🛒 Ofereça: ${combo.join(" · ")}`);
  if (diag.llm_script) {
    lines.push(`💡 ${diag.llm_script.split("\n").map(s => s.replace(/^[•\-]\s*/, "").trim()).filter(Boolean).slice(0, 2).join(" | ")}`);
  }
  return lines.join("\n");
}

/** Compact text block for embedding into the cognitive prompt (no formatting). */
export function renderDiagnosisForPrompt(diag: WorkflowDiagnosis): string {
  if (!diag.stack_atual.length && !diag.intent) return "";
  const lines: string[] = [];
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
  return lines.join("\n");
}

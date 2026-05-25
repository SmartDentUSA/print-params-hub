// ManyChat → bridge de qualificação síncrona.
// Fluxo:
//   1. Procura lead por manychat_subscriber_id em lia_attendances
//      (merged_into IS NULL).
//   2. Se faltar nome/email/telefone, coleta nessa ordem antes de qualquer
//      coisa, respondendo direto no JSON do External Request do ManyChat.
//   3. Quando o perfil mínimo estiver completo, envia mensagem
//      "Como posso te ajudar?" com quick replies das rotas da LIA.
//   4. NUNCA usa Send API nem MANYCHAT_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";
import {
  AREA_ATUACAO_OPTIONS,
  ESPECIALIDADE_OPTIONS,
  renderNumberedList,
  resolveTaxonomyAnswer,
} from "../_shared/dental-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMPTY_REPLY = {
  version: "v2",
  reply: "",
  qualification_state: "idle",
  content: { messages: [], actions: [], quick_replies: [] },
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Rotas da LIA oferecidas após a qualificação.
const LIA_ROUTES: Array<{ title: string; payload: string }> = [
  { title: "🌐 Visitar o site", payload: "rota_site" },
  { title: "🛒 Ver produtos", payload: "rota_produtos" },
  { title: "🎓 Cursos", payload: "rota_cursos" },
  { title: "💬 Falar com especialista", payload: "rota_especialista" },
];

const SITE_URL = "https://www.smartdent.com.br";

type ReplyMeta = {
  state:
    | "ask_name"
    | "ask_email"
    | "ask_phone"
    | "ask_product"
    | "ask_product_model"
    | "ask_area"
    | "ask_specialty"
    | "completed"
    | "handoff"
    | "error"
    | "idle";
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  lead_product?: string | null;
  lead_area?: string | null;
  lead_specialty?: string | null;
};

function buildReply(text: string, meta: ReplyMeta) {
  return {
    version: "v2",
    reply: text || "",
    lead_name: meta.lead_name || "",
    lead_email: meta.lead_email || "",
    lead_phone: meta.lead_phone || "",
    lead_product: meta.lead_product || "",
    lead_area: meta.lead_area || "",
    lead_specialty: meta.lead_specialty || "",
    qualification_state: meta.state,
    content: {
      messages: text ? [{ type: "text", text }] : [],
      actions: [],
      quick_replies: [],
    },
  };
}

function textReply(text: string, meta: ReplyMeta = { state: "idle" }) {
  return buildReply(text, meta);
}

function replyWithRoutes(greeting: string, meta: ReplyMeta) {
  const routesText = [
    "",
    "Escolha uma opção respondendo o número:",
    `1) 🌐 Site: ${SITE_URL}`,
    "2) 🛒 Ver produtos",
    "3) 🎓 Cursos",
    "4) 💬 Falar com especialista",
  ].join("\n");
  const fullText = `${greeting}\n${routesText}`;
  const payload = buildReply(fullText, { ...meta, state: "completed" });
  // Mantém quick_replies/buttons para clientes Dynamic Block (não usados pelo
  // "Enviar Mensagem" simples, mas inofensivos).
  payload.content.messages = [
    {
      type: "text",
      text: fullText,
      // @ts-ignore - extra fields aceitos pelo Dynamic Block
      buttons: [{ type: "url", caption: "🌐 Visitar o site", url: SITE_URL }],
      quick_replies: LIA_ROUTES.map((r) => ({
        type: "node", caption: r.title, target: r.payload,
      })),
    },
  ];
  payload.content.quick_replies = LIA_ROUTES.map((r) => ({
    type: "node", caption: r.title, target: r.payload,
  })) as any;
  return payload;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logHealth(
  supabase: ReturnType<typeof createClient>,
  severity: "info" | "warn" | "error",
  errorType: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "manychat-lia-bridge",
      severity,
      error_type: errorType,
      details,
    });
  } catch (_) { /* noop */ }
}

function isValidName(s: string): boolean {
  const n = s.trim();
  if (n.length < 2) return false;
  const alpha = n.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return alpha.length >= 2;
}

function extractEmail(s: string): string | null {
  const m = s.replace(/\s*@\s*/g, "@").match(EMAIL_REGEX);
  return m ? m[0].toLowerCase() : null;
}

type LeadRow = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone_normalized: string | null;
  manychat_subscriber_id: string | null;
  produto_interesse_auto: string | null;
  produto_interesse_raw: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
};

async function findOrCreateLead(
  supabase: ReturnType<typeof createClient>,
  subscriberId: string,
  fallbackName: string,
): Promise<LeadRow> {
  const { data: existing } = await supabase
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, manychat_subscriber_id, produto_interesse_auto, produto_interesse_raw, area_atuacao, especialidade")
    .eq("manychat_subscriber_id", subscriberId)
    .is("merged_into", null)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing as LeadRow;

  const syntheticEmail = `mc_${subscriberId}@instagram.lead`;
  const initialName = fallbackName && fallbackName.trim().length >= 2
    ? fallbackName.trim()
    : "Lead Instagram";

  const { data: created, error } = await supabase
    .from("lia_attendances")
    .insert({
      nome: initialName,
      email: syntheticEmail,
      manychat_subscriber_id: subscriberId,
      manychat_collected_at: new Date().toISOString(),
      instagram: initialName,
      origem_primeiro_contato: "Instagram - autoatendimento",
      lead_status: "novo",
      crm_creation_blocked: true,
      source: "Instagram - autoatendimento",
    })
    .select("id, nome, email, telefone_normalized, manychat_subscriber_id, produto_interesse_auto, produto_interesse_raw, area_atuacao, especialidade")
    .maybeSingle();

  if (error || !created) {
    throw new Error(`failed to create lead: ${error?.message || "unknown"}`);
  }
  return created as LeadRow;
}

const LEAD_COLS = "id, nome, email, telefone_normalized, manychat_subscriber_id, produto_interesse_auto, produto_interesse_raw, area_atuacao, especialidade";

/**
 * Quando o e-mail/telefone capturado no ManyChat já pertence a outro lead
 * canônico (CDP), fundimos a duplicata gerada pelo bridge no canônico para
 * preservar histórico PipeRun/Omie/Ecommerce. Smart Merge append-only:
 * só preenche campos vazios no canônico; nunca sobrescreve dados existentes.
 */
async function mergeIntoCanonical(
  supabase: ReturnType<typeof createClient>,
  duplicate: LeadRow,
  matchedBy: "email" | "phone",
  value: string,
): Promise<LeadRow | null> {
  let query = supabase
    .from("lia_attendances")
    .select(LEAD_COLS + ", piperun_id, manychat_subscriber_id, instagram, manychat_collected_at")
    .is("merged_into", null)
    .neq("id", duplicate.id)
    .limit(5);
  query = matchedBy === "email"
    ? query.ilike("email", value)
    : query.eq("telefone_normalized", value);
  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) return null;

  // Prefer o canônico com piperun_id (mais antigo primeiro).
  const canonical = (candidates as Array<Record<string, unknown>>)
    .sort((a, b) => (b.piperun_id ? 1 : 0) - (a.piperun_id ? 1 : 0))[0];
  const canonicalId = canonical.id as string;

  // Smart Merge: só preenche campos NULL no canônico.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fillIfEmpty = (col: string, val: unknown) => {
    if (val == null || val === "") return;
    if (canonical[col] == null || canonical[col] === "") patch[col] = val;
  };
  fillIfEmpty("manychat_subscriber_id", duplicate.manychat_subscriber_id);
  fillIfEmpty("manychat_collected_at", new Date().toISOString());
  fillIfEmpty("instagram", duplicate.nome);
  fillIfEmpty("telefone_normalized", duplicate.telefone_normalized);
  fillIfEmpty("produto_interesse_auto", duplicate.produto_interesse_auto);
  fillIfEmpty("produto_interesse_raw", duplicate.produto_interesse_raw);
  fillIfEmpty("area_atuacao", duplicate.area_atuacao);
  fillIfEmpty("especialidade", duplicate.especialidade);

  await supabase.from("lia_attendances").update(patch).eq("id", canonicalId);

  // Marca duplicata como merged e libera o índice único do subscriber_id.
  await supabase.from("lia_attendances").update({
    merged_into: canonicalId,
    manychat_subscriber_id: null,
    updated_at: new Date().toISOString(),
  }).eq("id", duplicate.id);

  const { data: updated } = await supabase
    .from("lia_attendances")
    .select(LEAD_COLS)
    .eq("id", canonicalId)
    .maybeSingle();

  await supabase.from("system_health_logs").insert({
    function_name: "manychat-lia-bridge",
    severity: "info",
    error_type: "manychat_merged_into_canonical",
    lead_id: canonicalId,
    details: {
      from_lead_id: duplicate.id,
      to_lead_id: canonicalId,
      matched_by: matchedBy,
      value,
      subscriber_id: duplicate.manychat_subscriber_id,
    },
  });

  return (updated as LeadRow) || null;
}

function hasRealName(nome: string | null): boolean {
  if (!nome) return false;
  const n = nome.trim();
  if (n.length < 2) return false;
  if (/^lead\s+instagram$/i.test(n)) return false;
  return isValidName(n);
}

function hasRealEmail(email: string | null): boolean {
  if (!email) return false;
  if (email.endsWith("@manychat.internal")) return false;
  if (email.endsWith("@instagram.lead")) return false;
  return EMAIL_REGEX.test(email);
}

function hasRealPhone(phone: string | null): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15;
}

const PRODUCT_LABELS: Record<string, string> = {
  "1": "impressora_3d",
  "2": "scanner_intraoral",
  "3": "resinas",
  "4": "cursos",
};

function detectProductKeyword(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(scanner|medit|3shape|trios|itero|i700|i900)\b/.test(t)) return "scanner_intraoral";
  if (/\b(impressora|printer|anycubic|phrozen|sonic|miicraft|asiga|formlabs)\b/.test(t)) return "impressora_3d";
  if (/\b(resina|consum|wash|cure|lavadora|fotopolim)/.test(t)) return "resinas";
  if (/\b(curso|treinamento|aula|workshop|imers[aã]o)/.test(t)) return "cursos";
  return null;
}

function normalizeProductAnswer(raw: string): { label: string; canonical: string | null } {
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/^\s*([1-5])\b/);
  if (numMatch) {
    const n = numMatch[1];
    if (n === "5") return { label: trimmed, canonical: null };
    return { label: PRODUCT_LABELS[n], canonical: PRODUCT_LABELS[n] };
  }
  const kw = detectProductKeyword(trimmed);
  return { label: kw || trimmed, canonical: kw };
}

function hasProduct(p: string | null | undefined): boolean {
  return !!(p && p.trim().length >= 2);
}

function hasNonEmpty(v: string | null | undefined): boolean {
  return !!(v && v.trim().length >= 2);
}

const PRODUCT_DISPLAY: Record<string, string> = {
  impressora_3d: "🖨️ Impressora 3D",
  scanner_intraoral: "📷 Scanner intraoral",
  resinas: "🧪 Resinas e consumíveis",
  cursos: "🎓 Cursos e treinamentos",
};

const PRODUCT_MODELS: Record<string, string[]> = {
  impressora_3d: ["RayShape Edge Mini", "Elegoo Mars 5 Ultra", "Outra (descreva)"],
  scanner_intraoral: ["Scanner Medit", "Scanner BLZ", "Outro (descreva)"],
};

function productDisplayLabel(canonical: string | null | undefined, raw: string | null | undefined): string {
  if (canonical && PRODUCT_DISPLAY[canonical]) return PRODUCT_DISPLAY[canonical];
  const txt = (raw || canonical || "").trim();
  if (!txt) return "";
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function productCanonical(produtoAtual: string | null | undefined): string | null {
  if (!produtoAtual) return null;
  const v = produtoAtual.trim().toLowerCase();
  if (PRODUCT_DISPLAY[v]) return v;
  return null;
}

function needsProductModel(canonical: string | null): boolean {
  return !!(canonical && PRODUCT_MODELS[canonical]);
}

function resolveProductModel(canonical: string, raw: string): string | null {
  const list = PRODUCT_MODELS[canonical];
  if (!list) return null;
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/^\s*(\d{1,2})\b/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < list.length) {
      // Última opção é sempre "Outro (descreva)" → exige texto livre adicional
      if (idx === list.length - 1) {
        const extra = trimmed.replace(/^\s*\d{1,2}[\)\.\-:\s]*/, "").trim();
        return extra.length >= 2 ? extra : null;
      }
      return list[idx];
    }
  }
  // Texto livre ≥ 2 chars conta como modelo descrito
  return trimmed.length >= 2 ? trimmed : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(textReply("", { state: "idle" }), 200);
  }

  const subscriberId = String(body.subscriber_id ?? "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!subscriberId) {
    await logHealth(supabase, "warn", "missing_subscriber_id", { body });
    return jsonResponse(EMPTY_REPLY, 200);
  }

  const sessionId = `mc_${subscriberId}`;

  try {
    // 1. Carrega/cria lead canônico para este subscriber
    const lead = await findOrCreateLead(supabase, subscriberId, name);

    // 2. Carrega estado da sessão (qual campo estamos coletando)
    const { data: sess } = await supabase
      .from("agent_sessions")
      .select("extracted_entities")
      .eq("session_id", sessionId)
      .maybeSingle();
    const entities = (sess?.extracted_entities as Record<string, unknown>) || {};

    // Fonte de verdade combinada: DB + entidades da sessão (em caso de
    // conflito de email único no DB, mantemos o valor coletado em sessão).
    let nomeAtual = (entities.collected_name as string | undefined) || lead.nome;
    let emailAtual = (entities.collected_email as string | undefined) || lead.email;
    let phoneAtual = (entities.collected_phone as string | undefined) || lead.telefone_normalized;
    let produtoAtual = (entities.collected_product as string | undefined) || lead.produto_interesse_auto;
    let modeloAtual = (entities.collected_product_model as string | undefined) || null;
    let areaAtual = (entities.collected_area as string | undefined) || lead.area_atuacao;
    let especialidadeAtual = (entities.collected_specialty as string | undefined) || lead.especialidade;

    // Deriva canonical do produto + necessidade de submodelo
    const productCanon = productCanonical(produtoAtual);
    const productNeedsModel = needsProductModel(productCanon);
    // Se já houver "raw" salvo no formato "canonical | modelo", extrai
    if (!modeloAtual && lead.produto_interesse_raw && lead.produto_interesse_raw.includes("|")) {
      const parts = lead.produto_interesse_raw.split("|").map((p) => p.trim());
      if (parts.length >= 2 && parts[1].length >= 2) modeloAtual = parts[1];
    }

    // 3. Se mensagem é resposta a uma pergunta pendente, processa
    if (message) {
      // Só honra a flag se for o PRÓXIMO campo faltante na ordem nome→email→telefone→produto.
      const nextMissing:
        | "name" | "email" | "phone" | "product" | "product_model" | "area" | "specialty" | null =
        !hasRealName(nomeAtual) ? "name"
        : !hasRealEmail(emailAtual) ? "email"
        : !hasRealPhone(phoneAtual) ? "phone"
        : !hasProduct(produtoAtual) ? "product"
        : (productNeedsModel && !hasNonEmpty(modeloAtual)) ? "product_model"
        : !hasNonEmpty(areaAtual) ? "area"
        : !hasNonEmpty(especialidadeAtual) ? "specialty"
        : null;

      if (nextMissing === "name" && entities.awaiting_manychat_name) {
        if (isValidName(message)) {
          nomeAtual = message.trim();
          entities.collected_name = nomeAtual;
          await supabase.from("lia_attendances")
            .update({ nome: nomeAtual, instagram: nomeAtual, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
        }
      } else if (nextMissing === "email" && entities.awaiting_manychat_email) {
        const ext = extractEmail(message);
        if (ext) {
          emailAtual = ext;
          entities.collected_email = emailAtual;
          // Tenta atualizar; se conflito de unique, mantém o sintético
          const { error: upErr } = await supabase.from("lia_attendances")
            .update({ email: emailAtual, updated_at: new Date().toISOString() })
            .eq("id", lead.id);
          if (upErr) {
            await logHealth(supabase, "warn", "manychat_email_update_conflict", {
              subscriberId, error: upErr.message, attempted_email: emailAtual,
            });
            // mantém leitura local mesmo se DB não atualizou (provável duplicidade)
          }
        } else {
          await logHealth(supabase, "info", "manychat_invalid_email", { subscriberId, message });
          const retry = "Não consegui identificar um e-mail válido. Pode me enviar seu **e-mail** novamente? (ex: nome@exemplo.com)";
          await supabase.from("agent_sessions").upsert({
            session_id: sessionId,
            lead_id: lead.id,
            extracted_entities: { ...entities, awaiting_manychat_email: true },
            current_state: "qualifying",
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });
          return jsonResponse(textReply(retry, {
            state: "ask_email", lead_name: nomeAtual, lead_email: null, lead_phone: phoneAtual,
          }), 200);
        }
      } else if (nextMissing === "phone" && entities.awaiting_manychat_phone) {
        const normalized = normalizeBrazilianPhone(message);
        if (normalized) {
          phoneAtual = normalized;
          entities.collected_phone = phoneAtual;
          const { error: phErr } = await supabase.from("lia_attendances").update({
            telefone_normalized: phoneAtual,
            telefone_raw: message.trim(),
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (phErr) {
            await logHealth(supabase, "warn", "manychat_phone_update_conflict", {
              subscriberId, error: phErr.message,
            });
          }
        } else {
          await logHealth(supabase, "info", "manychat_invalid_phone", { subscriberId, message });
          const retry = "Não consegui identificar o número. Pode me enviar seu **celular com DDD**? (ex: 11 99999-8888)";
          await supabase.from("agent_sessions").upsert({
            session_id: sessionId,
            lead_id: lead.id,
            extracted_entities: { ...entities, awaiting_manychat_phone: true },
            current_state: "qualifying",
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });
          return jsonResponse(textReply(retry, {
            state: "ask_phone", lead_name: nomeAtual, lead_email: emailAtual, lead_phone: null,
          }), 200);
        }
      } else if (nextMissing === "product" && entities.awaiting_manychat_product) {
        const { label, canonical } = normalizeProductAnswer(message);
        if (label && label.trim().length >= 2) {
          produtoAtual = label;
          entities.collected_product = produtoAtual;
          const { error: prErr } = await supabase.from("lia_attendances").update({
            produto_interesse_auto: canonical || label,
            produto_interesse_raw: message.trim(),
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (prErr) {
            await logHealth(supabase, "warn", "manychat_product_update_conflict", {
              subscriberId, error: prErr.message,
            });
          }
          await logHealth(supabase, "info", "manychat_product_captured", {
            subscriberId, label, canonical, raw: message.trim(),
          });
        } else {
          await logHealth(supabase, "info", "manychat_invalid_product", { subscriberId, message });
        }
      } else if (nextMissing === "product_model" && entities.awaiting_manychat_product_model) {
        const canon = productCanonical(produtoAtual);
        const modelo = canon ? resolveProductModel(canon, message) : null;
        if (modelo) {
          modeloAtual = modelo;
          entities.collected_product_model = modelo;
          const rawCombined = `${canon} | ${modelo}`;
          const { error: mdErr } = await supabase.from("lia_attendances").update({
            produto_interesse_raw: rawCombined,
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (mdErr) {
            await logHealth(supabase, "warn", "manychat_product_model_update_conflict", {
              subscriberId, error: mdErr.message,
            });
          }
          await logHealth(supabase, "info", "manychat_product_model_captured", {
            subscriberId, canonical: canon, modelo, raw: message.trim(),
          });
        } else {
          await logHealth(supabase, "info", "manychat_invalid_product_model", { subscriberId, message });
        }
      } else if (nextMissing === "area" && entities.awaiting_manychat_area) {
        const opt = resolveTaxonomyAnswer(AREA_ATUACAO_OPTIONS, message);
        if (opt) {
          areaAtual = opt.value;
          entities.collected_area = areaAtual;
          const { error: arErr } = await supabase.from("lia_attendances").update({
            area_atuacao: areaAtual,
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (arErr) {
            await logHealth(supabase, "warn", "manychat_area_update_conflict", {
              subscriberId, error: arErr.message,
            });
          }
          await logHealth(supabase, "info", "manychat_area_captured", {
            subscriberId, value: areaAtual, raw: message.trim(),
          });
        } else {
          await logHealth(supabase, "info", "manychat_invalid_area", { subscriberId, message });
        }
      } else if (nextMissing === "specialty" && entities.awaiting_manychat_specialty) {
        const opt = resolveTaxonomyAnswer(ESPECIALIDADE_OPTIONS, message);
        if (opt) {
          especialidadeAtual = opt.value;
          entities.collected_specialty = especialidadeAtual;
          const { error: spErr } = await supabase.from("lia_attendances").update({
            especialidade: especialidadeAtual,
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          if (spErr) {
            await logHealth(supabase, "warn", "manychat_specialty_update_conflict", {
              subscriberId, error: spErr.message,
            });
          }
          await logHealth(supabase, "info", "manychat_specialty_captured", {
            subscriberId, value: especialidadeAtual, raw: message.trim(),
          });
        } else {
          await logHealth(supabase, "info", "manychat_invalid_specialty", { subscriberId, message });
        }
      }
      // Se a flag não bate com o nextMissing (sessão obsoleta), apenas cai
      // para o passo 4, que vai perguntar o campo correto.
    }

    // 4. Determina próxima pergunta com base no que ainda falta
    const missingName = !hasRealName(nomeAtual);
    const missingEmail = !hasRealEmail(emailAtual);
    const missingPhone = !hasRealPhone(phoneAtual);
    const missingProduct = !hasProduct(produtoAtual);
    const productCanonNow = productCanonical(produtoAtual);
    const missingProductModel = needsProductModel(productCanonNow) && !hasNonEmpty(modeloAtual);
    const missingArea = !hasNonEmpty(areaAtual);
    const missingSpecialty = !hasNonEmpty(especialidadeAtual);

    if (missingName) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: true,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_name", { subscriberId });
      return jsonResponse(textReply(
        "Olá! 👋 Sou a Dra. LIA da Smart Dent.\nPara te atender melhor, qual é o seu **nome completo**?",
        { state: "ask_name" },
      ), 200);
    }

    if (missingEmail) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: true,
          awaiting_manychat_phone: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_email", { subscriberId });
      const firstName = (nomeAtual || "").split(/\s+/)[0];
      return jsonResponse(textReply(
        `Obrigado, ${firstName}! Qual é o seu **melhor e-mail**?`,
        { state: "ask_email", lead_name: nomeAtual },
      ), 200);
    }

    if (missingPhone) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: true,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_phone", { subscriberId });
      return jsonResponse(textReply(
        "Perfeito! Agora me envie seu **celular com DDD** (ex: 11 99999-8888).",
        { state: "ask_phone", lead_name: nomeAtual, lead_email: emailAtual },
      ), 200);
    }

    if (missingProduct) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
          awaiting_manychat_product: true,
          awaiting_manychat_product_model: false,
          awaiting_manychat_area: false,
          awaiting_manychat_specialty: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_product", { subscriberId });
      const firstName = (nomeAtual || "").split(/\s+/)[0];
      const askProductText = [
        `Para te ajudar melhor, ${firstName}, qual produto/tema te interessa mais agora?`,
        "",
        "1) 🖨️ Impressora 3D",
        "2) 📷 Scanner intraoral",
        "3) 🧪 Resinas e consumíveis",
        "4) 🎓 Cursos e treinamentos",
        "5) 💬 Outro (descreva em uma frase)",
      ].join("\n");
      return jsonResponse(textReply(askProductText, {
        state: "ask_product",
        lead_name: nomeAtual,
        lead_email: emailAtual,
        lead_phone: phoneAtual,
      }), 200);
    }

    if (missingProductModel && productCanonNow) {
      const list = PRODUCT_MODELS[productCanonNow];
      const display = PRODUCT_DISPLAY[productCanonNow];
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          lead_product: produtoAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
          awaiting_manychat_product: false,
          awaiting_manychat_product_model: true,
          awaiting_manychat_area: false,
          awaiting_manychat_specialty: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_product_model", {
        subscriberId, canonical: productCanonNow,
      });
      const askModelText = [
        `Anotado: ${display} ✅`,
        "Qual modelo te interessa mais?",
        ...list.map((m, i) => `${i + 1}) ${m}`),
      ].join("\n");
      return jsonResponse(textReply(askModelText, {
        state: "ask_product_model",
        lead_name: nomeAtual,
        lead_email: emailAtual,
        lead_phone: phoneAtual,
        lead_product: produtoAtual,
      }), 200);
    }

    if (missingArea) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          lead_product: produtoAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
          awaiting_manychat_product: false,
          awaiting_manychat_product_model: false,
          awaiting_manychat_area: true,
          awaiting_manychat_specialty: false,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_area", { subscriberId });
      const justChoseModel = !!entities.awaiting_manychat_product_model;
      const justChoseProduct = !!entities.awaiting_manychat_product && !justChoseModel;
      const prefix = justChoseModel && modeloAtual
        ? `Anotado: ${modeloAtual} ✅\n`
        : justChoseProduct && productCanonNow
          ? `Anotado: ${PRODUCT_DISPLAY[productCanonNow]} ✅\n`
          : "";
      const askAreaText = [
        `${prefix}Para te direcionar melhor, qual é a sua **área de atuação**?`,
        "",
        renderNumberedList(AREA_ATUACAO_OPTIONS),
      ].join("\n");
      return jsonResponse(textReply(askAreaText, {
        state: "ask_area",
        lead_name: nomeAtual,
        lead_email: emailAtual,
        lead_phone: phoneAtual,
        lead_product: produtoAtual,
      }), 200);
    }

    if (missingSpecialty) {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        lead_id: lead.id,
        extracted_entities: {
          ...entities,
          lead_name: nomeAtual,
          lead_email: emailAtual,
          lead_product: produtoAtual,
          lead_area: areaAtual,
          manychat_subscriber_id: subscriberId,
          awaiting_manychat_name: false,
          awaiting_manychat_email: false,
          awaiting_manychat_phone: false,
          awaiting_manychat_product: false,
          awaiting_manychat_product_model: false,
          awaiting_manychat_area: false,
          awaiting_manychat_specialty: true,
        },
        current_state: "qualifying",
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      await logHealth(supabase, "info", "manychat_ask_specialty", { subscriberId });
      const justChoseArea = !!entities.awaiting_manychat_area;
      const prefix = justChoseArea && areaAtual ? `Anotado: ${areaAtual} ✅\n` : "";
      const askSpecText = [
        `${prefix}E qual é a sua **especialidade**?`,
        "",
        renderNumberedList(ESPECIALIDADE_OPTIONS),
      ].join("\n");
      return jsonResponse(textReply(askSpecText, {
        state: "ask_specialty",
        lead_name: nomeAtual,
        lead_email: emailAtual,
        lead_phone: phoneAtual,
        lead_product: produtoAtual,
        lead_area: areaAtual,
      }), 200);
    }

    // 5. Perfil completo → dispara mesmo pipeline dos forms (ingest → PipeRun)
    //    e responde mensagem única de handoff. Idempotente: só dispara 1x.
    const firstName = (nomeAtual || "").split(/\s+/)[0];
    const handoffMessage = [
      `Perfeito, ${firstName}! ✅`,
      "Recebi suas informações.",
      "Em instantes alguém do nosso time vai te chamar no WhatsApp. 📱",
    ].join("\n");

    const alreadyDispatched = entities.handoff_dispatched === true;
    if (!alreadyDispatched) {
      const ingestPayload = {
        source: "instagram_manychat_autoatendimento",
        form_name: "Instagram - Autoatendimento ManyChat",
        form_purpose: "qualificacao_inbound",
        commercial_override: true,
        origem_primeiro_contato: "Instagram - autoatendimento",
        nome: nomeAtual,
        email: emailAtual,
        telefone: phoneAtual,
        whatsapp: phoneAtual,
        area_atuacao: areaAtual,
        especialidade: especialidadeAtual,
        produto_interesse_auto: productCanonNow,
        produto_interesse_raw: lead.produto_interesse_raw,
        modelo_interesse: modeloAtual,
        manychat_subscriber_id: subscriberId,
        lia_attendance_id: lead.id,
        platform_lead_id: `mc_${subscriberId}`,
      };
      try {
        const { error: ingErr } = await supabase.functions.invoke(
          "smart-ops-ingest-lead",
          { body: ingestPayload },
        );
        if (ingErr) {
          await logHealth(supabase, "error", "manychat_handoff_error", {
            subscriberId, lead_id: lead.id, error: ingErr.message,
          });
        } else {
          await logHealth(supabase, "info", "manychat_handoff_dispatched", {
            subscriberId, lead_id: lead.id, product: productCanonNow,
          });
        }
      } catch (e) {
        await logHealth(supabase, "error", "manychat_handoff_error", {
          subscriberId, lead_id: lead.id, error: (e as Error).message,
        });
      }
    } else {
      await logHealth(supabase, "info", "manychat_handoff_replay", {
        subscriberId, lead_id: lead.id,
      });
    }

    await supabase.from("agent_sessions").upsert({
      session_id: sessionId,
      lead_id: lead.id,
      extracted_entities: {
        ...entities,
        lead_id: lead.id,
        lead_name: nomeAtual,
        lead_email: emailAtual,
        lead_product: produtoAtual,
        lead_product_model: modeloAtual,
        lead_area: areaAtual,
        lead_specialty: especialidadeAtual,
        manychat_subscriber_id: subscriberId,
        channel: "Instagram - autoatendimento",
        awaiting_manychat_name: false,
        awaiting_manychat_email: false,
        awaiting_manychat_phone: false,
        awaiting_manychat_product: false,
        awaiting_manychat_product_model: false,
        awaiting_manychat_area: false,
        awaiting_manychat_specialty: false,
        handoff_dispatched: true,
        handoff_at: alreadyDispatched
          ? (entities.handoff_at as string | undefined) || new Date().toISOString()
          : new Date().toISOString(),
      },
      current_state: "handoff",
      last_activity_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

    return jsonResponse(textReply(handoffMessage, {
      state: "handoff",
      lead_name: nomeAtual,
      lead_email: emailAtual,
      lead_phone: phoneAtual,
      lead_product: produtoAtual,
    }), 200);
  } catch (err) {
    await logHealth(supabase, "error", "manychat_bridge_error", {
      subscriberId,
      error: (err as Error).message,
    });
    return jsonResponse(textReply(
      "Tive um probleminha agora. Pode me chamar novamente em instantes?",
      { state: "error" },
    ), 200);
  }
});

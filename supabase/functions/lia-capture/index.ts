// @ts-nocheck
// LIA de captura (landing pages SDR e links de campanha).
// Fluxo roteirizado: identifica o lead (telefone → e-mail), cria no CRM pelo
// mesmo caminho dos formulários (smart-ops-ingest-lead), grava as respostas de
// qualificação e devolve o cartão do vendedor designado.
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";
import { buildKnownAnswers, filterPending, hasAnswer, normLabel } from "./qualification.ts";
import { syncFormNote } from "../_shared/form-note-sync.ts";
import { resolveFormProduct } from "../_shared/form-product.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import { buildProductSummary, buildModulesSummary } from "./product-summary.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const IDENTITY_COLS = new Set(["nome", "email", "telefone_raw"]);
const ANSWER_COLS = new Set([
  "area_atuacao", "especialidade", "tem_scanner", "equip_scanner", "impressora_modelo",
  "imprime_modelos", "imprime_placas", "imprime_guias", "imprime_resinas_ld",
  "sdr_software_cad_interesse", "equip_pos_impressao", "cidade", "uf", "instagram",
]);
const FALLBACK_WA = "5516993831794";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
function normPhone(v: unknown) {
  return digits(normalizeBrazilianPhone(str(v, 40)));
}
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Nomes provisórios ("Nome não informado", "Sem nome", "Lead") não contam como nome real.
const realName = (v: unknown) => { const n = str(v, 120); return !n || /^(nome( n[ãa]o informado)?|sem nome|n[ãa]o informado|lead|cliente|desconhecido|-+)$/i.test(n) ? "" : n; };
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function whatsappGroupUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === "chat.whatsapp.com" && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

async function sign(leadId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("lia-capture:" + leadId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
async function checkToken(leadId: unknown, token: unknown) {
  return isUuid(leadId) && typeof token === "string" && token === (await sign(leadId as string));
}

async function resolveContext(body: any) {
  const formId = isUuid(body.form_id) ? body.form_id : null;
  const campaignSlug = str(body.campaign, 80) || null;
  let product = str(body.product, 160);
  let opening = "";
  let campaignName = "";
  let formName = "";
  let productSummary: string | null = null;
  let modulesSummary: string | null = null;
  let groupUrl: string | null = null;
  if (campaignSlug) {
    const { data: c } = await sb.from("campaigns").select("nome, lia_opening_message, lia_product_name").ilike("lia_slug", campaignSlug).maybeSingle();
    if (c) {
      campaignName = c.nome ?? "";
      product = product || c.lia_product_name || "";
      opening = c.lia_opening_message ?? "";
    }
  }
  if (formId) {
    const linkedProduct = await resolveFormProduct(sb, {
      source: "form", form_id: formId, product_catalog_id: body.product_catalog_id, product,
    });
    if (linkedProduct) product = linkedProduct.name;
    const { data: f } = await sb.from("smartops_forms").select("name, subtitle, description, extra_sections, product_catalog_id, capture_buttons_enabled, capture_buttons, success_redirect_url").eq("id", formId).maybeSingle();
    formName = f?.name ?? "";
    groupUrl = whatsappGroupUrl(f?.success_redirect_url);
    let boundProduct = "";
    if (f?.product_catalog_id) {
      const { data: p } = await sb.from("system_a_catalog").select("name").eq("id", f.product_catalog_id).maybeSingle();
      boundProduct = p?.name ?? "";
      product = product || boundProduct;
    }
    // A selected button must not inherit another product's claims.
    if (boundProduct && product.toLowerCase() === boundProduct.toLowerCase()) {
      const { data: landing, error } = await sb.from("smartops_form_landing_pages").select("content")
        .eq("form_id", formId).eq("status", "published").limit(1).maybeSingle();
      if (error) console.warn("[lia-capture] summary unavailable", error.code);
      productSummary = buildProductSummary(product, landing?.content);
      modulesSummary = buildModulesSummary(landing?.content);
    }
  }
  const label = product || campaignName || formName || "Smart Dent";
  const origin = campaignSlug && !formId ? `# CHAT - Campanha - ${campaignName || campaignSlug}` : `# CHAT - Landing - ${label}`;
  opening = `Vamos lá, vou te mandar todas as informações sobre o ${label}. Qual é o seu telefone de contato?`;

  // Perguntas de qualificação: do formulário de origem ou de um formulário de captação padrão
  let qFormId = formId;
  const loadFields = async (id: string) => {
    const { data } = await sb.from("smartops_form_fields")
      .select("id, label, db_column, custom_field_name, field_type, options, order_index, conditions")
      .eq("form_id", id).order("order_index");
    return data ?? [];
  };
  let fields = qFormId ? await loadFields(qFormId) : [];
  if (!qFormId) {
    const { data: tpl } = await sb.from("smartops_forms").select("id").eq("slug", "exocad_dentalcad_rms").eq("active", true).maybeSingle();
    if (tpl?.id) { qFormId = tpl.id; fields = await loadFields(tpl.id); }
  }
  const questions = fields.filter((f: any) => !IDENTITY_COLS.has(f.db_column)).map((f: any) => ({
    id: f.id,
    conditions: f.conditions,
    field_type: f.field_type,
    field_id: f.id,
    form_id: qFormId,
    db_column: f.db_column,
    custom_field_name: f.custom_field_name,
    label: String(f.label).trim(),
    options: Array.isArray(f.options) ? f.options.map((o: any) => (typeof o === "string" ? o : o?.label ?? o?.value)).filter(Boolean) : [],
  }));
  const areaIndex = questions.findIndex((q: any) => q.db_column === "area_atuacao");
  const area = areaIndex >= 0 ? questions.splice(areaIndex, 1)[0] : {
    id: "area_atuacao", conditions: null, field_id: null, form_id: null, db_column: "area_atuacao", options: ["CLÍNICA OU CONSULTÓRIO", "LABORATÓRIO DE PRÓTESE", "RADIOLOGIA ODONTOLÓGICA", "PLANNING CENTER", "EMPRESA DE ALINHADORES", "GESTOR DE REDE DE CLÍNICAS", "GESTOR DE FRANQUIAS", "CENTRAL DE IMPRESSÕES", "EDUCAÇÃO"],
  };
  if (qFormId) {
    if (areaIndex >= 0) questions.splice(areaIndex, 0, area);
  } else questions.unshift({ ...area, label: "Me diz, qual é a sua área de atuação? Assim eu entendo exatamente como essa solução pode ser aplicada ao seu dia a dia." });
  for (const question of questions) {
    if (!question.options.length && question.db_column === "area_atuacao") question.options = ["CLÍNICA OU CONSULTÓRIO", "LABORATÓRIO DE PRÓTESE", "RADIOLOGIA ODONTOLÓGICA", "PLANNING CENTER", "EMPRESA DE ALINHADORES", "GESTOR DE REDE DE CLÍNICAS", "GESTOR DE FRANQUIAS", "CENTRAL DE IMPRESSÕES", "EDUCAÇÃO"];
    if (!question.options.length && question.db_column === "especialidade") question.options = ["CLÍNICO GERAL", "DENTÍSTICA", "IMPLANTODONTISTA", "PROTESISTA", "ORTODONTISTA", "ODONTOPEDIATRIA", "PERIODONTISTA", "ENDODONTISTA", "RADIOLOGISTA", "CIRURGIA BUCO MAXILO FACIAL", "TÉCNICO EM RADIOLOGIA", "TÉCNICO EM PRÓTESE ODONTOLÓGICA", "OUTROS"];
  }
  if (!qFormId && !questions.some((q: any) => q.db_column === "especialidade")) questions.splice(1, 0, {
    id: "especialidade", conditions: null, field_id: null, form_id: null, db_column: "especialidade",
    label: "E qual é a sua especialidade?", options: ["CLÍNICO GERAL", "DENTÍSTICA", "IMPLANTODONTISTA", "PROTESISTA", "ORTODONTISTA", "ODONTOPEDIATRIA", "PERIODONTISTA", "ENDODONTISTA", "RADIOLOGISTA", "CIRURGIA BUCO MAXILO FACIAL", "TÉCNICO EM RADIOLOGIA", "TÉCNICO EM PRÓTESE ODONTOLÓGICA", "OUTROS"],
  });
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia!" : hour < 18 ? "Boa tarde!" : "Boa noite!";
  return { form_id: formId, campaign: campaignSlug, product, origin, opening, greeting, questions, product_summary: productSummary, modules_summary: modulesSummary, whatsapp_group_url: groupUrl, qualification_form_id: qFormId, fields };
}

const validEmail = (v: unknown) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? "")) && !/@(no-email|placeholder|example|test)\b/i.test(String(v));
async function pendingQuestions(leadId: string, body: any) {
  const ctx = await resolveContext(body);
  // Read the canonical profile internally; only pending question definitions leave this endpoint.
  const { data, error } = await sb.from("lia_attendances").select("*")
    .eq("id", leadId).is("merged_into", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("canonical lead not found");
  const profile = data as unknown as Record<string, unknown>;
  // Respostas anteriores do lead em QUALQUER formulário (sistema, timeline e snapshots), para não repetir perguntas.
  const [{ data: rows, error: historyError }, { data: timeline }] = await Promise.all([
    sb.from("smartops_form_field_responses")
      .select("field_id, field_label, value, field:smartops_form_fields(db_column, custom_field_name, label)").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1000),
    sb.from("lead_activity_log").select("event_data").eq("lead_id", leadId).eq("event_type", "form_response")
      .order("event_timestamp", { ascending: false }).limit(500),
  ]);
  if (historyError) throw historyError;
  const history: any[] = rows ?? [];
  const labelAnswers = new Map<string, unknown>();
  const addLabel = (label: unknown, value: unknown) => {
    const k = normLabel(label);
    if (k && hasAnswer(value) && !labelAnswers.has(k) && !/^nome n[aã]o informado$/i.test(String(value))) labelAnswers.set(k, value);
  };
  for (const r of history) addLabel(r.field_label ?? r.field?.label, r.value);
  for (const t of timeline ?? []) addLabel((t as any).event_data?.label, (t as any).event_data?.value);
  const formData = (profile.form_data ?? {}) as Record<string, any>;
  for (const bucket of Object.values(formData)) {
    const snaps = Array.isArray(bucket) ? [...bucket].reverse() : [bucket];
    for (const s of snaps) for (const r of Array.isArray(s?.responses) ? s.responses : []) addLabel(r?.label, r?.value);
  }
  return filterPending(ctx.questions, buildKnownAnswers(ctx.fields, profile, history, labelAnswers));
}
function maskEmail(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  const dot = domain.lastIndexOf(".");
  return `${local.slice(0, 2)}***@${domain.slice(0, 1)}***${dot >= 0 ? domain.slice(dot) : ""}`;
}
async function findLead(phone: string, email: string) {
  if (phone) {
    const { data, error, count } = await sb.from("lia_attendances").select("nome, email", { count: "exact" }).is("merged_into", null)
      .in("telefone_normalized", [`+${phone}`, phone, ...(phone.startsWith("55") ? [phone.slice(2)] : [])]).limit(20);
    if (error) throw error;
    if (data?.length === 1 && !email) return data[0];
    if ((count ?? 0) > 1 && !email) {
      const names = (data ?? []).map((row) => String(row.nome ?? "").trim().split(/\s+/)[0]);
      const commonName = count === data?.length && names[0] && names.every((name) => name.toLowerCase() === names[0].toLowerCase()) ? names[0] : null;
      return {
        ambiguous: true, nome: commonName, email: null, match_count: count,
        email_hints: [...new Set((data ?? []).filter((row) => validEmail(row.email)).map((row) => maskEmail(String(row.email))))],
      };
    }
    if (data?.length === 1 && email && data[0].email?.toLowerCase() === email) return data[0];
  }
  if (validEmail(email)) {
    const { data, error } = await sb.from("lia_attendances").select("nome, email").is("merged_into", null)
      .eq("email", email).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }
  return null;
}

// Gancho curto e humano montado com o que já sabemos do lead (perfil + respostas).
// Nunca expõe dados sensíveis; só ecoa o que o próprio lead informou.
function personalHook(lead: Record<string, unknown>, product: string, productSummary?: string | null, seed = "", history?: { bought: string[]; quoted: string[]; courses?: string[]; orders?: string[]; event?: string | null }): string | null {
  // Valores genéricos/negativos do formulário (ex.: "OUTRAS", "Não, ainda não digitalizo") nunca entram no texto.
  const generic = (raw: string) => !raw || /^(outras?|outros?|nenhum[as]?|sem resposta|n\/?d|-+|—+)$/i.test(raw) || /^n[ãa]o\b/i.test(raw);
  const area = str(lead.area_atuacao, 80).trim();
  const esp = str(lead.especialidade, 80).trim();
  const impressora = str(lead.impressora_modelo, 80).trim();
  const scanner = str(lead.equip_scanner, 80).trim();
  const cad = str(lead.sdr_software_cad_interesse, 80).trim();
  const prints: string[] = [];
  if (lead.imprime_modelos === true || lead.imprime_modelos === "true") prints.push("modelos");
  if (lead.imprime_placas === true || lead.imprime_placas === "true") prints.push("placas");
  if (lead.imprime_guias === true || lead.imprime_guias === "true") prints.push("guias cirúrgicos");
  if (lead.imprime_resinas_ld === true || lead.imprime_resinas_ld === "true") prints.push("resinas de longa duração");
  const areaOk = !generic(area);
  const espOk = !generic(esp);
  const cap = (t: string) => t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const clean = (n: string) => n.replace(/^treinamento (finalizado|agendado)\s*\(?/i, "").replace(/\)$/, "").replace(/\s+/g, " ").trim();
  const productLowerName = (product || "").toLowerCase();
  const notCurrent = (name: string) => name && !productLowerName.includes(name.toLowerCase()) && !name.toLowerCase().includes(productLowerName || "\0");
  const bought = (history?.bought ?? []).filter(notCurrent);
  const orders = (history?.orders ?? []).filter(notCurrent);
  const courses = (history?.courses ?? []).map(clean).filter(Boolean);
  const event = history?.event ? String(history.event).replace(/^#\s*-?\s*/, "").trim() : "";
  // Equipamento que a Smart Dent vende/apoia = relação já existente com a empresa.
  const ownBrand = /rayshape|miicraft|blz|smart ?print|edge mini|medit/i;
  const printerOk = !generic(impressora);
  const ourPrinter = printerOk && ownBrand.test(impressora);
  const p = product || "esse próximo passo";
  const variants = (opts: string[]) => { let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return opts[h % opts.length]; };

  // Maturidade digital: já é da casa (curso, compra, equipamento nosso) → fala de evolução, não de apresentação.
  const relation: string[] = [];
  if (ourPrinter) relation.push(`a sua ${cap(impressora)}`);
  else if (bought.length) relation.push(bought[0]);
  if (courses.length) relation.push(courses.length > 1 ? "os nossos treinamentos" : `o treinamento de ${courses[0]}`);
  else if (orders.length && relation.length < 2) relation.push("as nossas resinas");
  let text: string;
  if (relation.length) {
    const rel = relation.join(" e ");
    text = variants([
      `Você já tem o fluxo de impressão rodando com ${rel}, então não precisa começar do zero. O ${p} é o passo que completa esse fluxo e coloca o desenho na sua mão.`,
      `Com ${rel}, você já domina a parte da produção. Agora o ${p} entra para você ganhar autonomia no planejamento, sem depender de terceiros.`,
      `Quem já trabalha com ${rel} costuma sentir falta justamente de ter o desenho em casa — e é isso que o ${p} resolve.`,
    ]);
  } else if (event) {
    text = `Que bom te reencontrar depois do ${event}! O ${p} é um ótimo próximo passo para levar o digital para dentro da sua rotina.`;
  } else {
    const who = areaOk && espOk && area.toLowerCase() !== esp.toLowerCase() ? `${esp.toLowerCase()} em ${area.toLowerCase()}` : espOk ? esp.toLowerCase() : areaOk ? `quem atua em ${area.toLowerCase()}` : "";
    const tech = printerOk ? ` e já trabalha com a ${cap(impressora)}` : !generic(scanner) ? ` e já digitaliza com o ${scanner}` : "";
    if (!who && !tech) return null;
    text = who ? `Para ${who}${tech}, o ${p} faz muito sentido no dia a dia.` : `Como você${tech.replace(/^ e/, "")}, o ${p} faz muito sentido no dia a dia.`;
  }
  void cad; void prints;
  return `${text} O especialista já vai te chamar com tudo pronto. 😉`;
}

async function sellerCard(leadId: string, body: any) {
  const { data: lead } = await sb.from("lia_attendances")
    .select("nome, proprietario_lead_crm, piperun_owner_id, produto_interesse, produto_interesse_auto, area_atuacao, especialidade, impressora_modelo, equip_scanner, sdr_software_cad_interesse, imprime_modelos, imprime_placas, imprime_guias, imprime_resinas_ld")
    .eq("id", leadId).is("merged_into", null).maybeSingle();
  if (!lead) return { ready: false };
  const ctx = await resolveContext(body ?? {}).catch(() => null);
  const { data: deal } = await sb.from("deals").select("piperun_deal_id, owner_name")
    .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  // Histórico de produtos do lead (negócios ganhos = cliente; demais = já cotou).
  const { data: leadDeals } = await sb.from("deals").select("id, status")
    .eq("lead_id", leadId).limit(50);
  const dealIds = (leadDeals ?? []).map((d: any) => d.id);
  const wonIds = new Set((leadDeals ?? []).filter((d: any) => /won|ganh/i.test(String(d.status ?? ""))).map((d: any) => d.id));
  const bought: string[] = [];
  const quoted: string[] = [];
  if (dealIds.length) {
    const { data: items } = await sb.from("deal_items").select("deal_id, product_name, total_value")
      .in("deal_id", dealIds).limit(200);
    const seen = new Set<string>();
    for (const item of items ?? []) {
      const name = String((item as any).product_name ?? "").trim();
      // Ignora brindes/itens de R$0 (treinamento, suporte, instalação) e duplicados.
      if (!name || Number((item as any).total_value ?? 0) <= 0) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (wonIds.has((item as any).deal_id) ? bought : quoted).push(name);
    }
  }
  // Fatos mais recentes da timeline (só o que realmente aconteceu).
  const { data: tl } = await sb.from("lead_activity_log").select("event_type, entity_name, event_data")
    .eq("lead_id", leadId).in("event_type", ["treinamento_finalizado", "treinamento_agendado", "astron_course_progress", "ecommerce_order_paid", "ecommerce_order_invoiced", "form_submission"])
    .order("event_timestamp", { ascending: false }).limit(200);
  const courses: string[] = []; const orders: string[] = []; let event: string | null = null;
  const pushU = (arr: string[], v: unknown) => { const n = String(v ?? "").replace(/\s+/g, " ").trim(); if (n && !arr.some((a) => a.toLowerCase() === n.toLowerCase())) arr.push(n); };
  for (const r of tl ?? []) {
    const d: any = (r as any).event_data ?? {};
    if (r.event_type === "treinamento_finalizado" || r.event_type === "treinamento_agendado") pushU(courses, d.course_name ?? r.entity_name);
    else if (r.event_type === "astron_course_progress" && Number(d.percentage ?? 0) >= 50) pushU(courses, d.course_name ?? r.entity_name);
    else if (r.event_type.startsWith("ecommerce_order")) for (const it of Array.isArray(d.itens) ? d.itens : []) pushU(orders, it?.nome);
    else if (r.event_type === "form_submission" && !event) {
      const ev = String(d.evento ?? "").trim();
      const fn = String(d.form_name ?? "").replace(/^#\s*-?\s*/, "").trim();
      if (ev) event = ev; else if (/congresso|feira|expo|evento|ciosp|semin/i.test(fn)) event = fn;
    }
  }
  let member: any = null;
  if (lead.piperun_owner_id) {
    const { data } = await sb.from("team_members").select("nome_completo, photo_url, whatsapp_number").eq("piperun_owner_id", lead.piperun_owner_id).limit(1).maybeSingle();
    member = data;
  }
  const ownerName = member?.nome_completo || lead.proprietario_lead_crm || deal?.owner_name || "";
  if (!member && ownerName) {
    const { data } = await sb.from("team_members").select("nome_completo, photo_url, whatsapp_number").ilike("nome_completo", ownerName).limit(1).maybeSingle();
    member = data;
  }
  if (!ownerName || /distribuidor/i.test(ownerName)) return { ready: false };
  const first = ownerName.split(" ")[0];
  const product = ctx?.product || lead.produto_interesse || lead.produto_interesse_auto || "seus produtos";
  const dealId = deal?.piperun_deal_id ? String(deal.piperun_deal_id) : "";
  const phone = normPhone(member?.whatsapp_number) || FALLBACK_WA;
  const text = `Olá ${first}, quero saber mais sobre o ${product}, e meu atendimento já foi registrado com número ${dealId || leadId.slice(0, 8)}`;
  return {
    ready: true,
    seller_name: ownerName,
    seller_first_name: first,
    lead_first_name: realName(lead.nome).split(/\s+/)[0] || null,
    photo_url: member?.photo_url ?? null,
    deal_id: dealId || null,
    wa_url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
    hook: personalHook(lead as Record<string, unknown>, product, ctx?.product_summary, leadId, { bought, quoted, courses, orders, event }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const action = str(body?.action, 20);

  try {
    if (action === "context") return json(await resolveContext(body));

    if (action === "lookup") {
      const phone = normPhone(body.phone);
      const email = str(body.email, 200).toLowerCase();
      const row = await findLead(phone, email);
      return json({ found: !!row && !("ambiguous" in row), ambiguous: !!row && "ambiguous" in row, first_name: realName(row?.nome) ? realName(row?.nome).split(" ")[0] : null, has_email: validEmail(row?.email), has_name: !!realName(row?.nome),
        ...(row && "ambiguous" in row ? { match_count: row.match_count, email_hints: row.email_hints } : {}),
      });
    }

    if (action === "create") {
      const phone = normPhone(body.phone);
      const providedEmail = str(body.email, 200).toLowerCase();
      const existing = await findLead(phone, providedEmail);
      if (existing && "ambiguous" in existing) return json({ error: "Confirme seu e-mail para identificar o cadastro correto." }, 409);
      const nome = realName(existing?.nome) || realName(body.name);
      const email = validEmail(existing?.email) ? String(existing?.email).toLowerCase() : providedEmail;
      if (!nome || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Nome, e-mail e telefone válidos são obrigatórios." }, 400);
      const ctx = await resolveContext(body);
      const payload: Record<string, unknown> = {
        source: "form",
        form_name: ctx.origin,
        form_id: ctx.form_id,
        form_purpose: "captacao",
        nome, email, telefone_raw: phone,
        produto_interesse: ctx.product || undefined,
        utm_source: str(body.utm_source, 120) || (ctx.campaign ? "lia_campaign" : "landing_page"),
        utm_medium: str(body.utm_medium, 120) || "whatsapp_lia",
        utm_campaign: str(body.utm_campaign, 120) || ctx.campaign || undefined,
        form_responses: [
          { label: "Nome completo", value: nome },
          { label: "Seu e-mail", value: email },
          { label: "Seu WhatsApp", value: `+${phone}` },
          { label: "Canal", value: "Chat Dra. LIA (WhatsApp)" },
          ...(ctx.product ? [{ label: "Produto de interesse", value: ctx.product }] : []),
        ],
      };
      const r = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify(payload),
      });
      const out = await r.json().catch(() => ({}));
      const leadId = out?.lead_id;
      if (!r.ok || !isUuid(leadId)) return json({ error: "Não foi possível registrar o atendimento." }, 502);
      await sb.from("attendance_channel_events").insert({
        channel: "whatsapp_lia", event_type: "lead", form_id: ctx.form_id, campaign_slug: ctx.campaign,
        product_name: ctx.product || null, lead_id: leadId, session_id: str(body.session_id, 120) || null,
      });
      return json({ lead_id: leadId, token: await sign(leadId), questions: await pendingQuestions(leadId, body) });
    }

    if (action === "qualification") {
      if (!(await checkToken(body.lead_id, body.token))) return json({ error: "unauthorized" }, 401);
      return json({ questions: await pendingQuestions(body.lead_id, body) });
    }

    if (action === "answer") {
      if (!(await checkToken(body.lead_id, body.token))) return json({ error: "unauthorized" }, 401);
      const context = { ...body, form_id: body.form_id_context ?? body.form_id };
      const pending = await pendingQuestions(body.lead_id, context);
      const field = pending.find((q: any) => q.field_id === (body.field_id || null) && q.db_column === body.db_column);
      const rawValues = Array.isArray(body.value) ? body.value.map((v: unknown) => str(v, 300)) : [str(body.value, 300)];
      // Opções do formulário podem ter espaços extras; compara normalizado e grava a opção canônica do formulário.
      const norm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const options: string[] = field?.options ?? [];
      const values = rawValues.map((v: string) => (options.length ? options.find((o) => norm(o) === norm(v)) ?? "" : v));
      if (!field || !values.length || values.some((v: string) => !v) || (Array.isArray(body.value) && field.field_type !== "checkbox")) return json({ error: "invalid field or answer" }, 400);
      const value = Array.isArray(body.value) ? JSON.stringify(values) : values[0];
      if (field.db_column && ANSWER_COLS.has(field.db_column)) {
        const { error } = await sb.from("lia_attendances").update({ [field.db_column]: value }).eq("id", body.lead_id).is("merged_into", null);
        if (error) throw error;
      }
      if (field.field_id && field.form_id) {
        const { error } = await sb.rpc("fn_store_form_answers", { p_lead_id: body.lead_id, p_form_id: field.form_id,
          p_answers: [{ field_id: field.field_id, value }] });
        if (error) throw error;
      }
      // Registra a resposta na timeline do lead (mesmo formato das respostas de formulário).
      const ctxOrigin = (await resolveContext(context).catch(() => null))?.origin ?? "# CHAT - Dra. LIA";
      const label = String(field.label ?? field.db_column ?? "Resposta").trim();
      const shown = Array.isArray(body.value) ? values.join(", ") : values[0];
      const { error: tlError } = await sb.from("lead_activity_log").insert({
        lead_id: body.lead_id, event_type: "form_response", source_channel: "form",
        entity_type: "form_field", entity_id: ctxOrigin, entity_name: label,
        event_data: { label, value: shown, form_name: ctxOrigin, description: `${label}: ${shown}`, channel: "whatsapp_lia" },
        dedupe_hash: `lia_answer:${body.lead_id}:${field.field_id ?? field.db_column}:${normLabel(shown)}`,
      });
      if (tlError && tlError.code !== "23505") console.warn("[lia-capture] timeline insert failed", tlError.code);
      EdgeRuntime.waitUntil(syncFormNote(sb, body.lead_id).catch(async (error) => {
        console.error("[lia-capture] CRM note refresh failed", error);
        await sb.from("system_health_logs").insert({ function_name: "lia-capture", severity: "error", error_type: "crm_note_sync_failed", details: { lead_id: body.lead_id } });
      }));
      return json({ ok: true, questions: await pendingQuestions(body.lead_id, context) });
    }

    if (action === "seller") {
      if (!(await checkToken(body.lead_id, body.token))) return json({ error: "unauthorized" }, 401);
      return json(await sellerCard(body.lead_id, body));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[lia-capture]", e);
    return json({ error: "internal" }, 500);
  }
});

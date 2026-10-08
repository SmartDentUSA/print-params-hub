// LIA de captura (landing pages SDR e links de campanha).
// Fluxo roteirizado: identifica o lead (telefone → e-mail), cria no CRM pelo
// mesmo caminho dos formulários (smart-ops-ingest-lead), grava as respostas de
// qualificação e devolve o cartão do vendedor designado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";
import { buildKnownAnswers, filterPending } from "./qualification.ts";
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
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

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
  if (campaignSlug) {
    const { data: c } = await sb.from("campaigns").select("nome, lia_opening_message, lia_product_name").ilike("lia_slug", campaignSlug).maybeSingle();
    if (c) {
      campaignName = c.nome ?? "";
      product = product || c.lia_product_name || "";
      opening = c.lia_opening_message ?? "";
    }
  }
  if (formId) {
    const { data: f } = await sb.from("smartops_forms").select("name, subtitle, description, extra_sections, product_catalog_id, capture_buttons_enabled, capture_buttons").eq("id", formId).maybeSingle();
    formName = f?.name ?? "";
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
  return { form_id: formId, campaign: campaignSlug, product, origin, opening, greeting, questions, product_summary: productSummary, modules_summary: modulesSummary, qualification_form_id: qFormId, fields };
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
  let history: any[] = [];
  if (ctx.qualification_form_id) {
    const { data: rows, error: historyError } = await sb.from("smartops_form_field_responses")
      .select("field_id, value, field:smartops_form_fields(db_column, custom_field_name)").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1000);
    if (historyError) throw historyError;
    history = rows ?? [];
  }
  return filterPending(ctx.questions, buildKnownAnswers(ctx.fields, profile, history));
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

async function sellerCard(leadId: string) {
  const { data: lead } = await sb.from("lia_attendances")
    .select("nome, proprietario_lead_crm, piperun_owner_id, produto_interesse")
    .eq("id", leadId).is("merged_into", null).maybeSingle();
  if (!lead) return { ready: false };
  const { data: deal } = await sb.from("deals").select("piperun_deal_id, owner_name")
    .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
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
  const product = lead.produto_interesse || "seus produtos";
  const dealId = deal?.piperun_deal_id ? String(deal.piperun_deal_id) : "";
  const phone = normPhone(member?.whatsapp_number) || FALLBACK_WA;
  const text = `Olá ${first}, quero saber mais sobre o ${product}, e meu atendimento já foi registrado com número ${dealId || leadId.slice(0, 8)}`;
  return {
    ready: true,
    seller_name: ownerName,
    seller_first_name: first,
    lead_first_name: String(lead.nome ?? "").trim().split(/\s+/)[0] || null,
    photo_url: member?.photo_url ?? null,
    deal_id: dealId || null,
    wa_url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
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
      return json({ found: !!row && !("ambiguous" in row), ambiguous: !!row && "ambiguous" in row, first_name: row?.nome ? String(row.nome).trim().split(" ")[0] : null, has_email: validEmail(row?.email), has_name: !!row?.nome,
        ...(row && "ambiguous" in row ? { match_count: row.match_count, email_hints: row.email_hints } : {}),
      });
    }

    if (action === "create") {
      const phone = normPhone(body.phone);
      const providedEmail = str(body.email, 200).toLowerCase();
      const existing = await findLead(phone, providedEmail);
      if (existing && "ambiguous" in existing) return json({ error: "Confirme seu e-mail para identificar o cadastro correto." }, 409);
      const nome = str(existing?.nome, 120) || str(body.name, 120);
      const email = validEmail(existing?.email) ? String(existing?.email).toLowerCase() : providedEmail;
      if (!nome || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Nome, e-mail e telefone válidos são obrigatórios." }, 400);
      const ctx = await resolveContext(body);
      const payload: Record<string, unknown> = {
        source: "form",
        form_name: ctx.origin,
        form_purpose: "captacao",
        nome, email, telefone_raw: phone,
        produto_interesse: ctx.product || undefined,
        utm_source: str(body.utm_source, 120) || (ctx.campaign ? "lia_campaign" : "landing_page"),
        utm_medium: str(body.utm_medium, 120) || "whatsapp_lia",
        utm_campaign: str(body.utm_campaign, 120) || ctx.campaign || undefined,
        form_responses: [
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
      const values = Array.isArray(body.value) ? body.value.map((v: unknown) => str(v, 300)) : [str(body.value, 300)];
      if (!field || !values.length || values.some((v: string) => !v || (field.options.length && !field.options.includes(v))) || (Array.isArray(body.value) && field.field_type !== "checkbox")) return json({ error: "invalid field or answer" }, 400);
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
      return json({ ok: true, questions: await pendingQuestions(body.lead_id, context) });
    }

    if (action === "seller") {
      if (!(await checkToken(body.lead_id, body.token))) return json({ error: "unauthorized" }, 401);
      return json(await sellerCard(body.lead_id));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[lia-capture]", e);
    return json({ error: "internal" }, 500);
  }
});

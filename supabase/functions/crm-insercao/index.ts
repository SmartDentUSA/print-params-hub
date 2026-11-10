// crm-insercao — Formulário "Inserção CRM" (Agenda, equipe logada pelo celular).
// Ações: bootstrap (listas canônicas + KOLs), search (antiduplicidade em leads,
// Pessoas, Organizações e Deals, com leitura ao vivo do PipeRun) e submit.
// Regra: lead com Deal ABERTO no Funil de vendas de outro vendedor → não cria
// nada; registra na timeline e envia e-mail aos dois vendedores + gestor.
// Caso contrário cadastra pelo caminho oficial (smart-ops-ingest-lead) com
// origem "[INDKOL] - Profissional" ou "[PROSPKOL] - Profissional" e vendedor
// do contrato do KOL como vendedor fixo do formulário de sistema.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { normalizePipeRunDealStatus, piperunGet, PIPELINES, PIPELINE_NAMES } from "../_shared/piperun-field-map.ts";
import { buildLeadConversions, buildLeadSummary } from "./summary.ts";
import {
  buildOriginName,
  documentInfo,
  isOpenVendasConflict,
  ownedByAnotherSeller,
  phoneVariants,
  type DealView,
} from "./rules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PIPERUN_KEY = Deno.env.get("PIPERUN_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "";
const GMAIL_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const MANAGER_EMAIL = "danilohen@gmail.com";
const TEMPLATE_FORM_ID = "150e231f-c17c-42ad-95b7-f2ee7a99d9bd"; // exocad DentalCad RMS (perguntas canônicas)
const PRODUCT_TYPES = ["product", "resin", "Resinas", "consumables", "Serviços"];
const SEARCH_LIMIT_PER_HOUR = 120;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type TeamMember = { id: string; nome_completo: string; email: string | null; role: string | null; piperun_owner_id: string | null };

// ── Identidade da equipe (sempre no servidor; nunca pelo user_metadata) ──
async function resolveTeamMember(req: Request): Promise<{ user_id: string; tm: TeamMember } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email) return null;
  const email = user.email.toLowerCase();
  const { data: tms } = await sb
    .from("team_members")
    .select("id, nome_completo, email, role, piperun_owner_id, whatsapp_number")
    .eq("ativo", true);
  const list = (tms ?? []) as Array<TeamMember & { whatsapp_number: string | null }>;
  let hit: TeamMember | undefined;
  const m = email.match(/^(\d{10,15})@phone\.smartdent\.local$/);
  if (m) {
    const d10 = m[1].slice(-10);
    const d8 = m[1].slice(-8);
    hit = list.find((t) => {
      const td = String(t.whatsapp_number ?? "").replace(/\D+/g, "");
      return td.endsWith(d10) || (td.slice(-8) === d8 && td.slice(-10, -8) === d10.slice(0, 2));
    });
  } else if (user.email_confirmed_at) {
    hit = list.find((t) => (t.email ?? "").toLowerCase() === email);
  }
  return hit ? { user_id: user.id, tm: hit } : null;
}

// ── Listas canônicas (mesmas perguntas/respostas dos formulários) ──
async function canonicalOptions() {
  const { data: fields } = await sb
    .from("smartops_form_fields")
    .select("db_column, options")
    .eq("form_id", TEMPLATE_FORM_ID)
    .in("db_column", ["area_atuacao", "especialidade"]);
  const opt = (col: string) =>
    ((fields ?? []).find((f: any) => f.db_column === col)?.options ?? []).map((o: any) =>
      typeof o === "string" ? o : String(o?.value ?? o?.label ?? ""),
    ).filter(Boolean) as string[];
  const { data: products } = await sb
    .from("system_a_catalog")
    .select("id, name, product_category")
    .in("category", PRODUCT_TYPES)
    .eq("active", true)
    .order("name");
  return {
    area_atuacao: opt("area_atuacao"),
    especialidade: opt("especialidade"),
    produtos: (products ?? []).map((p: any) => ({ id: p.id, name: String(p.name).trim(), group: p.product_category ?? null })),
  };
}

// ── KOL → vendedor do contrato (contrato assinado > especialista > formulário de indicação) ──
async function kolSeller(kol: any): Promise<TeamMember | null> {
  const ids: string[] = [];
  const { data: contract } = await sb
    .from("kol_contracts")
    .select("seller_team_member_id")
    .eq("lead_id", kol.id)
    .eq("status", "assinado")
    .is("revoked_at", null)
    .eq("is_test", false)
    .not("seller_team_member_id", "is", null)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contract?.seller_team_member_id) ids.push(contract.seller_team_member_id);
  if (kol.prof_specialist_team_member_id) ids.push(kol.prof_specialist_team_member_id);
  const formIds = (Array.isArray(kol.prof_kol_form_ids) ? kol.prof_kol_form_ids : [])
    .map((f: any) => String(f?.id ?? f ?? "")).filter(Boolean);
  if (formIds.length) {
    const { data: forms } = await sb
      .from("smartops_forms")
      .select("name, forced_seller_team_member_id")
      .in("id", formIds)
      .not("forced_seller_team_member_id", "is", null);
    const sorted = (forms ?? []).sort((a: any, b: any) =>
      Number(/^#\s*-\s*INDICA/i.test(b.name)) - Number(/^#\s*-\s*INDICA/i.test(a.name)));
    for (const f of sorted) ids.push((f as any).forced_seller_team_member_id);
  }
  for (const id of ids) {
    const { data: tm } = await sb
      .from("team_members")
      .select("id, nome_completo, email, role, piperun_owner_id, ativo")
      .eq("id", id)
      .maybeSingle();
    if (tm?.ativo && Number(tm.piperun_owner_id) > 0) return tm as TeamMember;
  }
  return null;
}

async function listKols(me: TeamMember) {
  const { data } = await sb
    .from("lia_attendances")
    .select("id, nome, prof_display_name, prof_specialist_team_member_id, prof_kol_form_ids")
    .eq("is_kol", true)
    .eq("is_test", false)
    .is("merged_into", null)
    .limit(500);
  const out = [];
  for (const k of data ?? []) {
    const seller = await kolSeller(k);
    out.push({
      id: k.id,
      nome: String(k.prof_display_name || k.nome || "").trim(),
      seller_id: seller?.id ?? null,
      seller_nome: seller?.nome_completo ?? null,
      linked: seller?.id === me.id,
    });
  }
  return out.sort((a, b) => Number(b.linked) - Number(a.linked) || a.nome.localeCompare(b.nome, "pt-BR"));
}

// ── Busca antiduplicidade ──
async function searchRecords(phoneRaw: string, emailRaw?: string | null) {
  const variants = phoneVariants(phoneRaw);
  if (!variants.length) throw new Error("invalid_phone");
  const email = (emailRaw || "").trim().toLowerCase();
  const phoneOr = variants.flatMap((v) => [`telefone_normalized.like.*${v}`]).join(",");
  const { data: leadsRaw } = await sb
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, area_atuacao, especialidade, produto_interesse, produto_interesse_auto, empresa_nome, empresa_cnpj, pessoa_cpf, cidade, uf, pessoa_piperun_id, empresa_piperun_id, piperun_id, proprietario_lead_crm, form_name, updated_at, created_at, origem_primeiro_contato, real_status, ltv_total, omie_faturamento_total, omie_ultima_compra, lojaintegrada_ultimo_pedido_data, lojaintegrada_ultimo_pedido_valor, equip_scanner, equip_impressora, equip_cad, astron_courses_total, astron_courses_completed")
    .is("merged_into", null)
    .or(email ? `${phoneOr},email.eq.${email}` : phoneOr)
    .order("updated_at", { ascending: false })
    .limit(5);
  const leads = (leadsRaw ?? []).map((l: any) => ({ ...l, doc: documentInfo({ cpf: l.pessoa_cpf, cnpj: l.empresa_cnpj }) }));

  const personOr = variants.map((v) => `phone_digits.like.*${v}`).join(",");
  const { data: personsRaw } = await sb
    .from("piperun_persons_mirror")
    .select("piperun_person_id, nome, email, telefone_principal, phone_digits, cpf, empresa_cnpj_digits, cargo, piperun_company_id, empresa_nome, area_atuacao, especialidade, updated_at")
    .or(email ? `${personOr},email_normalized.eq.${email}` : personOr)
    .limit(5);
  const persons = new Map<number, any>();
  for (const p of personsRaw ?? []) persons.set(Number(p.piperun_person_id), { ...p, fonte: "espelho" });

  // PipeRun ao vivo: pessoas pelo telefone (pega cadastros ainda não espelhados)
  let liveOk = false;
  if (PIPERUN_KEY) {
    const digits = variants[0];
    const r = await piperunGet(PIPERUN_KEY, "persons", { phone: digits, show: 10 }).catch(() => null);
    const items = (r?.data as any)?.data;
    if (r?.success && Array.isArray(items)) {
      liveOk = true;
      for (const p of items) {
        const id = Number(p.id);
        if (!id) continue;
        const prev = persons.get(id) ?? {};
        persons.set(id, {
          ...prev,
          piperun_person_id: id,
          nome: p.name ?? prev.nome,
          email: (p.emails?.[0]?.email ?? p.emails?.[0]) || prev.email || null,
          telefone_principal: (p.phones?.[0]?.phone ?? p.phones?.[0]) || prev.telefone_principal || null,
          piperun_company_id: p.company_id ?? prev.piperun_company_id ?? null,
          cargo: p.job_title ?? prev.cargo ?? null,
          fonte: "piperun",
        });
      }
    }
  }
  for (const l of leads) {
    if (l.pessoa_piperun_id && !persons.has(Number(l.pessoa_piperun_id))) {
      persons.set(Number(l.pessoa_piperun_id), { piperun_person_id: Number(l.pessoa_piperun_id), nome: l.nome, email: l.email, telefone_principal: l.telefone_normalized, piperun_company_id: l.empresa_piperun_id, fonte: "ficha" });
    }
  }

  const companyIds = new Set<number>();
  for (const p of persons.values()) if (Number(p.piperun_company_id) > 0) companyIds.add(Number(p.piperun_company_id));
  for (const l of leads) if (Number(l.empresa_piperun_id) > 0) companyIds.add(Number(l.empresa_piperun_id));
  const { data: companies } = companyIds.size
    ? await sb
        .from("piperun_companies_mirror")
        .select("piperun_company_id, nome, nome_fantasia, razao_social, cnpj, cidade, uf, segmento, email_contato, telefone_principal")
        .in("piperun_company_id", [...companyIds])
    : { data: [] as any[] };
  const companyList = [...(companies ?? [])];
  for (const id of companyIds) {
    if (!companyList.some((c: any) => Number(c.piperun_company_id) === id)) {
      const l = leads.find((x) => Number(x.empresa_piperun_id) === id);
      companyList.push({ piperun_company_id: id, nome: l?.empresa_nome ?? null, cnpj: l?.empresa_cnpj ?? null });
    }
  }

  // Deals: espelho local + leitura ao vivo das pessoas encontradas
  const deals = new Map<string, DealView>();
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length) {
    const { data: local } = await sb
      .from("deals")
      .select("piperun_deal_id, lead_id, pipeline_id, pipeline_name, stage_id, stage_name, status, owner_id, owner_name, value, product, origin_name, piperun_created_at, closed_at, piperun_updated_at")
      .in("lead_id", leadIds)
      .eq("is_deleted", false)
      .order("piperun_updated_at", { ascending: false, nullsFirst: false })
      .limit(40);
    for (const d of local ?? []) {
      if (!d.piperun_deal_id) continue;
      deals.set(String(d.piperun_deal_id), {
        deal_id: String(d.piperun_deal_id),
        lead_id: d.lead_id,
        pipeline_id: d.pipeline_id,
        pipeline_name: d.pipeline_name ?? PIPELINE_NAMES[d.pipeline_id as number] ?? null,
        stage_id: d.stage_id,
        stage_name: d.stage_name,
        status: d.status,
        owner_id: d.owner_id,
        owner_name: d.owner_name,
        value: d.value,
        product: d.product,
        origin_name: d.origin_name,
        created_at: d.piperun_created_at,
        closed_at: d.closed_at,
        fonte: "espelho",
      });
    }
  }
  if (PIPERUN_KEY) {
    for (const pid of [...persons.keys()].slice(0, 4)) {
      const r = await piperunGet(PIPERUN_KEY, "deals", { person_id: pid, show: 50 }).catch(() => null);
      const items = (r?.data as any)?.data;
      if (!r?.success || !Array.isArray(items)) continue;
      for (const d of items) {
        if (d.deleted === 1 || d.deleted === true) continue;
        const id = String(d.id);
        const prev = deals.get(id);
        const ns = normalizePipeRunDealStatus(d.status);
        const status = ns === "won" ? "ganha" : ns === "lost" ? "perdida" : ns === "open" ? "aberta" : prev?.status ?? "aberta";
        deals.set(id, {
          deal_id: id,
          lead_id: prev?.lead_id ?? null,
          pipeline_id: Number(d.pipeline_id) || prev?.pipeline_id || null,
          pipeline_name: PIPELINE_NAMES[Number(d.pipeline_id)] ?? prev?.pipeline_name ?? null,
          stage_id: Number(d.stage_id) || prev?.stage_id || null,
          stage_name: Number(d.stage_id) === prev?.stage_id ? prev?.stage_name ?? null : null,
          status,
          owner_id: Number(d.owner_id ?? d.user_id) || prev?.owner_id || null,
          owner_name: prev?.owner_name ?? null,
          value: d.value ?? prev?.value ?? null,
          title: d.title ?? prev?.title ?? null,
          product: prev?.product ?? null,
          origin_name: prev?.origin_name ?? null,
          created_at: d.created_at ?? prev?.created_at ?? null,
          closed_at: d.closed_at ?? prev?.closed_at ?? null,
          person_id: pid,
          fonte: "piperun",
        });
      }
    }
  }

  // Completa negócios vindos só do PipeRun com o espelho local (vendedor, produto, origem, etapa)
  const all = [...deals.values()];
  const needLocal = all.filter((d) => d.fonte === "piperun").map((d) => d.deal_id);
  if (needLocal.length) {
    const { data: loc } = await sb.from("deals")
      .select("piperun_deal_id, lead_id, stage_id, stage_name, owner_name, product, origin_name, deal_title, value")
      .in("piperun_deal_id", needLocal).limit(200);
    const byId = new Map((loc ?? []).map((r: any) => [String(r.piperun_deal_id), r]));
    for (const d of all) {
      const r: any = byId.get(d.deal_id);
      if (!r) continue;
      d.lead_id ??= r.lead_id;
      if (!d.stage_name && r.stage_id === d.stage_id) d.stage_name = r.stage_name;
      d.owner_name ??= r.owner_name;
      d.product ??= r.product;
      d.origin_name ??= r.origin_name;
      d.title ??= r.deal_title;
      if (d.value == null) d.value = r.value;
    }
  }
  // Nomes de etapa e de vendedor
  const missingStages = [...new Set(all.filter((d) => !d.stage_name && d.stage_id).map((d) => d.stage_id as number))];
  if (missingStages.length) {
    const { data: st } = await sb.from("deals").select("stage_id, stage_name").in("stage_id", missingStages).not("stage_name", "is", null).limit(200);
    const map = new Map((st ?? []).map((s: any) => [s.stage_id, s.stage_name]));
    for (const d of all) if (!d.stage_name && d.stage_id) d.stage_name = map.get(d.stage_id) ?? `Etapa ${d.stage_id}`;
  }
  const { data: owners } = await sb.from("team_members").select("id, nome_completo, email, piperun_owner_id");
  for (const d of all) {
    const o = (owners ?? []).find((t: any) => Number(t.piperun_owner_id) > 0 && Number(t.piperun_owner_id) === Number(d.owner_id));
    if (o) { d.owner_name = o.nome_completo; d.owner_team_member_id = o.id; d.owner_email = o.email; }
  }
  all.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const alerts = all
    .filter((d) => d.status === "aberta" && Number(d.pipeline_id) === PIPELINES.VENDAS)
    .map((d) => ({ deal_id: d.deal_id, owner_name: d.owner_name ?? "não identificado", owner_team_member_id: d.owner_team_member_id ?? null, has_email: !!d.owner_email, pipeline: d.pipeline_name ?? "Funil de vendas", stage: d.stage_name ?? "" }));

  // Resumo do lead (timeline de negócios + compilado do sistema)
  const mainLead = leads[0] ?? null;
  let activity: any[] = [];
  if (mainLead) {
    const { data: act } = await sb.from("lead_activity_log")
      .select("event_type, event_timestamp, entity_name")
      .eq("lead_id", mainLead.id)
      .in("event_type", ["form_submission", "inscricao_curso_publica", "treinamento_finalizado", "support_ticket_created", "crm_insercao", "meta_ads_lead_entry"])
      .order("event_timestamp", { ascending: false }).limit(60);
    activity = act ?? [];
  }
  const summary = buildLeadSummary(mainLead, all, activity);
  const conversions = buildLeadConversions(activity);
  const courses = [...new Set(activity.filter((a) => a.event_type === "inscricao_curso_publica" || a.event_type === "treinamento_finalizado").map((a) => a.entity_name).filter(Boolean))].slice(0, 6) as string[];
  const tickets = activity.filter((a) => a.event_type === "support_ticket_created").length;
  const latest_deal = all[0] ?? null;

  const withDoc = (r: any) => ({ ...r, doc: documentInfo({ cpf: r.cpf, cnpj: r.empresa_cnpj_digits ?? r.cnpj }) });
  return { leads, persons: [...persons.values()].map(withDoc), companies: companyList.map(withDoc), deals: all, latest_deal, summary, conversions, extras: { courses, tickets }, alerts, live_checked: liveOk };
}

// ── E-mail de conflito ──
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
async function sendEmail(to: string, subject: string, html: string) {
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) throw new Error("gmail_not_configured");
  const raw = [`To: ${to}`, `Subject: ${hdr(subject)}`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(html)].join("\r\n");
  const res = await fetch(`${GMAIL_URL}/users/me/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }),
  });
  if (!res.ok) throw new Error(`gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

function table(rows: Array<[string, unknown]>) {
  return `<table style="border-collapse:collapse;width:100%;font-size:13px">${rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#5f6368;width:180px;border-bottom:1px solid #eee">${esc(k)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}

function conflictEmailHtml(ctx: {
  mode?: "blocked" | "notify";
  registrant: TeamMember; seller: TeamMember | null; kolName: string; origin: string; tipo: string;
  input: Record<string, unknown>; found: Awaited<ReturnType<typeof searchRecords>>; conflicts: DealView[]; history: any[];
}) {
  const brl = (v: unknown) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const sec = (t: string, body: string) => `<h3 style="margin:20px 0 6px;font-size:15px;color:#0b3d4f">${esc(t)}</h3>${body}`;
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1c1e23;max-width:760px;margin:auto">
<div style="background:#fff4e5;border:1px solid #f0b357;border-radius:8px;padding:12px 14px;margin:12px 0">
<b>${ctx.mode === "notify" ? "⚠️ Aviso: indicação para lead que já está em negociação" : "⚠️ Tentativa de nova oportunidade bloqueada"}</b><br/>
${ctx.conflicts.map((c) => `Lead pertence ao vendedor <b>${esc(c.owner_name ?? "não identificado")}</b> e já está no funil de vendas (<b>${esc(c.pipeline_name ?? "Funil de vendas")} / ${esc(c.stage_name ?? "")}</b>) — Deal #${esc(c.deal_id)}.`).join("<br/>")}
<br/><span style="font-size:12px;color:#5f6368">Nenhum negócio foi criado ou alterado. Este e-mail fica como registro.</span></div>
${sec(ctx.mode === "notify" ? "Quem avisou" : "Tentativa de cadastro", table([
    ["Cadastrado por", ctx.registrant.nome_completo],
    ["Data", dt(new Date().toISOString())],
    ["Profissional KOL", ctx.kolName],
    ["Tipo de indicação", ctx.tipo === "ativa" ? "Indicação Ativa" : ctx.tipo === "fria" ? "Indicação Fria" : ""],
    ["Origem pretendida", ctx.origin],
    ["Vendedor do contrato do KOL", ctx.seller?.nome_completo],
    ["Nome informado", ctx.input.nome], ["Celular", ctx.input.telefone], ["E-mail", ctx.input.email],
    ["Documento informado", ctx.input.empresa_cnpj],
    ["Área de atuação", ctx.input.area_atuacao], ["Especialidade", ctx.input.especialidade],
    ["Produto de interesse", ctx.input.produto_interesse],
  ]))}
${sec("Resumo do lead", ctx.found.summary.map((b) => `<p style="margin:8px 0 2px;font-weight:bold;font-size:13px">${esc(b.title)}</p>${b.lines.map((l) => `<div style="font-size:12px;padding:1px 0">${esc(l)}</div>`).join("")}`).join(""))}
${sec("Deals encontrados", ctx.found.deals.length ? ctx.found.deals.map((d) => table([
    ["Deal", `#${d.deal_id}`], ["Funil / etapa", `${d.pipeline_name ?? ""} / ${d.stage_name ?? ""}`], ["Situação", d.status],
    ["Vendedor", d.owner_name], ["Valor", brl(d.value)], ["Produto", d.product], ["Origem", d.origin_name],
    ["Criado em", dt(d.created_at)], ["Fechado em", dt(d.closed_at)],
  ])).join("<br/>") : "<p>Nenhum.</p>")}
${sec("Pessoas", ctx.found.persons.length ? ctx.found.persons.map((p: any) => table([
    ["Pessoa", p.nome], ["ID PipeRun", p.piperun_person_id], ["E-mail", p.email], ["Telefone", p.telefone_principal], ["Documento", p.doc?.label],
    ["Cargo", p.cargo], ["Empresa", p.empresa_nome], ["Área", p.area_atuacao], ["Especialidade", p.especialidade],
  ])).join("<br/>") : "<p>Nenhuma.</p>")}
${sec("Organizações", ctx.found.companies.length ? ctx.found.companies.map((c: any) => table([
    ["Organização", c.nome_fantasia || c.nome || c.razao_social], ["Razão social", c.razao_social], ["Documento", c.doc?.label || c.cnpj],
    ["Cidade/UF", [c.cidade, c.uf].filter(Boolean).join("/")], ["Segmento", c.segmento], ["E-mail", c.email_contato], ["Telefone", c.telefone_principal],
  ])).join("<br/>") : "<p>Nenhuma.</p>")}
${sec("Ficha no sistema", ctx.found.leads.length ? ctx.found.leads.map((l: any) => table([
    ["Nome", l.nome], ["E-mail", l.email], ["Telefone", l.telefone_normalized], ["Área", l.area_atuacao], ["Especialidade", l.especialidade],
    ["Produto de interesse", l.produto_interesse || l.produto_interesse_auto], ["Empresa", l.empresa_nome], ["Documento", l.doc?.label], ["Cidade/UF", [l.cidade, l.uf].filter(Boolean).join("/")],
    ["Última conversão", l.form_name], ["Responsável", l.proprietario_lead_crm],
  ])).join("<br/>") : "<p>Nenhuma.</p>")}
${sec("Histórico recente", ctx.history.length ? `<table style="border-collapse:collapse;width:100%;font-size:12px">${ctx.history.map((h: any) =>
    `<tr><td style="padding:3px 8px;color:#5f6368;white-space:nowrap;border-bottom:1px solid #eee">${esc(dt(h.event_timestamp))}</td><td style="padding:3px 8px;border-bottom:1px solid #eee">${esc(h.event_type)}${h.entity_name ? ` — ${esc(h.entity_name)}` : ""}</td></tr>`).join("")}</table>` : "<p>Sem eventos.</p>")}
<p style="font-size:11px;color:#9aa0a6;margin-top:24px">Smart Dent | Fluxo Digital — Inserção CRM</p></body></html>`;
}

// ── Formulário de sistema por origem (vendedor fixo = vendedor do KOL) ──
async function ensureOriginForm(origin: string, sellerId: string): Promise<string> {
  const { data: existing } = await sb
    .from("smartops_forms")
    .select("id, forced_seller_team_member_id")
    .eq("name", origin)
    .eq("form_purpose", "insercao_crm")
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    if (existing.forced_seller_team_member_id !== sellerId) {
      await sb.from("smartops_forms").update({ forced_seller_team_member_id: sellerId }).eq("id", existing.id);
    }
    return existing.id;
  }
  const slug = `insercao-crm-${origin.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await sb
    .from("smartops_forms")
    .insert({ name: origin, slug, title: origin, form_purpose: "insercao_crm", active: false, forced_seller_team_member_id: sellerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Vincula o formulário de sistema ao profissional (prof_kol_form_ids): é o que faz as
// indicações entrarem em desempenho, conversão e comissão do KOL em todas as telas.
async function linkFormToKol(kolId: string, formId: string, name: string) {
  const { data } = await sb.from("lia_attendances").select("prof_kol_form_ids").eq("id", kolId).maybeSingle();
  const refs: any[] = Array.isArray(data?.prof_kol_form_ids) ? data!.prof_kol_form_ids : [];
  if (refs.some((r) => String(r?.id ?? r) === formId)) return;
  await sb.from("lia_attendances").update({ prof_kol_form_ids: [...refs, { id: formId, name }] }).eq("id", kolId);
}

async function kolTimeline(kolId: string, eventType: string, entityId: string, entityName: string, data: Record<string, unknown>, value?: number | null) {
  const { error } = await sb.rpc("fn_kol_log", {
    _lead_id: kolId, _event_type: eventType, _entity_type: "indicacao", _entity_id: entityId,
    _entity_name: entityName, _data: { ...data, actor: data.registrant ?? "sistema" }, _value: value ?? null, _channel: "insercao_crm",
  });
  if (error) console.warn("[crm-insercao] kol timeline", error.message);
}

const SubmitSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  telefone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  area_atuacao: z.string().trim().min(1).max(120),
  especialidade: z.string().trim().min(1).max(120),
  produto_interesse: z.string().trim().min(1).max(200),
  product_catalog_id: z.string().uuid().optional().nullable(),
  kol_lead_id: z.string().uuid(),
  indicacao_tipo: z.enum(["ativa", "fria"]),
  empresa_nome: z.string().trim().max(200).optional().nullable(),
  empresa_cnpj: z.string().trim().max(30).optional().nullable(),
  base: z.object({ kind: z.enum(["pessoa", "organizacao", "deal", "ficha"]), id: z.string().max(64) }).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await resolveTeamMember(req);
    if (!auth) return json({ error: "Entre com o celular cadastrado no Team Members para usar este formulário." }, 403);
    const { user_id, tm } = auth;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "bootstrap") {
      const [options, kols] = await Promise.all([canonicalOptions(), listKols(tm)]);
      return json({ me: { id: tm.id, nome: tm.nome_completo, role: tm.role }, options, kols });
    }

    if (action === "search") {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await sb.from("crm_insertion_log").select("id", { count: "exact", head: true })
        .eq("auth_user_id", user_id).eq("action", "search").gte("created_at", since);
      if ((count ?? 0) >= SEARCH_LIMIT_PER_HOUR) return json({ error: "Limite de buscas por hora atingido. Tente mais tarde." }, 429);
      const phone = String(body?.telefone ?? "");
      if (phone.replace(/\D/g, "").length < 10) return json({ error: "Informe o celular com DDD (55xxxxxxxxxxx)." }, 400);
      const found = await searchRecords(phone, null);
      await sb.from("crm_insertion_log").insert({
        auth_user_id: user_id, team_member_id: tm.id, action: "search", lead_phone: phone.replace(/\D/g, ""),
        lead_id: found.leads[0]?.id ?? null, outcome: found.alerts.length ? "found_open_vendas" : (found.leads.length || found.persons.length ? "found" : "not_found"),
      });
      return json(found);
    }

    if (action === "notify") {
      // Aviso manual ao vendedor dono do lead (botão "Avisar o vendedor").
      // Não cria nem altera negócio; registra na timeline e envia e-mail.
      const phoneDigits = String(body?.telefone ?? "").replace(/\D/g, "");
      if (phoneDigits.length < 10) return json({ error: "Informe o celular com DDD (55xxxxxxxxxxx)." }, 400);
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: recent } = await sb.from("crm_insertion_log").select("emails_sent, created_at")
        .eq("team_member_id", tm.id).eq("action", "notify").eq("lead_phone", phoneDigits).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (recent) return json({ ok: true, already: true, emails: recent.emails_sent ?? {}, sent_at: recent.created_at });

      const found = await searchRecords(phoneDigits, null);
      const conflicts = found.deals.filter((d) => ownedByAnotherSeller(d, tm.id));
      if (!conflicts.length) return json({ error: "Este lead não está em negociação com outro vendedor." }, 409);

      let kol: any = null;
      const kolId = String(body?.kol_lead_id ?? "");
      if (/^[0-9a-f-]{36}$/i.test(kolId)) {
        const { data } = await sb.from("lia_attendances")
          .select("id, nome, prof_display_name, prof_specialist_team_member_id, prof_kol_form_ids")
          .eq("id", kolId).eq("is_kol", true).eq("is_test", false).is("merged_into", null).maybeSingle();
        kol = data ?? null;
      }
      const kolName = kol ? String(kol.prof_display_name || kol.nome || "").trim() : "";
      const seller = kol ? await kolSeller(kol) : null;
      const tipo = body?.indicacao_tipo === "ativa" || body?.indicacao_tipo === "fria" ? body.indicacao_tipo : "";
      const origin = kolName && tipo ? buildOriginName(tipo, kolName) : "";
      const leadId = found.leads[0]?.id ?? null;
      const leadName = String(body?.nome || found.leads[0]?.nome || found.persons[0]?.nome || "").slice(0, 160);
      const { data: history } = leadId
        ? await sb.from("lead_activity_log").select("event_type, event_timestamp, entity_name").eq("lead_id", leadId).order("event_timestamp", { ascending: false }).limit(25)
        : { data: [] as any[] };
      const { data: logRow } = await sb.from("crm_insertion_log").insert({
        auth_user_id: user_id, team_member_id: tm.id, action: "notify", lead_phone: phoneDigits, lead_id: leadId,
        kol_lead_id: kol?.id ?? null, indicacao_tipo: tipo || null, origin_name: origin || null,
        target_seller_team_member_id: seller?.id ?? null, outcome: "notified", conflict: conflicts,
      }).select("id").single();
      const recipients = [...new Set([
        ...conflicts.map((c) => c.owner_email).filter(Boolean) as string[],
        tm.email ?? "", MANAGER_EMAIL,
      ].map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)))];
      const html = conflictEmailHtml({
        mode: "notify", registrant: tm, seller, kolName, origin, tipo,
        input: { nome: leadName, telefone: phoneDigits }, found, conflicts, history: history ?? [],
      });
      const subject = `⚠️ Indicação para lead em negociação — ${leadName || phoneDigits} está com ${conflicts[0].owner_name ?? "outro vendedor"}`;
      const sent: Record<string, string> = {};
      for (const to of recipients) {
        try { await sendEmail(to, subject, html); sent[to] = "enviado"; }
        catch (e) { sent[to] = `falha: ${String((e as Error).message).slice(0, 120)}`; }
      }
      if (logRow?.id) await sb.from("crm_insertion_log").update({ emails_sent: sent }).eq("id", logRow.id);
      if (leadId) {
        await sb.from("lead_activity_log").insert({
          lead_id: leadId, event_type: "crm_insercao_aviso_vendedor", source_channel: "insercao_crm",
          entity_type: "deal", entity_id: conflicts[0].deal_id,
          entity_name: `Aviso ao vendedor ${conflicts[0].owner_name ?? ""} — indicação de ${tm.nome_completo}`.trim(),
          dedupe_hash: `crm_insercao_aviso:${logRow?.id ?? crypto.randomUUID()}`,
          event_data: { registrant: tm.nome_completo, kol: kolName || null, origin: origin || null, conflicts, emails: sent },
        });
      }
      if (kol) {
        await kolTimeline(kol.id, "kol_indicacao_aviso_vendedor", String(logRow?.id ?? crypto.randomUUID()), `Aviso ao vendedor — ${leadName}`, {
          registrant: tm.nome_completo, lead_id: leadId, lead_nome: leadName, origin, tipo,
          owner: conflicts[0].owner_name, motivo: "Lead já em negociação com outro vendedor; nenhuma oportunidade criada",
        });
      }
      return json({ ok: true, emails: sent });
    }

    if (action === "submit") {
      const parsed = SubmitSchema.safeParse(body?.data);
      if (!parsed.success) return json({ error: "Dados inválidos", fields: parsed.error.flatten().fieldErrors }, 400);
      const input = parsed.data;
      const options = await canonicalOptions();
      if (!options.area_atuacao.includes(input.area_atuacao)) return json({ error: "Área de atuação fora da lista." }, 400);
      if (!options.especialidade.includes(input.especialidade)) return json({ error: "Especialidade fora da lista." }, 400);
      const product = options.produtos.find((p) => (input.product_catalog_id ? p.id === input.product_catalog_id : p.name === input.produto_interesse));
      if (!product) return json({ error: "Produto de interesse fora da lista." }, 400);

      const { data: kol } = await sb
        .from("lia_attendances")
        .select("id, nome, prof_display_name, prof_specialist_team_member_id, prof_kol_form_ids")
        .eq("id", input.kol_lead_id).eq("is_kol", true).eq("is_test", false).is("merged_into", null)
        .maybeSingle();
      if (!kol) return json({ error: "Profissional KOL não encontrado." }, 400);
      const kolName = String(kol.prof_display_name || kol.nome || "").trim();
      const seller = await kolSeller(kol);
      if (!seller) return json({ error: `O profissional ${kolName} não tem vendedor de contrato ativo no CRM. Vincule um vendedor na ficha do profissional.` }, 409);
      const origin = buildOriginName(input.indicacao_tipo, kolName);
      const phoneDigits = input.telefone.replace(/\D/g, "");

      const found = await searchRecords(phoneDigits, input.email || null);
      const conflicts = found.deals.filter((d) => isOpenVendasConflict(d, Number(seller.piperun_owner_id)));
      const logBase = {
        auth_user_id: user_id, team_member_id: tm.id, lead_phone: phoneDigits, kol_lead_id: kol.id,
        indicacao_tipo: input.indicacao_tipo, origin_name: origin, target_seller_team_member_id: seller.id,
      };

      if (conflicts.length) {
        const leadId = found.leads[0]?.id ?? null;
        const { data: history } = leadId
          ? await sb.from("lead_activity_log").select("event_type, event_timestamp, entity_name").eq("lead_id", leadId).order("event_timestamp", { ascending: false }).limit(25)
          : { data: [] as any[] };
        const { data: logRow } = await sb.from("crm_insertion_log").insert({
          ...logBase, action: "submit", lead_id: leadId, outcome: "blocked",
          conflict: conflicts, result: { input, persons: found.persons.length, companies: found.companies.length },
        }).select("id").single();
        const recipients = [...new Set([
          ...conflicts.map((c) => c.owner_email).filter(Boolean) as string[],
          tm.email ?? "", MANAGER_EMAIL,
        ].map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)))];
        const html = conflictEmailHtml({ registrant: tm, seller, kolName, origin, tipo: input.indicacao_tipo, input, found, conflicts, history: history ?? [] });
        const subject = `⚠️ Inserção CRM bloqueada — ${input.nome} já está com ${conflicts[0].owner_name ?? "outro vendedor"}`;
        const sent: Record<string, string> = {};
        for (const to of recipients) {
          try { const r = await sendEmail(to, subject, html); sent[to] = r?.id ? "enviado" : "enviado"; }
          catch (e) { sent[to] = `falha: ${String((e as Error).message).slice(0, 120)}`; }
        }
        if (logRow?.id) await sb.from("crm_insertion_log").update({ emails_sent: sent }).eq("id", logRow.id);
        if (leadId) {
          await sb.from("lead_activity_log").insert({
            lead_id: leadId, event_type: "crm_insercao_bloqueada", source_channel: "insercao_crm",
            entity_type: "deal", entity_id: conflicts[0].deal_id, entity_name: `Inserção CRM bloqueada — ${origin}`,
            dedupe_hash: `crm_insercao:${logRow?.id ?? crypto.randomUUID()}`,
            event_data: { registrant: tm.nome_completo, kol: kolName, origin, target_seller: seller.nome_completo, conflicts, emails: sent },
          });
        }
        await kolTimeline(kol.id, "kol_indicacao_bloqueada", String(logRow?.id ?? crypto.randomUUID()), `Indicação bloqueada — ${input.nome}`, {
          registrant: tm.nome_completo, lead_id: leadId, lead_nome: input.nome, origin, tipo: input.indicacao_tipo,
          seller: seller.nome_completo, motivo: "Lead já em negociação no funil de vendas; nenhuma oportunidade criada",
        });
        return json({ ok: false, blocked: true, conflicts, emails: sent, origin });
      }

      const formId = await ensureOriginForm(origin, seller.id);
      await linkFormToKol(kol.id, formId, origin);
      const responses = [
        { label: "Nome", value: input.nome },
        { label: "Celular", value: `+${phoneDigits}` },
        ...(input.email ? [{ label: "E-mail", value: input.email }] : []),
        { label: "Qual sua área de atuação", value: input.area_atuacao },
        { label: "Qual sua especialidade?", value: input.especialidade },
        { label: "Produto de interesse", value: product.name },
        { label: "Profissional KOL", value: kolName },
        { label: "Tipo de indicação", value: input.indicacao_tipo === "ativa" ? "Indicação Ativa (profissional enviou o contato)" : "Indicação Fria (vendedor pediu a indicação)" },
        { label: "Cadastrado por", value: tm.nome_completo },
        ...(input.empresa_nome ? [{ label: "Empresa", value: input.empresa_nome }] : []),
      ];
      const payload: Record<string, unknown> = {
        source: "form", form_name: origin, form_id: formId, form_purpose: "insercao_crm",
        nome: input.nome, telefone_raw: phoneDigits, ...(input.email ? { email: input.email.toLowerCase() } : {}),
        area_atuacao: input.area_atuacao, especialidade: input.especialidade,
        produto_interesse: product.name,
        ...(input.empresa_nome ? { empresa_nome: input.empresa_nome } : {}),
        ...(input.empresa_cnpj ? { empresa_cnpj: input.empresa_cnpj } : {}),
        proprietario_lead_crm: seller.nome_completo,
        utm_source: "insercao_crm", utm_medium: input.indicacao_tipo === "ativa" ? "indkol" : "prospkol", utm_campaign: origin,
        form_responses: responses, submission_id: crypto.randomUUID(),
      };
      const r = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify(payload),
      });
      const out = await r.json().catch(() => ({}));
      const leadId = out?.lead_id as string | undefined;
      if (!r.ok || !leadId) {
        await sb.from("crm_insertion_log").insert({ ...logBase, action: "submit", outcome: "error", result: { status: r.status, out } });
        return json({ error: out?.error || "Não foi possível cadastrar no CRM." }, 502);
      }
      await sb.from("lead_activity_log").insert({
        lead_id: leadId, event_type: "crm_insercao", source_channel: "insercao_crm",
        entity_type: "form", entity_id: formId, entity_name: origin,
        dedupe_hash: `crm_insercao:${payload.submission_id}`,
        event_data: { registrant: tm.nome_completo, kol: kolName, origin, seller: seller.nome_completo, tipo: input.indicacao_tipo, base: input.base ?? null, responses },
      });
      await kolTimeline(kol.id, "kol_indicacao", String(payload.submission_id), `${input.indicacao_tipo === "ativa" ? "Indicação ativa" : "Indicação fria"} — ${input.nome}`, {
        registrant: tm.nome_completo, lead_id: leadId, lead_nome: input.nome, origin, tipo: input.indicacao_tipo,
        seller: seller.nome_completo, produto: product.name, form_id: formId,
      });
      await sb.from("crm_insertion_log").insert({ ...logBase, action: "submit", lead_id: leadId, outcome: "created", result: { ingest: out, base: input.base ?? null } });
      // Respostas na nota do Deal (mesmo caminho dos formulários públicos)
      // @ts-ignore EdgeRuntime existe no runtime do Supabase
      EdgeRuntime.waitUntil(fetch(`${SUPABASE_URL}/functions/v1/smart-ops-deal-form-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ lead_id: leadId, form_name: origin, responses }),
      }).catch((e) => console.warn("[crm-insercao] deal note", e)));
      return json({ ok: true, lead_id: leadId, origin, seller: seller.nome_completo, is_existing: !!out?.is_existing });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("[crm-insercao]", e);
    const msg = (e as Error)?.message === "invalid_phone" ? "Celular inválido." : "Erro interno.";
    return json({ error: msg }, 500);
  }
});

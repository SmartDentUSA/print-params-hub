/**
 * Builds a complete "Resumo do Lead" HTML note for the seller, posted as a
 * PipeRun deal note. Consolidates: identity, origin, CRM history, e-commerce,
 * courses, 7x3 form responses, Dra. L.I.A. interactions, intelligence, links.
 *
 * Pure function — no PipeRun side-effects. Caller is responsible for posting
 * via addDealNote and for persisting `last_seller_note_hash` / `_at`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeBrazilianPhone } from "./phone-normalize.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const esc = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const fmtDate = (v: unknown): string => {
  if (!v) return "—";
  try {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch { return "—"; }
};

const fmtMoney = (v: unknown): string => {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SellerSummaryOptions {
  /** Optional latest form submission to highlight at the top (e.g., the one that just triggered the note). */
  highlightFormResponses?: Array<{ label: string; value: string }>;
  highlightFormName?: string;
  /** PipeRun deal id this note is being posted on — used only for hashing
   * so the same content posted on two different deals counts as two notes. */
  dealId?: number | null;
  /** Inclui o link "Abrir conversa com o lead" (default: true). */
  includeWaLink?: boolean;
  /** Frase pré-montada (já interpolada) que vai no `?text=` do link wa.me. */
  waLinkPreset?: string | null;
}

export async function buildSellerDealSummaryHTML(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
  opts: SellerSummaryOptions = {},
): Promise<{ html: string; hash: string }> {
  const leadId = lead.id as string | undefined;
  const email = (lead.email as string | null) || null;
  const phoneDigits = String(lead.telefone_normalized || lead.telefone_raw || "").replace(/\D/g, "");

  // ── Identidade saneada ──────────────────────────────────────────────
  // Leads vindos de importação podem ter e-mail sintético
  // (import_*@placeholder.local) e nome "Nome não informado". Nunca expor
  // isso ao vendedor: tenta recuperar nome/e-mail reais de outro lead
  // canônico com o MESMO telefone antes de cair para "—".
  const isPlaceholderEmail = (v: unknown) =>
    !v || /@placeholder\.local$/i.test(String(v)) || !String(v).includes("@");
  const isEmptyName = (v: unknown) =>
    !v || /^(nome n[ãa]o informado|sem nome|-|n\/a)$/i.test(String(v).trim());

  let displayName = isEmptyName(lead.nome) ? null : String(lead.nome);
  let displayEmail = isPlaceholderEmail(lead.email) ? null : String(lead.email);
  if ((!displayName || !displayEmail) && phoneDigits.length >= 10) {
    try {
      const { data: twins } = await supabase
        .from("lia_attendances")
        .select("nome,email,telefone_normalized,created_at")
        .is("merged_into", null)
        .ilike("telefone_normalized", `%${phoneDigits.slice(-11)}`)
        .limit(10);
      for (const t of (twins || []) as Array<Record<string, unknown>>) {
        if (!displayName && !isEmptyName(t.nome)) displayName = String(t.nome);
        if (!displayEmail && !isPlaceholderEmail(t.email)) displayEmail = String(t.email);
      }
    } catch (_) { /* best-effort */ }
  }

  // ── Parallel fetches (best-effort; never fail the whole note) ──
  const phoneSessionId = phoneDigits || null;
  const [ecomRes, enrollRes, formsRes, agentLeadRes, agentBySessionRes] = await Promise.all([
    email
      ? supabase.from("v_lead_ecommerce")
          .select("lojaintegrada_ltv,lojaintegrada_total_pedidos_pagos,lojaintegrada_primeira_compra,lojaintegrada_ultimo_pedido_data,lojaintegrada_ultimo_pedido_valor")
          .eq("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
    leadId
      ? supabase.from("smartops_course_enrollments")
          .select(`
            id,deal_title,status,enrolled_at,certificate_generated_at,certificate_pdf_path,
            notes,instagram,numero_contrato,numero_proposta,numero_nf,tipo_entrega,rastreamento,turma_snapshot,
            turma:smartops_course_turmas(label,turma_number,start_date,end_date,location,modality,whatsapp_group_link,
              course:smartops_courses(title))
          `)
          .eq("lead_id", leadId).order("enrolled_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    leadId
      ? supabase.from("smartops_form_field_responses")
          .select("field_label,value,created_at,form_id")
          .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    email
      ? supabase.from("leads").select("id").eq("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
    phoneSessionId
      ? supabase.from("agent_interactions")
          .select("user_message,created_at")
          .eq("session_id", phoneSessionId)
          .order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  let lastQuestions: string[] = [];
  const agentLeadId = (agentLeadRes as any)?.data?.id;
  if (agentLeadId) {
    const { data: msgs } = await supabase.from("agent_interactions")
      .select("user_message,created_at")
      .eq("lead_id", agentLeadId)
      .order("created_at", { ascending: false })
      .limit(5);
    lastQuestions = (msgs || [])
      .map((m: any) => String(m.user_message || "").slice(0, 180))
      .filter(Boolean);
  }
  if (!lastQuestions.length) {
    const fallback = ((agentBySessionRes as any)?.data as Array<{ user_message?: string }>) || [];
    lastQuestions = fallback
      .map(m => String(m.user_message || "").slice(0, 180))
      .filter(Boolean);
  }

  // ── Build sections ──
  // ATENÇÃO: esta nota vai para o HISTÓRICO do deal no PipeRun e deve conter
  // APENAS histórico/dados do lead — sem pitch, RAG, inteligência ou
  // diagnóstico (esses vivem no briefing do vendedor, não no histórico).
  const sections: string[] = [];
  // JID canônico para o link do WhatsApp: repara telefone legado de 8 dígitos
  // (falta o 9) e DDI — sem isso o wa.me abre um número inexistente e o
  // WhatsApp não identifica o cliente.
  const waJid = pickWaJid(lead);
  const waPreset = String(opts.waLinkPreset ?? "").trim();
  const waLink = waJid.length >= 12
    ? `https://wa.me/${waJid}${waPreset ? `?text=${encodeURIComponent(waPreset)}` : ""}`
    : "";
  if (opts.includeWaLink !== false && !waLink) {
    console.warn(
      `[seller-summary] wa link ausente lead=${String(lead.id ?? "?")} telefone="${String(lead.telefone_normalized ?? lead.telefone_raw ?? "")}"`,
    );
  }

  sections.push(`<b>🧾 Resumo do Lead — Smart Dent</b>`);
  sections.push(`<i>Atualizado em ${fmtDate(new Date().toISOString())}</i><br>`);

  // 1. Origem
  sections.push(
    `<b>🎯 Origem</b><br>` +
    `• Primeiro contato: ${fmtDate(lead.data_primeiro_contato || lead.created_at)}<br>` +
    `• Origem PipeRun: ${esc(lead.piperun_origin_name)}<br>` +
    `• Campanha: ${esc(lead.utm_campaign || lead.origem_campanha)}<br>` +
    `• Formulário inicial: ${esc(lead.form_name)}<br>` +
    `• Produto de interesse: ${esc(lead.produto_interesse || lead.produto_interesse_auto)}<br>`,
  );

  // 2. Identidade
  sections.push(
    `<b>👤 Identidade</b><br>` +
    `• Nome: ${esc(displayName || "—")}<br>` +
    `• E-mail: ${esc(displayEmail || "—")}<br>` +
    `• Telefone: ${esc(lead.telefone_normalized || lead.telefone_raw)}<br>` +
    `• Cidade/UF: ${esc(lead.cidade || "—")}/${esc(lead.uf || "—")}<br>` +
    `• Área: ${esc(lead.area_atuacao)} | Especialidade: ${esc(lead.especialidade)}<br>` +
    (opts.includeWaLink !== false && waLink
      ? `👉 Abrir conversa com o lead: <a href="${waLink}">${waLink}</a><br>`
      : opts.includeWaLink !== false
        ? `⚠️ Telefone incompleto/inválido — link do WhatsApp indisponível.<br>`
        : ""),
  );

  // 3. CRM histórico (a partir do piperun_deals_history)
  const history = (lead.piperun_deals_history as Array<Record<string, unknown>> | null) || [];
  let won = 0, lost = 0, open = 0;
  for (const d of history) {
    const s = String(d.status || "").toLowerCase();
    if (s.includes("ganh")) won++;
    else if (s.includes("perd")) lost++;
    else open++;
  }
  const histLines = history
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, 8)
    .map(d => `&nbsp;&nbsp;◦ #${esc(d.deal_id)} — ${esc(d.pipeline_name || "—")} / ${esc(d.stage_name || "—")} — ${esc(d.status || "aberto")} — ${fmtMoney(d.value)} (${fmtDate(d.created_at)})`)
    .join("<br>");
  sections.push(
    `<b>📊 CRM</b><br>` +
    `• Total de deals: ${history.length} (${won} ganhos · ${lost} perdidos · ${open} abertos)<br>` +
    `• Vendedor atual: ${esc(lead.proprietario_lead_crm)}<br>` +
    `• Etapa atual: ${esc(lead.status_atual_lead_crm)}<br>` +
    (histLines ? `• Últimos deals:<br>${histLines}<br>` : ""),
  );

  // 4. E-commerce
  const ecom = (ecomRes as any)?.data;
  if (ecom && (ecom.lojaintegrada_total_pedidos_pagos || ecom.lojaintegrada_ltv)) {
    sections.push(
      `<b>🛒 E-commerce (Loja Integrada)</b><br>` +
      `• Pedidos pagos: ${esc(ecom.lojaintegrada_total_pedidos_pagos || 0)}<br>` +
      `• LTV: ${fmtMoney(ecom.lojaintegrada_ltv)}<br>` +
      `• Primeira compra: ${fmtDate(ecom.lojaintegrada_primeira_compra)}<br>` +
      `• Último pedido: ${fmtDate(ecom.lojaintegrada_ultimo_pedido_data)} — ${fmtMoney(ecom.lojaintegrada_ultimo_pedido_valor)}<br>`,
    );
  } else {
    sections.push(`<b>🛒 E-commerce</b><br>• Sem pedidos no e-commerce.<br>`);
  }

  // 5. Cursos / Treinamentos
  const enrollments = ((enrollRes as any)?.data as Array<Record<string, unknown>>) || [];
  if (enrollments.length || lead.astron_user_id) {
    const blocks: string[] = [];
    if (lead.astron_user_id) {
      blocks.push(`• Plataforma Astron: ${esc(lead.astron_courses_completed || 0)}/${esc(lead.astron_courses_total || 0)} cursos concluídos`);
    }
    for (const e of enrollments.slice(0, 5)) {
      const turma = (e.turma as Record<string, unknown> | null) || {};
      const snap = (e.turma_snapshot as Record<string, unknown> | null) || {};
      const courseTitle = (turma.course as Record<string, unknown> | null)?.title || e.deal_title || "Treinamento";
      const turmaLabel = turma.label || snap.nome || "—";
      const turmaNum = turma.turma_number ? `#${esc(turma.turma_number)} ` : "";
      const period = (turma.start_date || turma.end_date)
        ? `${fmtDate(turma.start_date)}${turma.end_date && turma.end_date !== turma.start_date ? "–" + fmtDate(turma.end_date) : ""}`
        : "";
      const sub: string[] = [];
      sub.push(`&nbsp;&nbsp;◦ <b>${esc(courseTitle)}</b> — Turma ${turmaNum}${esc(turmaLabel)}`);
      const meta: string[] = [];
      if (period) meta.push(`📅 ${period}`);
      if (turma.modality) meta.push(`🎯 ${esc(turma.modality)}`);
      if (turma.location) meta.push(`📍 ${esc(turma.location)}`);
      meta.push(`Status: ${esc(e.status)}`);
      meta.push(`Inscrito: ${fmtDate(e.enrolled_at)}`);
      sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;${meta.join(" · ")}`);
      if (turma.whatsapp_group_link) {
        sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;💬 Grupo WhatsApp: <a href="${esc(turma.whatsapp_group_link)}">${esc(turma.whatsapp_group_link)}</a>`);
      }
      const docs: string[] = [];
      if (e.numero_contrato) docs.push(`Contrato ${esc(e.numero_contrato)}`);
      if (e.numero_proposta) docs.push(`Proposta ${esc(e.numero_proposta)}`);
      if (e.numero_nf) docs.push(`NF ${esc(e.numero_nf)}`);
      if (docs.length) sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;📄 ${docs.join(" · ")}`);
      const delivery: string[] = [];
      if (e.tipo_entrega) delivery.push(`Entrega: ${esc(e.tipo_entrega)}`);
      if (e.rastreamento) delivery.push(`Rastreio: ${esc(e.rastreamento)}`);
      if (delivery.length) sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;📦 ${delivery.join(" · ")}`);
      if (e.instagram) sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;📷 Instagram: ${esc(e.instagram)}`);
      if (e.certificate_pdf_path || e.certificate_generated_at) {
        sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;🎖️ Certificado: gerado em ${fmtDate(e.certificate_generated_at)}`);
      }
      if (e.notes) sub.push(`&nbsp;&nbsp;&nbsp;&nbsp;📝 Notas CS: ${esc(e.notes)}`);
      blocks.push(sub.join("<br>"));
    }
    sections.push(`<b>🎓 Cursos & Treinamentos</b><br>${blocks.join("<br>")}<br>`);
  } else {
    sections.push(`<b>🎓 Cursos & Treinamentos</b><br>• Sem matrículas registradas.<br>`);
  }

  // 6. Equipamentos declarados
  const equipLines: string[] = [];
  if (lead.tem_impressora) equipLines.push(`Impressora: ${esc(lead.impressora_modelo || lead.tem_impressora)}`);
  if (lead.tem_scanner) equipLines.push(`Scanner: ${esc(lead.tem_scanner)}`);
  if (lead.software_cad) equipLines.push(`CAD: ${esc(lead.software_cad)}`);
  if (lead.volume_mensal_pecas) equipLines.push(`Volume mensal: ${esc(lead.volume_mensal_pecas)}`);
  if (lead.principal_aplicacao) equipLines.push(`Aplicação: ${esc(lead.principal_aplicacao)}`);
  if (equipLines.length) {
    sections.push(`<b>🛠️ Equipamentos declarados</b><br>${equipLines.map(l => `• ${l}`).join("<br>")}<br>`);
  }


  const html = sections.join("<br>");
  // Hash excludes the "Atualizado em <hoje>" line so daily re-runs with
  // identical content don't trigger a fresh PipeRun note. Without this,
  // every Meta webhook redelivery posted a new identical "Resumo do Lead".
  const hashable = html.replace(/<i>Atualizado em [^<]*<\/i><br>/g, "");
  // Include dealId in the hash space so the same content posted on two
  // different deals counts as two distinct notes (per-deal lock semantics).
  const hash = await sha256Hex(`${opts.dealId ?? ""}::${hashable}`);
  return { html, hash };
}

/**
 * Plain-text (WhatsApp) version of the "Resumo do Lead" briefing.
 * Mesma estrutura da nota do PipeRun: Origem (com produto de interesse),
 * Identidade (com o link do WhatsApp logo abaixo), CRM, E-commerce,
 * Cursos e Equipamentos. SEM pitch, RAG, inteligência, diagnóstico,
 * formulários ou bloco de links.
 */
export async function buildSellerBriefingText(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
  opts: SellerSummaryOptions = {},
): Promise<string> {
  const { html } = await buildSellerDealSummaryHTML(supabase, lead, opts);
  return htmlNoteToWhatsApp(html);
}

/**
 * JID para o link wa.me. Varre TODOS os telefones conhecidos do lead — o
 * `telefone_normalized` às vezes chega truncado do Meta Lead Ads (ex.
 * `+55479924623`, 11 dígitos) e sozinho invalidaria o link.
 */
export function pickWaJid(lead: Record<string, unknown>): string {
  const candidates = [
    lead.telefone_normalized,
    lead.telefone_raw,
    (lead as any).wa_phone,
    (lead as any).astron_phone,
    (lead as any).empresa_telefone,
  ];
  for (const c of candidates) {
    const jid = (normalizeBrazilianPhone(String(c ?? "")) || "").replace(/\D/g, "");
    if (jid.length >= 12) return jid;
  }
  return "";
}

async function _unusedBuildSellerBriefingText(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
  opts: SellerSummaryOptions = {},
): Promise<string> {
  const { html } = await buildSellerDealSummaryHTML(supabase, lead, opts);
  return htmlNoteToWhatsApp(html);
}

function htmlNoteToWhatsApp(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>.*?<\/a>/gi, "$1")
    .replace(/<\/?(b|strong)>/gi, "*")
    .replace(/<\/?(i|em)>/gi, "_")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}
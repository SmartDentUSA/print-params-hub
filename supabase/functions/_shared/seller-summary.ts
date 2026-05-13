/**
 * Builds a complete "Resumo do Lead" HTML note for the seller, posted as a
 * PipeRun deal note. Consolidates: identity, origin, CRM history, e-commerce,
 * courses, 7x3 form responses, Dra. L.I.A. interactions, intelligence, links.
 *
 * Pure function — no PipeRun side-effects. Caller is responsible for posting
 * via addDealNote and for persisting `last_seller_note_hash` / `_at`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

export async function buildSellerDealSummaryHTML(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
  opts: SellerSummaryOptions = {},
): Promise<{ html: string; hash: string }> {
  const leadId = lead.id as string | undefined;
  const email = (lead.email as string | null) || null;
  const phoneDigits = String(lead.telefone_normalized || lead.telefone_raw || "").replace(/\D/g, "");

  // ── Parallel fetches (best-effort; never fail the whole note) ──
  const [ecomRes, enrollRes, formsRes, activityRes, agentLeadRes] = await Promise.all([
    email
      ? supabase.from("v_lead_ecommerce")
          .select("lojaintegrada_ltv,lojaintegrada_total_pedidos_pagos,lojaintegrada_primeira_compra,lojaintegrada_ultimo_pedido_data,lojaintegrada_ultimo_pedido_valor")
          .eq("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
    leadId
      ? supabase.from("smartops_course_enrollments")
          .select("deal_title,deal_pipeline_name,turma_snapshot,status,enrolled_at,certificate_generated_at")
          .eq("lead_id", leadId).order("enrolled_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    leadId
      ? supabase.from("lead_form_submissions")
          .select("form_type,form_data,submitted_at,equipment_mentioned,product_mentioned")
          .eq("lead_id", leadId).order("submitted_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    leadId
      ? supabase.from("lead_activity_log")
          .select("event_type,event_timestamp,entity_name,event_data")
          .eq("lead_id", leadId).order("event_timestamp", { ascending: false }).limit(15)
      : Promise.resolve({ data: [] }),
    email
      ? supabase.from("leads").select("id").eq("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
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

  // ── Build sections ──
  const sections: string[] = [];

  sections.push(`<b>🧾 Resumo do Lead — Smart Dent</b>`);
  sections.push(`<i>Atualizado em ${fmtDate(new Date().toISOString())}</i><br>`);

  // 1. Identidade
  sections.push(
    `<b>👤 Identidade</b><br>` +
    `• Nome: ${esc(lead.nome)}<br>` +
    `• E-mail: ${esc(lead.email)}<br>` +
    `• Telefone: ${esc(lead.telefone_normalized || lead.telefone_raw)}<br>` +
    `• Cidade/UF: ${esc(lead.cidade || "—")}/${esc(lead.uf || "—")}<br>` +
    `• Área: ${esc(lead.area_atuacao)} | Especialidade: ${esc(lead.especialidade)}<br>`,
  );

  // 2. Origem
  sections.push(
    `<b>🎯 Origem</b><br>` +
    `• Primeiro contato: ${fmtDate(lead.data_primeiro_contato || lead.created_at)}<br>` +
    `• Origem PipeRun: ${esc(lead.piperun_origin_name)}<br>` +
    `• Campanha: ${esc(lead.utm_campaign || lead.origem_campanha)}<br>` +
    `• Formulário inicial: ${esc(lead.form_name)}<br>`,
  );

  // 3. CRM histórico (a partir do piperun_deals_history)
  const history = (lead.piperun_deals_history as Array<Record<string, unknown>> | null) || [];
  let won = 0, lost = 0, open = 0;
  for (const d of history) {
    const s = String((d.status_name || d.status || "")).toLowerCase();
    if (s.includes("ganh")) won++;
    else if (s.includes("perd")) lost++;
    else open++;
  }
  const histLines = history
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, 8)
    .map(d => `&nbsp;&nbsp;◦ #${esc(d.deal_id)} — ${esc(d.pipeline_name || "—")} / ${esc(d.stage_name || "—")} — ${esc(d.status_name || "aberto")} — ${fmtMoney(d.value)} (${fmtDate(d.created_at)})`)
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
    const lines: string[] = [];
    if (lead.astron_user_id) {
      lines.push(`• Plataforma Astron: ${esc(lead.astron_courses_completed || 0)}/${esc(lead.astron_courses_total || 0)} cursos concluídos`);
    }
    for (const e of enrollments.slice(0, 5)) {
      const turma = (e.turma_snapshot as Record<string, unknown> | null)?.nome || "—";
      lines.push(`&nbsp;&nbsp;◦ ${esc(e.deal_title || "Treinamento")} — turma ${esc(turma)} — ${esc(e.status)} (${fmtDate(e.enrolled_at)})`);
    }
    sections.push(`<b>🎓 Cursos & Treinamentos</b><br>${lines.join("<br>")}<br>`);
  } else {
    sections.push(`<b>🎓 Cursos & Treinamentos</b><br>• Sem matrículas registradas.<br>`);
  }

  // 6. 7x3 — formulários
  const forms = ((formsRes as any)?.data as Array<Record<string, unknown>>) || [];
  const equipLines: string[] = [];
  if (lead.tem_impressora && lead.tem_impressora !== "nao") equipLines.push(`Impressora: ${esc(lead.impressora_modelo || lead.tem_impressora)}`);
  if (lead.tem_scanner && lead.tem_scanner !== "nao") equipLines.push(`Scanner: ${esc(lead.tem_scanner)}`);
  if (lead.software_cad) equipLines.push(`CAD: ${esc(lead.software_cad)}`);
  if (lead.volume_mensal_pecas) equipLines.push(`Volume mensal: ${esc(lead.volume_mensal_pecas)}`);
  if (lead.principal_aplicacao) equipLines.push(`Aplicação: ${esc(lead.principal_aplicacao)}`);

  let formsBlock = "";
  if (opts.highlightFormResponses?.length) {
    formsBlock += `<b>📝 Formulário recente: ${esc(opts.highlightFormName || "—")}</b><br>` +
      opts.highlightFormResponses.map(r => `• <b>${esc(r.label)}:</b> ${esc(r.value)}`).join("<br>") + "<br>";
  }
  if (forms.length) {
    formsBlock += `<b>📋 Formulários (últimos ${Math.min(forms.length, 5)} de ${forms.length})</b><br>`;
    for (const f of forms.slice(0, 5)) {
      const data = (f.form_data as Record<string, unknown>) || {};
      const fields = Object.entries(data).slice(0, 8)
        .map(([k, v]) => `&nbsp;&nbsp;◦ ${esc(k)}: ${esc(typeof v === "object" ? JSON.stringify(v) : v)}`)
        .join("<br>");
      formsBlock += `• <b>${esc(f.form_type)}</b> (${fmtDate(f.submitted_at)})<br>${fields || "&nbsp;&nbsp;◦ —"}<br>`;
    }
  }
  if (equipLines.length) {
    formsBlock += `<b>🛠️ Equipamentos declarados</b><br>${equipLines.map(l => `• ${l}`).join("<br>")}<br>`;
  }
  if (formsBlock) sections.push(formsBlock);

  // 7. Interações Dra. L.I.A.
  if (lastQuestions.length || lead.total_messages) {
    const qLines = lastQuestions.length
      ? lastQuestions.map(q => `&nbsp;&nbsp;◦ "${esc(q)}"`).join("<br>")
      : "&nbsp;&nbsp;◦ —";
    sections.push(
      `<b>💬 Dra. L.I.A.</b><br>` +
      `• Sessões: ${esc(lead.total_sessions || 0)} | Mensagens: ${esc(lead.total_messages || 0)}<br>` +
      `• Últimas perguntas:<br>${qLines}<br>`,
    );
  }

  // 8. Inteligência
  const intelLines: string[] = [];
  if (lead.confidence_score_analysis) intelLines.push(`Confiança: ${esc(lead.confidence_score_analysis)}%`);
  if (lead.lead_stage_detected) intelLines.push(`Estágio detectado: ${esc(lead.lead_stage_detected)}`);
  if (lead.urgency_level) intelLines.push(`Urgência: ${esc(lead.urgency_level)}`);
  if (lead.psychological_profile) intelLines.push(`Perfil: ${esc(lead.psychological_profile)}`);
  if (lead.primary_motivation) intelLines.push(`Motivação: ${esc(lead.primary_motivation)}`);
  if (lead.objection_risk) intelLines.push(`Risco de objeção: ${esc(lead.objection_risk)}`);
  if (lead.recommended_approach) intelLines.push(`Abordagem: ${esc(lead.recommended_approach)}`);
  if (intelLines.length) {
    sections.push(`<b>🧠 Inteligência</b><br>${intelLines.map(l => `• ${l}`).join("<br>")}<br>`);
  }

  // 9. Links rápidos
  const links: string[] = [];
  if (lead.piperun_link) links.push(`<a href="${esc(lead.piperun_link)}">PipeRun Deal</a>`);
  if (phoneDigits) links.push(`<a href="https://wa.me/${phoneDigits}">WhatsApp</a>`);
  if (leadId) links.push(`<a href="https://parametros.smartdent.com.br/admin?lead=${esc(leadId)}">Ficha Smart Ops</a>`);
  if (links.length) sections.push(`<b>🔗 Links</b><br>${links.join(" · ")}`);

  const html = sections.join("<br>");
  // Hash excludes the "Atualizado em <hoje>" line so daily re-runs with
  // identical content don't trigger a fresh PipeRun note. Without this,
  // every Meta webhook redelivery posted a new identical "Resumo do Lead".
  const hashable = html.replace(/<i>Atualizado em [^<]*<\/i><br>/g, "");
  const hash = await sha256Hex(hashable);
  return { html, hash };
}
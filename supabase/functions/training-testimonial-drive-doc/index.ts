/**
 * training-testimonial-drive-doc
 *
 * Grava, na pasta de Depoimentos do Drive da turma, um arquivo HTML com o
 * conteúdo EXATAMENTE igual ao publicado na Base de Conhecimento (mesmo
 * content_html, título, resumo e FAQs).
 *
 * Body:
 *   { testimonial_id }            → um depoimento
 *   { turma_id }                  → todos os depoimentos publicados da turma
 *   { all: true, limit?: number } → backfill dos publicados sem arquivo no Drive
 *
 * Idempotente: sobrescreve o arquivo pelo nome dentro da pasta e guarda o
 * file id em training_testimonials.article_drive_file_id.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDriveAccessToken, driveUploadFile } from "../_shared/drive.ts";
import {
  authorizeTestimonialCall, corsHeadersTestimonial, jsonResponse, logEvent,
  safeEqualSecret, serviceClient, slugify,
} from "../_shared/testimonial-pipeline.ts";

const PUBLIC_BASE = "https://parametros.smartdent.com.br";

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(v: any): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtMoney(v: any): string {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function row(label: string, value: any): string {
  const v = value === null || value === undefined ? "" : String(value).trim();
  if (!v) return "";
  return `<tr><th style="text-align:left;white-space:nowrap">${escapeHtml(label)}</th><td>${escapeHtml(v)}</td></tr>`;
}

/**
 * Ficha completa do lead — este arquivo vive apenas no Drive interno da turma,
 * por isso pode conter dados de contato, vendedor, compras e NPS (o artigo
 * público continua expondo somente nome, cidade/UF, especialidade e turma).
 */
function buildFicha(ctx: any): string {
  const { lead, enrollment, nps, deals, purchases, funnel } = ctx;
  const rows = [
    row("Nome completo", lead?.nome || enrollment?.person_name || ctx.participantName),
    row("Telefone de contato", lead?.telefone_normalized || lead?.telefone_raw || lead?.wa_phone || enrollment?.empresa_telefone),
    row("E-mail", lead?.email),
    row("Instagram do participante", enrollment?.instagram || lead?.instagram),
    row("Cidade / UF", [lead?.cidade || enrollment?.empresa_cidade, lead?.uf || enrollment?.empresa_estado].filter(Boolean).join(" / ")),
    row("Empresa / Clínica", lead?.empresa_nome || lead?.omie_razao_social),
    row("CNPJ / CPF", enrollment?.empresa_cnpj),
    row("Especialidade", enrollment?.especialidade || lead?.especialidade),
    row("Área de atuação", enrollment?.area_atuacao || lead?.area_atuacao),
    row("Vendedor responsável", ctx.vendedor),
    row("Curso / Turma", ctx.turmaLabel),
    row("Data do treinamento", fmtDate(ctx.trainingDate)),
    row("Origem de campanha", lead?.origem_campanha || lead?.utm_campaign || lead?.lojaintegrada_utm_campaign),
    row("Origem primeiro contato", lead?.origem_primeiro_contato || lead?.form_name || lead?.piperun_origin_name),
    row("Entrada no funil comercial", fmtDate(funnel?.vendas_at)),
    row("Entrada no funil CS", fmtDate(funnel?.cs_at)),
    row("Tempo Vendas → CS", funnel?.lead_time_days != null ? `${funnel.lead_time_days} dia(s)` : ""),
    row("NPS", nps
      ? `Respondido em ${fmtDate(nps.created_at)} — satisfação ${nps.score_satisfacao ?? "-"}, treinamento ${nps.score_treinamentos ?? "-"}, recomendação ${nps.score_recomendacao ?? "-"}`
      : (enrollment?.nps_status ? `${enrollment.nps_status}${enrollment.nps_sent_at ? ` (enviado em ${fmtDate(enrollment.nps_sent_at)})` : ""}` : "")),
    row("Comentário do NPS", nps?.comment),
    row("Data da primeira compra", fmtDate(purchases?.first_at)),
    row("Data da última compra", fmtDate(purchases?.last_at)),
    row("Total de compras (CRM ganhos)", purchases?.won_count || ""),
    row("Faturamento Omie", fmtMoney(lead?.omie_faturamento_total)),
    row("LTV e-commerce", fmtMoney(lead?.lojaintegrada_ltv)),
    row("Nº da proposta", enrollment?.numero_proposta),
    row("Nº do contrato", enrollment?.numero_contrato),
    row("Nota fiscal", enrollment?.numero_nf),
    row("Entrega / rastreamento", [enrollment?.tipo_entrega, enrollment?.rastreamento].filter(Boolean).join(" — ")),
  ].filter(Boolean).join("");

  const itemsHtml = (purchases?.items || []).length
    ? `<h3>Itens comprados</h3><table><tr><th>Data</th><th>Negócio / Pedido</th><th>Itens</th><th>Valor</th></tr>${
        purchases.items.map((i: any) =>
          `<tr><td>${escapeHtml(fmtDate(i.date))}</td><td>${escapeHtml(i.title || "")}</td><td>${escapeHtml(i.items || "")}</td><td>${escapeHtml(fmtMoney(i.value))}</td></tr>`,
        ).join("")
      }</table>`
    : "";

  const dealsHtml = (deals || []).length
    ? `<h3>Histórico de negócios (CRM)</h3><table><tr><th>Data</th><th>Pipeline / Etapa</th><th>Status</th><th>Vendedor</th><th>Valor</th></tr>${
        deals.map((d: any) =>
          `<tr><td>${escapeHtml(fmtDate(d.closed_at || d.piperun_created_at))}</td><td>${escapeHtml(`${d.pipeline_name || ""} / ${d.stage_name || ""}`)}</td><td>${escapeHtml(d.status || "")}</td><td>${escapeHtml(d.owner_name || "")}</td><td>${escapeHtml(fmtMoney(d.value))}</td></tr>`,
        ).join("")
      }</table>`
    : "";

  if (!rows && !itemsHtml && !dealsHtml) return "";
  return `<section class="ficha"><h2>Ficha completa do lead (uso interno)</h2>
<table>${rows}</table>${itemsHtml}${dealsHtml}</section>`;
}

/** Documento autocontido com o mesmo corpo publicado + ficha interna do lead. */
function buildDocument(content: any, publicUrl: string, ficha: string): string {
  const faqs = Array.isArray(content.faqs) ? content.faqs : [];
  const faqHtml = faqs.length
    ? `<section><h2>Perguntas frequentes</h2>${faqs.map((f: any) =>
        `<h3>${escapeHtml(f.question || f.pergunta || "")}</h3><p>${escapeHtml(f.answer || f.resposta || "")}</p>`,
      ).join("")}</section>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(content.title || "Depoimento")}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:32px auto;line-height:1.6;color:#111}
h1{color:#0b3f8f} h2{color:#0b3f8f;margin-top:28px} table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:6px 10px;font-size:14px;vertical-align:top} blockquote{border-left:4px solid #0b3f8f;padding-left:12px;color:#333}
.meta{font-size:13px;color:#555;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:24px}
.ficha{background:#f7f9fc;border:1px solid #dde5f0;padding:16px 20px;border-radius:8px;margin-bottom:28px}
</style></head>
<body>
<h1>${escapeHtml(content.title || "Depoimento")}</h1>
<div class="meta">
  <div><strong>Publicado em:</strong> ${escapeHtml(publicUrl)}</div>
  ${content.excerpt ? `<div><strong>Resumo:</strong> ${escapeHtml(content.excerpt)}</div>` : ""}
  ${content.meta_description ? `<div><strong>Meta description:</strong> ${escapeHtml(content.meta_description)}</div>` : ""}
</div>
${ficha}
${content.content_html || ""}
${faqHtml}
</body></html>`;
}

/** Reúne inscrição, lead, NPS, negócios e compras do participante. */
async function loadFicha(db: any, t: any, turma: any): Promise<string> {
  try {
    let enrollment: any = null;
    if (t.enrollment_id) {
      const { data } = await db.from("smartops_course_enrollments")
        .select("person_name, instagram, empresa_telefone, empresa_cnpj, empresa_cidade, empresa_estado, especialidade, area_atuacao, lead_id, deal_id, deal_title, deal_value, deal_pipeline_name, numero_proposta, numero_contrato, numero_nf, tipo_entrega, rastreamento, proposal_items_snapshot, nps_status, nps_sent_at, enrolled_at, created_at")
        .eq("id", t.enrollment_id).maybeSingle();
      enrollment = data || null;
    }

    let lead: any = null;
    if (enrollment?.lead_id) {
      const { data } = await db.from("lia_attendances")
        .select("nome, email, telefone_normalized, telefone_raw, wa_phone, instagram, cidade, uf, empresa_nome, omie_razao_social, especialidade, area_atuacao, proprietario_lead_crm, origem_campanha, utm_campaign, lojaintegrada_utm_campaign, origem_primeiro_contato, form_name, piperun_origin_name, omie_faturamento_total, omie_ultima_compra, lojaintegrada_ltv, lojaintegrada_ultimo_pedido_data, lojaintegrada_primeira_compra, lojaintegrada_historico_pedidos, piperun_created_at")
        .eq("id", enrollment.lead_id).maybeSingle();
      lead = data || null;
    }

    let nps: any = null;
    if (t.enrollment_id) {
      const { data } = await db.from("smartops_nps_responses")
        .select("score_satisfacao, score_treinamentos, score_recomendacao, comment, created_at")
        .eq("enrollment_id", t.enrollment_id)
        .order("created_at", { ascending: false }).limit(1);
      nps = data?.[0] || null;
    }

    let deals: any[] = [];
    if (enrollment?.lead_id) {
      const { data } = await db.from("deals")
        .select("pipeline_name, stage_name, status, value, owner_name, deal_title, items_text, piperun_created_at, closed_at")
        .eq("lead_id", enrollment.lead_id)
        .order("piperun_created_at", { ascending: true })
        .limit(200);
      deals = (data || []).filter((d: any) => !d.is_deleted);
    }

    const won = deals.filter((d: any) => /ganh|won/i.test(String(d.status || "")));
    const items = won.map((d: any) => ({
      date: d.closed_at || d.piperun_created_at,
      title: d.deal_title,
      items: d.items_text,
      value: d.value,
    }));
    const hist = Array.isArray(lead?.lojaintegrada_historico_pedidos) ? lead.lojaintegrada_historico_pedidos : [];
    for (const o of hist) {
      items.push({
        date: o?.data || o?.created_at || o?.data_criacao,
        title: `Pedido e-commerce ${o?.numero || o?.pedido_id || ""}`.trim(),
        items: Array.isArray(o?.itens)
          ? o.itens.map((i: any) => `${i?.quantidade || i?.qtd || 1}x ${i?.nome || i?.sku || ""}`).join("; ")
          : (o?.itens_text || ""),
        value: o?.valor_total ?? o?.total ?? o?.valor,
      });
    }
    const dates = items.map((i) => i.date).filter(Boolean).map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
    if (lead?.omie_ultima_compra) dates.push(new Date(lead.omie_ultima_compra));
    if (lead?.lojaintegrada_ultimo_pedido_data) dates.push(new Date(lead.lojaintegrada_ultimo_pedido_data));
    const valid = dates.filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());

    const vendasAt = deals.find((d: any) => /venda/i.test(String(d.pipeline_name || "")))?.piperun_created_at || lead?.piperun_created_at || null;
    const csAt = deals.find((d: any) => /\bcs\b|onboarding|sucesso/i.test(String(d.pipeline_name || "")))?.piperun_created_at || null;
    const leadTime = vendasAt && csAt
      ? Math.max(0, Math.round((new Date(csAt).getTime() - new Date(vendasAt).getTime()) / 86_400_000))
      : null;

    const vendedor = won.find((d: any) => d.owner_name)?.owner_name
      || deals.find((d: any) => d.owner_name)?.owner_name
      || lead?.proprietario_lead_crm || null;

    return buildFicha({
      lead, enrollment, nps, deals,
      participantName: t.participant_name,
      vendedor,
      turmaLabel: [turma?.label, turma?.turma_number ? `Turma ${turma.turma_number}` : ""].filter(Boolean).join(" — "),
      trainingDate: turma?.start_date || turma?.launch_date,
      funnel: { vendas_at: vendasAt, cs_at: csAt, lead_time_days: leadTime },
      purchases: {
        items: items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
        won_count: won.length,
        first_at: valid[0] || lead?.lojaintegrada_primeira_compra || null,
        last_at: valid[valid.length - 1] || null,
      },
    });
  } catch (e) {
    console.error("[training-testimonial-drive-doc] ficha:", (e as Error).message);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const cronKey = (Deno.env.get("TESTIMONIAL_CRON_KEY") || "").trim();
  const headerCron = (req.headers.get("x-cron-key") || "").trim();
  const isCron = Boolean(cronKey && headerCron && safeEqualSecret(headerCron, cronKey));
  let actor: string | null = null;
  if (!isCron) {
    const auth = await authorizeTestimonialCall(req);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
    actor = auth.actor ?? null;
  }

  const db = serviceClient();
  try {
    const body = await req.json().catch(() => ({} as any));
    const select =
      "id, turma_id, drive_folder_id, participant_name, enrollment_id, companion_id, knowledge_content_id, knowledge_slug, status, " +
      "smartops_course_turmas!inner(id, turma_number, label, start_date, launch_date, drive_folder_id, drive_subfolders)";

    let query = db.from("training_testimonials").select(select).not("knowledge_content_id", "is", null);
    if (body?.testimonial_id) query = query.eq("id", String(body.testimonial_id));
    else if (body?.turma_id) query = query.eq("turma_id", String(body.turma_id));
    else query = query.is("article_drive_file_id", null).limit(Math.min(Number(body?.limit) || 20, 50));

    const { data: rows, error } = await query;
    if (error) throw new Error(`depoimentos: ${error.message}`);
    if (!rows?.length) return jsonResponse({ processed: 0, items: [] });

    const token = await getDriveAccessToken();
    const items: any[] = [];

    for (const t of rows as any[]) {
      const item: Record<string, unknown> = { testimonial_id: t.id };
      try {
        const { data: content, error: cErr } = await db
          .from("knowledge_contents")
          .select("title, slug, excerpt, meta_description, content_html, faqs")
          .eq("id", t.knowledge_content_id)
          .maybeSingle();
        if (cErr) throw new Error(`artigo: ${cErr.message}`);
        if (!content?.content_html) throw new Error("artigo sem conteúdo publicado");

        const turma = t.smartops_course_turmas || {};
        const subfolders = (turma.drive_subfolders || {}) as Record<string, string>;
        const folderId = t.drive_folder_id || subfolders["videos_depoimentos"] || turma.drive_folder_id;
        if (!folderId) throw new Error("turma sem pasta no Drive");

        const publicUrl = `${PUBLIC_BASE}/base-conhecimento/e/${content.slug || t.knowledge_slug || ""}`;
        const baseName = slugify(
          `depoimento ${t.participant_name || content.title || t.id} turma ${turma.turma_number || ""}`,
        ) || `depoimento-${t.id}`;
        const fileName = `${baseName}.html`;

        const ficha = await loadFicha(db, t, turma);

        const fileId = await driveUploadFile({
          token,
          folderId,
          name: fileName,
          content: buildDocument(content, publicUrl, ficha),
          mimeType: "text/html",
          existingFileId: null,
          overwriteByName: true,
        });

        await db.from("training_testimonials").update({
          article_drive_file_id: fileId,
          article_drive_web_view_link: `https://drive.google.com/file/d/${fileId}/view`,
          article_drive_synced_at: new Date().toISOString(),
        }).eq("id", t.id);

        await logEvent(db, t.id, "drive_doc", "success", `Arquivo do artigo gravado no Drive: ${fileName}`,
          { drive_file_id: fileId, folder_id: folderId }, actor);

        item.drive_file_id = fileId;
        item.file_name = fileName;
        item.result = "ok";
      } catch (e) {
        const msg = String((e as Error).message || e);
        item.result = "error";
        item.error = msg.slice(0, 300);
        await logEvent(db, t.id, "drive_doc", "error", msg.slice(0, 500), {}, actor).catch(() => {});
      }
      items.push(item);
    }

    return jsonResponse({ processed: items.length, items });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-drive-doc]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

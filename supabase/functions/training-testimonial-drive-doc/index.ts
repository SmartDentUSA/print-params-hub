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

/** Documento autocontido com o mesmo corpo publicado. */
function buildDocument(content: any, publicUrl: string): string {
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
h1{color:#0b3f8f} h2{color:#0b3f8f;margin-top:28px} table{border-collapse:collapse}
td,th{border:1px solid #ddd;padding:6px 10px} blockquote{border-left:4px solid #0b3f8f;padding-left:12px;color:#333}
.meta{font-size:13px;color:#555;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:24px}
</style></head>
<body>
<h1>${escapeHtml(content.title || "Depoimento")}</h1>
<div class="meta">
  <div><strong>Publicado em:</strong> ${escapeHtml(publicUrl)}</div>
  ${content.excerpt ? `<div><strong>Resumo:</strong> ${escapeHtml(content.excerpt)}</div>` : ""}
  ${content.meta_description ? `<div><strong>Meta description:</strong> ${escapeHtml(content.meta_description)}</div>` : ""}
</div>
${content.content_html || ""}
${faqHtml}
</body></html>`;
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
      "id, turma_id, drive_folder_id, participant_name, knowledge_content_id, knowledge_slug, status, " +
      "smartops_course_turmas!inner(id, turma_number, label, drive_folder_id, drive_subfolders)";

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

        const fileId = await driveUploadFile({
          token,
          folderId,
          name: fileName,
          content: buildDocument(content, publicUrl),
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

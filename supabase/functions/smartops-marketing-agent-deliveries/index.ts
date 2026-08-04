// SmartOps – Marketing Treinamentos :: recebimento de KITS de conteúdo do agente.
//
// Escrita restrita: cria/atualiza entregáveis em `training_social_deliverables`
// com status "generated". NÃO publica, NÃO agenda e NÃO altera mídia do Drive.
// A aprovação humana acontece no Sistema B (RPC approve_training_deliverable).
//
// Autenticação: Authorization: Bearer <SMARTOPS_MARKETING_AGENT_API_KEY>
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadTrainingContext } from "../_shared/training-context.ts";
import { buildTrainingRagQuery, searchTrainingRag } from "../_shared/training-rag.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const AGENT_KEY = Deno.env.get("SMARTOPS_MARKETING_AGENT_API_KEY") || "";
const RATE_LIMIT_PER_MIN = 30;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://chat.openai.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin"];
const POST_TYPES = ["feed", "carousel", "reel", "story", "short", "video"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isJwtLike(token: string): boolean {
  return token.split(".").length === 3 || token.startsWith("sb_") || token.startsWith("eyJ");
}

function asStringArray(v: unknown, limit = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").replace(/^#/, "").trim()).filter(Boolean).slice(0, limit);
}

/* ----------------------------- validação ----------------------------- */

interface MediaInput {
  drive_file_id: string;
  destination_key?: string;
  media_role?: string;
  is_cover?: boolean;
  position?: number;
}

function parseDeliverable(raw: any, index: number): { error?: string; value?: any } {
  const platform = String(raw?.platform || "").toLowerCase().trim();
  const postType = String(raw?.post_type || "").toLowerCase().trim();
  if (!PLATFORMS.includes(platform)) return { error: `deliverables[${index}].platform inválido` };
  if (!POST_TYPES.includes(postType)) return { error: `deliverables[${index}].post_type inválido` };
  const caption = raw?.caption == null ? null : String(raw.caption).slice(0, 6000);
  const media: MediaInput[] = Array.isArray(raw?.media) ? raw.media : [];
  if (!media.length) return { error: `deliverables[${index}].media não pode ser vazio` };
  for (const m of media) {
    if (!m?.drive_file_id) return { error: `deliverables[${index}].media exige drive_file_id` };
  }
  return {
    value: {
      platform,
      post_type: postType,
      account_id: raw?.account_id ? String(raw.account_id).slice(0, 120) : null,
      caption,
      hashtags: asStringArray(raw?.hashtags),
      first_comment: raw?.first_comment ? String(raw.first_comment).slice(0, 2000) : null,
      cta: raw?.cta ? String(raw.cta).slice(0, 300) : null,
      title: raw?.title ? String(raw.title).slice(0, 200) : null,
      description: raw?.description ? String(raw.description).slice(0, 4000) : null,
      media: media.slice(0, 20),
    },
  };
}

/* ----------------------------- handlers ----------------------------- */

async function loadTurmaByNumber(db: any, turmaNumber: number) {
  const { data, error } = await db
    .from("smartops_course_turmas")
    .select(
      "id, turma_number, label, course_id, start_date, end_date, location, modality, drive_folder_id, drive_folder_url, drive_subfolders, smartops_courses(title, duration_days)",
    )
    .eq("turma_number", turmaNumber)
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data || [])[0] || null;
}

async function handleKit(db: any, body: any, fingerprint: string) {
  const turmaNumber = Number(body?.turma_number);
  if (!Number.isInteger(turmaNumber) || turmaNumber < 1) {
    return json({ error: "turma_number inválido (esperado inteiro, ex.: 157)" }, 400);
  }
  const deliverablesRaw = Array.isArray(body?.deliverables) ? body.deliverables : [];
  if (!deliverablesRaw.length) return json({ error: "deliverables é obrigatório" }, 400);
  if (deliverablesRaw.length > 20) return json({ error: "máximo de 20 entregáveis por kit" }, 400);

  const parsed: any[] = [];
  for (let i = 0; i < deliverablesRaw.length; i++) {
    const r = parseDeliverable(deliverablesRaw[i], i);
    if (r.error) return json({ error: r.error }, 400);
    parsed.push(r.value);
  }

  const turma = await loadTurmaByNumber(db, turmaNumber);
  if (!turma) return json({ error: `Turma ${turmaNumber} não encontrada` }, 404);

  // Mídia precisa existir no Drive da turma (registro em training_drive_media).
  const fileIds = [...new Set(parsed.flatMap((d) => d.media.map((m: MediaInput) => String(m.drive_file_id))))];
  const { data: mediaRows, error: mediaErr } = await db
    .from("training_drive_media")
    .select("drive_file_id, drive_folder_id, drive_web_view_link, generated_filename, mime_type, size_bytes, width, height, destination_key, status")
    .eq("turma_id", turma.id)
    .in("drive_file_id", fileIds);
  if (mediaErr) throw new Error(`training_drive_media: ${mediaErr.message}`);
  const byFile = new Map<string, any>();
  for (const r of mediaRows || []) byFile.set(String(r.drive_file_id), r);
  const unknown = fileIds.filter((id) => !byFile.has(id));
  if (unknown.length) {
    return json(
      { error: "Mídia não pertence ao Drive desta turma ou não está registrada", unknown_drive_file_ids: unknown },
      422,
    );
  }

  // Contexto real + RAG guardados como snapshot de auditoria.
  const ctx = await loadTrainingContext(db, turma);
  const rag = await searchTrainingRag(
    db,
    buildTrainingRagQuery({
      course_title: ctx.course.title,
      stage_topic: ctx.stages.map((s) => s.topic).filter(Boolean).slice(0, 3).join(" "),
      equipment: ctx.equipment,
      products: ctx.course.related_product_names,
    }),
    6,
  );

  const kitRunId = crypto.randomUUID();
  const created: any[] = [];

  for (const d of parsed) {
    let suggestion: any = null;
    try {
      const { data } = await db.rpc("suggest_training_post_slot", { _platform: d.platform, _format: d.post_type });
      suggestion = data || null;
    } catch (_) { /* sugestão é best-effort */ }

    const { data: row, error: insErr } = await db
      .from("training_social_deliverables")
      .insert({
        turma_id: turma.id,
        kit_run_id: kitRunId,
        platform: d.platform,
        account_id: d.account_id,
        post_type: d.post_type,
        caption: d.caption,
        hashtags: d.hashtags,
        first_comment: d.first_comment,
        cta: d.cta,
        title: d.title,
        description: d.description,
        suggested_at: suggestion?.suggested_at ?? null,
        suggestion_basis: suggestion ?? null,
        suggestion_confidence: suggestion?.confidence ?? null,
        copy_context_snapshot: {
          course: ctx.course,
          stages: ctx.stages,
          equipment: ctx.equipment,
          participants: {
            total: ctx.participants.total,
            cities: ctx.participants.cities,
            states: ctx.participants.states,
            specialties: ctx.participants.specialties,
          },
          instagram_handles: ctx.participants.instagram_handles,
        },
        rag_context_snapshot: rag,
        status: "generated",
        agent_source: String(body?.agent_source || "smartops-marketing-gpt").slice(0, 120),
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`deliverable: ${insErr.message}`);

    const mediaPayload = d.media.map((m: MediaInput, idx: number) => {
      const src = byFile.get(String(m.drive_file_id));
      return {
        deliverable_id: row.id,
        position: Number.isInteger(m.position) ? m.position : idx,
        drive_folder_id: src.drive_folder_id,
        drive_file_id: src.drive_file_id,
        drive_web_view_link: src.drive_web_view_link,
        generated_filename: src.generated_filename,
        mime_type: src.mime_type,
        size_bytes: src.size_bytes,
        width: src.width,
        height: src.height,
        media_role: m.media_role ? String(m.media_role).slice(0, 60) : src.destination_key,
        is_cover: !!m.is_cover || idx === 0,
      };
    });
    const { error: mErr } = await db.from("training_social_deliverable_media").insert(mediaPayload);
    if (mErr) throw new Error(`deliverable_media: ${mErr.message}`);

    created.push({ deliverable_id: row.id, platform: d.platform, post_type: d.post_type, media_count: mediaPayload.length });
  }

  return json({
    ok: true,
    kit_run_id: kitRunId,
    turma_id: turma.id,
    turma_number: turma.turma_number,
    status: "generated",
    awaiting_human_approval: true,
    caller_fingerprint: fingerprint,
    deliverables: created,
  }, 201);
}

async function handleRevise(db: any, deliverableId: string, body: any) {
  const { data: current, error } = await db
    .from("training_social_deliverables")
    .select("id, status")
    .eq("id", deliverableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) return json({ error: "Entregável não encontrado" }, 404);
  if (!["generated", "changes_requested"].includes(String(current.status))) {
    return json({ error: `Entregável em status "${current.status}" não aceita revisão pelo agente` }, 409);
  }

  const patch: Record<string, unknown> = { status: "generated", updated_at: new Date().toISOString() };
  if (body?.caption != null) patch.caption = String(body.caption).slice(0, 6000);
  if (body?.hashtags != null) patch.hashtags = asStringArray(body.hashtags);
  if (body?.first_comment != null) patch.first_comment = String(body.first_comment).slice(0, 2000);
  if (body?.cta != null) patch.cta = String(body.cta).slice(0, 300);
  if (body?.title != null) patch.title = String(body.title).slice(0, 200);
  if (body?.description != null) patch.description = String(body.description).slice(0, 4000);

  const { error: upErr } = await db.from("training_social_deliverables").update(patch).eq("id", deliverableId);
  if (upErr) throw new Error(upErr.message);
  return json({ ok: true, deliverable_id: deliverableId, status: "generated" });
}

/* ----------------------------- servidor ----------------------------- */

serve(async (req) => {
  const started = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = admin();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^.*smartops-marketing-agent-deliveries/, "").replace(/\/+$/, "") || "/";
  let fingerprint = "unknown";
  let endpointName = rawPath;

  const log = async (status: number, extra: Record<string, unknown> = {}) => {
    try {
      await db.from("marketing_agent_api_log").insert({
        endpoint: `deliveries${endpointName}`,
        method: req.method,
        status_code: status,
        ok: status < 400,
        caller_fingerprint: fingerprint,
        duration_ms: Date.now() - started,
        details: extra,
      });
    } catch (_) { /* logging nunca quebra a resposta */ }
  };

  try {
    if (!["POST", "PATCH"].includes(req.method)) {
      await log(405, { reason: "método não permitido" });
      return json({ error: "Método não permitido (use POST ou PATCH)" }, 405);
    }

    if (!AGENT_KEY) {
      await log(500, { reason: "SMARTOPS_MARKETING_AGENT_API_KEY não configurada" });
      return json({ error: "API não configurada" }, 500);
    }
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      await log(401, { reason: "credencial ausente" });
      return json({ error: "Credencial ausente" }, 401);
    }
    const token = authHeader.slice(7).trim();
    if (!token || (ANON_KEY && token === ANON_KEY) || token === SERVICE_ROLE || isJwtLike(token) || !safeEqual(token, AGENT_KEY)) {
      await log(401, { reason: "credencial inválida" });
      return json({ error: "Credencial inválida" }, 401);
    }
    fingerprint = (await sha256(`${token}|${req.headers.get("x-forwarded-for") || ""}`)).slice(0, 32);

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from("marketing_agent_api_log")
      .select("id", { count: "exact", head: true })
      .eq("caller_fingerprint", fingerprint)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
      await log(429, { reason: "rate limit", window_count: count });
      return json({ error: "Limite de requisições excedido. Tente novamente em 1 minuto." }, 429);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      await log(400, { reason: "JSON inválido" });
      return json({ error: "Corpo JSON inválido" }, 400);
    }

    if (req.method === "POST" && (rawPath === "/kits" || rawPath === "/")) {
      endpointName = "/kits";
      const res = await handleKit(db, body, fingerprint);
      await log(res.status, { turma_number: body?.turma_number });
      return res;
    }

    const m = rawPath.match(/^\/deliverables\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (req.method === "PATCH" && m) {
      endpointName = "/deliverables/{id}";
      const res = await handleRevise(db, m[1], body);
      await log(res.status);
      return res;
    }

    await log(404, { reason: "rota inexistente" });
    return json({ error: "Rota não encontrada", path: rawPath }, 404);
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    console.error("[smartops-marketing-agent-deliveries]", msg);
    await log(500, { error: msg });
    return json({ error: "Erro interno ao registrar o kit" }, 500);
  }
});
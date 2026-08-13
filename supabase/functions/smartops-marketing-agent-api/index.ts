// SmartOps – Marketing Treinamentos :: API somente leitura para o GPT privado.
//
// FASE 1: SOMENTE LEITURA. Nenhuma escrita, upload, aprovação, agendamento ou
// publicação é possível por esta função. Apenas GET e OPTIONS são aceitos.
//
// Autenticação: Authorization: Bearer <SMARTOPS_MARKETING_AGENT_API_KEY>
// (integração servidor-servidor; JWT de usuário do frontend NÃO é aceito).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDriveAccessToken, driveListFilesDetailed } from "../_shared/drive.ts";
import { loadTrainingContext } from "../_shared/training-context.ts";
import { buildTrainingRagQuery, searchTrainingRag } from "../_shared/training-rag.ts";
import {
  authorizeMedia,
  buildAccessUrls,
  eligibleFor,
  resolveTrainingSchedule,
  type AuthorizedMedia,
} from "../_shared/training-media-access.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const AGENT_KEY = Deno.env.get("SMARTOPS_MARKETING_AGENT_API_KEY") || "";

const RATE_LIMIT_PER_MIN = 60;

const corsHeaders: Record<string, string> = {
  // GPT Actions chama de servidor (sem Origin). Mantemos apenas o necessário.
  "Access-Control-Allow-Origin": "https://chat.openai.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

/* -------------------------- segurança -------------------------- */

/** Comparação em tempo constante. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) {
    // ainda percorre para não vazar tamanho de forma trivial
    let acc = 1;
    for (let i = 0; i < Math.max(ea.length, eb.length); i++) acc |= 1;
    return false && acc === 1;
  }
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

/* -------------------------- helpers -------------------------- */

const DESTINATIONS: Record<string, { label: string; kind: "photo" | "video"; requiresDay: boolean; testimonial: boolean; required: boolean; lastDayOnly?: boolean }> = {
  fotos_turma: { label: "03 - Fotos Originais › 01 - Foto da Turma", kind: "photo", requiresDay: false, testimonial: false, required: true, lastDayOnly: true },
  fotos_participantes_certificados: { label: "03 - Fotos Originais › 02 - Participantes com Certificados", kind: "photo", requiresDay: false, testimonial: false, required: true, lastDayOnly: true },
  fotos_atividades: { label: "03 - Fotos Originais › 03 - Atividades Práticas", kind: "photo", requiresDay: false, testimonial: false, required: true },
  fotos_equipamentos: { label: "03 - Fotos Originais › 04 - Equipamentos e Resultados", kind: "photo", requiresDay: false, testimonial: false, required: false },
  fotos_bastidores: { label: "03 - Fotos Originais › 05 - Bastidores", kind: "photo", requiresDay: false, testimonial: false, required: false },
  videos_vertical: { label: "04 - Vídeos Originais › 01 - Vídeos Verticais", kind: "video", requiresDay: true, testimonial: false, required: true },
  videos_horizontal: { label: "04 - Vídeos Originais › 02 - Vídeos Horizontais", kind: "video", requiresDay: true, testimonial: false, required: false },
  videos_depoimentos: { label: "04 - Vídeos Originais › 03 - Depoimentos", kind: "video", requiresDay: false, testimonial: true, required: true },
  videos_atividades: { label: "04 - Vídeos Originais › 04 - Atividades Práticas", kind: "video", requiresDay: true, testimonial: false, required: false },
  videos_bastidores: { label: "04 - Vídeos Originais › 05 - Bastidores", kind: "video", requiresDay: true, testimonial: false, required: false },
};

const PHOTO_MIMES = ["image/jpeg", "image/pjpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

const TURMA_SELECT =
  "id, turma_number, label, course_id, start_date, end_date, active, location, modality, factory_status, " +
  "drive_folder_id, drive_folder_url, drive_folder_name, drive_subfolders, smartops_courses(title, slug, duration_days)";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCancelled(t: any): boolean {
  const hay = `${t?.label || ""} ${t?.factory_status || ""}`.toLowerCase();
  return /cancel/.test(hay);
}

function derivedStatus(t: any): string {
  if (isCancelled(t)) return "cancelada";
  if (t?.active === false) return "inativa";
  const today = todayISO();
  const start = t?.start_date ? String(t.start_date).slice(0, 10) : null;
  const end = t?.end_date ? String(t.end_date).slice(0, 10) : start;
  if (!start) return "sem_data";
  if (today < start) return "agendada";
  if (end && today > end) return "concluida";
  return "em_andamento";
}

/** Concluída há no máximo 60 dias, em andamento ou futura. */
function withinWindow(t: any): boolean {
  const start = t?.start_date ? String(t.start_date).slice(0, 10) : null;
  const end = (t?.end_date ? String(t.end_date) : start || "").slice(0, 10);
  if (!start) return false;
  if (!end) return true;
  const endMs = new Date(`${end}T23:59:59Z`).getTime();
  return endMs >= Date.now() - 60 * 24 * 3600 * 1000;
}

function subfolderKeys(t: any): string[] {
  const sf = (t?.drive_subfolders || {}) as Record<string, string>;
  return Object.keys(DESTINATIONS).filter((k) => !!sf[k]);
}

function courseTitle(t: any): string {
  return t?.smartops_courses?.title || "(curso não encontrado)";
}

function eligibility(t: any, enrolled: number, companions: number) {
  const reasons: string[] = [];
  if (isCancelled(t)) reasons.push("turma cancelada");
  if (t?.active === false) reasons.push("turma inativa/não liberada");
  if (!t?.start_date) reasons.push("sem data de início cadastrada");
  else if (!withinWindow(t)) reasons.push("turma concluída há mais de 60 dias");
  if (enrolled < 1) reasons.push("nenhuma inscrição válida");
  if (!t?.drive_folder_id) reasons.push("pasta do Google Drive não criada (drive_folder_id ausente)");
  if (!subfolderKeys(t).length) reasons.push("estrutura drive_subfolders ausente");
  return { eligible: reasons.length === 0, reasons, enrolled, companions };
}

/** Dia 1/2/3/Geral a partir do nome oficial do arquivo. */
function dayFromName(name: string): string {
  const m = name.match(/_DIA-(\d+)_/i);
  if (m) return `Dia ${m[1]}`;
  if (/_GERAL_/i.test(name)) return "Geral";
  return "Geral";
}

function participantFromName(name: string): string | null {
  const m = name.match(/_DEPOIMENTO_(.+?)_\d{3,}\./i);
  return m ? m[1].replace(/-/g, " ") : null;
}

/* -------------------------- data loaders -------------------------- */

async function loadTurma(db: any, turmaId: string) {
  const { data, error } = await db.from("smartops_course_turmas").select(TURMA_SELECT).eq("id", turmaId).maybeSingle();
  if (error) throw new Error(`turma: ${error.message}`);
  return data;
}

/** Carrega turma pelo número (ex.: 157). Se houver mais de uma, usa a mais recente. */
async function loadTurmaByNumber(db: any, turmaNumber: number) {
  const { data, error } = await db
    .from("smartops_course_turmas")
    .select(TURMA_SELECT)
    .eq("turma_number", turmaNumber)
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw new Error(`turma_number: ${error.message}`);
  return (data || [])[0] || null;
}

async function countsFor(db: any, turmaIds: string[]) {
  const enrolled = new Map<string, number>();
  const companions = new Map<string, number>();
  if (!turmaIds.length) return { enrolled, companions };
  const { data: enrolls } = await db
    .from("smartops_course_enrollments")
    .select("id, turma_id, status")
    .in("turma_id", turmaIds);
  const validIds: string[] = [];
  for (const e of enrolls || []) {
    const st = String(e.status || "").toLowerCase();
    if (["cancelado", "cancelada", "no_show", "invalido"].includes(st)) continue;
    enrolled.set(e.turma_id, (enrolled.get(e.turma_id) || 0) + 1);
    validIds.push(e.id);
  }
  if (validIds.length) {
    const { data: comps } = await db
      .from("smartops_enrollment_companions")
      .select("id, enrollment_id")
      .in("enrollment_id", validIds);
    const byEnroll = new Map<string, string>();
    for (const e of enrolls || []) byEnroll.set(e.id, e.turma_id);
    for (const c of comps || []) {
      const tid = byEnroll.get(c.enrollment_id);
      if (tid) companions.set(tid, (companions.get(tid) || 0) + 1);
    }
  }
  return { enrolled, companions };
}

async function turmaDays(db: any, turmaId: string) {
  const { data } = await db
    .from("smartops_turma_days")
    .select("day_number, date, start_time, end_time, topic")
    .eq("turma_id", turmaId)
    .order("day_number", { ascending: true });
  return (data || []).map((d: any) => ({
    day_number: d.day_number,
    date: d.date,
    start_time: d.start_time,
    end_time: d.end_time,
    topic: d.topic,
  }));
}

async function mediaRows(db: any, turmaId: string) {
  const { data } = await db
    .from("training_drive_media")
    .select(
      "id, destination_key, drive_file_id, generated_filename, original_filename, mime_type, size_bytes, width, height, orientation, training_day, training_date, category, status, error_message, participant_name_snapshot, participant_type, enrollment_id, companion_id, uploaded_at",
    )
    .eq("turma_id", turmaId);
  return data || [];
}

async function buildInventory(db: any, turma: any) {
  const sf = (turma.drive_subfolders || {}) as Record<string, string>;
  const keys = subfolderKeys(turma);
  const rows = await mediaRows(db, turma.id);
  const byFileId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const r of rows) {
    if (r.drive_file_id) byFileId.set(r.drive_file_id, r);
    if (r.generated_filename) byName.set(String(r.generated_filename).toLowerCase(), r);
  }

  const token = keys.length ? await getDriveAccessToken() : null;
  const destinations = await Promise.all(
    keys.map(async (key) => {
      const spec = DESTINATIONS[key];
      let files: any[] = [];
      let driveError: string | null = null;
      try {
        files = token ? await driveListFilesDetailed(token, sf[key]) : [];
      } catch (e) {
        driveError = String((e as any)?.message || e).slice(0, 300);
      }
      const items = files.map((f) => {
        const rec = byFileId.get(f.id) || byName.get(f.name.toLowerCase()) || null;
        const orientation = rec?.orientation || (f.width && f.height ? (f.height > f.width ? "vertical" : "horizontal") : null);
        return {
          drive_file_id: f.id,
          filename: f.name,
          mime_type: f.mimeType,
          size_bytes: f.size,
          created_time: f.createdTime,
          width: f.width,
          height: f.height,
          orientation,
          kind: spec.kind,
          day: spec.requiresDay ? dayFromName(f.name) : "Geral",
          participant_name: spec.testimonial ? rec?.participant_name_snapshot || participantFromName(f.name) : null,
          db_status: rec?.status || null,
          registered_in_db: !!rec,
        };
      });
      return {
        destination_key: key,
        label: spec.label,
        kind: spec.kind,
        requires_day: spec.requiresDay,
        is_testimonial: spec.testimonial,
        drive_folder_id: sf[key],
        file_count: items.length,
        drive_error: driveError,
        files: items,
      };
    }),
  );

  const missingKeys = Object.keys(DESTINATIONS).filter((k) => !sf[k]);
  return { destinations, missing_subfolders: missingKeys, db_rows: rows };
}

/* -------------------------- handlers -------------------------- */

async function handleEligible(db: any, url: URL) {
  const onlyEligible = (url.searchParams.get("only_eligible") || "").toLowerCase() === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50) || 50, 200);
  const { data, error } = await db
    .from("smartops_course_turmas")
    .select(TURMA_SELECT)
    .order("start_date", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  const turmas = data || [];
  const { enrolled, companions } = await countsFor(db, turmas.map((t: any) => t.id));

  const out = turmas
    .map((t: any) => {
      const el = eligibility(t, enrolled.get(t.id) || 0, companions.get(t.id) || 0);
      return {
        turma_id: t.id,
        turma_number: t.turma_number,
        course_title: courseTitle(t),
        turma_label: t.label,
        start_date: t.start_date,
        end_date: t.end_date,
        status: derivedStatus(t),
        enrolled_count: el.enrolled,
        companions_count: el.companions,
        drive_folder_url: t.drive_folder_url,
        is_eligible: el.eligible,
        blocking_reasons: el.reasons,
      };
    })
    .filter((t: any) => (onlyEligible ? t.is_eligible : true))
    .slice(0, limit);

  return json({ count: out.length, only_eligible: onlyEligible, trainings: out });
}

async function handleTraining(db: any, turma: any) {
  const { enrolled, companions } = await countsFor(db, [turma.id]);
  const days = await turmaDays(db, turma.id);
  const keys = subfolderKeys(turma);
  const total = Object.keys(DESTINATIONS).length;
  const el = eligibility(turma, enrolled.get(turma.id) || 0, companions.get(turma.id) || 0);
  return json({
    turma_id: turma.id,
    turma_number: turma.turma_number,
    turma_label: turma.label,
    course: { title: courseTitle(turma), slug: turma.smartops_courses?.slug ?? null, duration_days: turma.smartops_courses?.duration_days ?? null },
    start_date: turma.start_date,
    end_date: turma.end_date,
    location: turma.location,
    modality: turma.modality,
    status: derivedStatus(turma),
    days,
    enrolled_count: enrolled.get(turma.id) || 0,
    companions_count: companions.get(turma.id) || 0,
    drive_folder_id: turma.drive_folder_id,
    drive_folder_url: turma.drive_folder_url,
    drive_subfolder_keys: keys,
    drive_structure: {
      expected: total,
      present: keys.length,
      missing: Object.keys(DESTINATIONS).filter((k) => !keys.includes(k)),
      complete: keys.length === total,
    },
    is_eligible: el.eligible,
    blocking_reasons: el.reasons,
  });
}

async function handleParticipants(db: any, turma: any) {
  const { data: enrolls, error } = await db
    .from("smartops_course_enrollments")
    .select("id, person_name, status, is_client_smartdent")
    .eq("turma_id", turma.id)
    .order("person_name", { ascending: true });
  if (error) throw new Error(error.message);
  const ids = (enrolls || []).map((e: any) => e.id);
  const compsByEnroll = new Map<string, any[]>();
  if (ids.length) {
    const { data: comps } = await db
      .from("smartops_enrollment_companions")
      .select("id, enrollment_id, name")
      .in("enrollment_id", ids);
    for (const c of comps || []) {
      const arr = compsByEnroll.get(c.enrollment_id) || [];
      arr.push(c);
      compsByEnroll.set(c.enrollment_id, arr);
    }
  }
  const rows: any[] = [];
  for (const e of enrolls || []) {
    rows.push({
      enrollment_id: e.id,
      participant_name: e.person_name,
      participant_type: "titular",
      enrollment_status: e.status,
      companion_id: null,
      companion_name: null,
      companion_type: null,
    });
    for (const c of compsByEnroll.get(e.id) || []) {
      rows.push({
        enrollment_id: e.id,
        participant_name: e.person_name,
        participant_type: "titular",
        enrollment_status: e.status,
        companion_id: c.id,
        companion_name: c.name,
        companion_type: "acompanhante",
      });
    }
  }
  return json({ turma_id: turma.id, turma_number: turma.turma_number, count: rows.length, participants: rows });
}

async function handleInventory(db: any, turma: any) {
  const inv = await buildInventory(db, turma);
  const totalFiles = inv.destinations.reduce((a, d) => a + d.file_count, 0);
  return json({
    turma_id: turma.id,
    turma_number: turma.turma_number,
    course_title: courseTitle(turma),
    drive_folder_url: turma.drive_folder_url,
    total_files: totalFiles,
    missing_subfolders: inv.missing_subfolders,
    destinations: inv.destinations,
  });
}

/** Contexto editorial da turma (curso, etapas, equipamentos, público) + RAG. */
async function handleContext(db: any, turma: any) {
  const ctx = await loadTrainingContext(db, turma);
  const query = buildTrainingRagQuery({
    course_title: ctx.course.title,
    stage_topic: ctx.stages.map((s) => s.topic).filter(Boolean).slice(0, 3).join(" "),
    equipment: ctx.equipment,
    products: ctx.course.related_product_names,
  });
  const rag = await searchTrainingRag(db, query, 6);
  return json({ ...ctx, rag });
}

async function handleRagSearch(db: any, url: URL) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "Parâmetro q é obrigatório" }, 400);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 6) || 6, 1), 12);
  const rag = await searchTrainingRag(db, q, limit);
  return json(rag);
}

async function handleGaps(db: any, turma: any) {
  const inv = await buildInventory(db, turma);
  const schedule = await resolveTrainingSchedule(db, turma);
  const { data: enrolls } = await db
    .from("smartops_course_enrollments")
    .select("id, person_name, status")
    .eq("turma_id", turma.id);
  const participantNames = (enrolls || []).map((e: any) => String(e.person_name || ""));

  const present: string[] = [];
  const missing: string[] = [];
  const videosWithoutDay: any[] = [];
  const testimonialsWithoutParticipant: any[] = [];
  const invalidFormats: any[] = [];
  const invalidDays: any[] = [];
  const driveOnly: any[] = [];

  const driveFileIds = new Set<string>();
  for (const d of inv.destinations) {
    const spec = DESTINATIONS[d.destination_key];
    if (d.file_count > 0) present.push(d.destination_key);
    else if (spec?.required) missing.push(d.destination_key);
    for (const f of d.files) {
      driveFileIds.add(f.drive_file_id);
      if (spec.requiresDay && (!f.day || f.day === "Geral")) {
        videosWithoutDay.push({ destination_key: d.destination_key, filename: f.filename });
      }
      const dayNum = Number(String(f.day || "").replace(/\D/g, ""));
      if (dayNum && schedule.total_training_days && dayNum > schedule.last_training_day) {
        invalidDays.push({
          destination_key: d.destination_key,
          filename: f.filename,
          day_number: dayNum,
          reason: `INVALID_TRAINING_DAY: a turma tem ${schedule.total_training_days} dia(s)`,
        });
      }
      if (spec.testimonial && !f.participant_name) {
        testimonialsWithoutParticipant.push({ destination_key: d.destination_key, filename: f.filename });
      }
      const allowed = spec.kind === "photo" ? PHOTO_MIMES : VIDEO_MIMES;
      if (f.mime_type && !allowed.includes(f.mime_type)) {
        invalidFormats.push({ destination_key: d.destination_key, filename: f.filename, mime_type: f.mime_type, expected_kind: spec.kind });
      }
      if (!f.registered_in_db) {
        driveOnly.push({ destination_key: d.destination_key, filename: f.filename, drive_file_id: f.drive_file_id });
      }
    }
  }
  for (const key of inv.missing_subfolders) {
    if (DESTINATIONS[key]?.required && !missing.includes(key)) missing.push(key);
  }

  const rows = inv.db_rows as any[];
  const pending = rows.filter((r) => ["pending", "uploading", "created"].includes(String(r.status || "").toLowerCase()))
    .map((r) => ({ destination_key: r.destination_key, filename: r.generated_filename, status: r.status }));
  const failed = rows.filter((r) => String(r.status || "").toLowerCase() === "failed")
    .map((r) => ({ destination_key: r.destination_key, filename: r.generated_filename, error: r.error_message }));
  const dbOnly = rows
    .filter((r) => String(r.status || "").toLowerCase() === "completed" && (!r.drive_file_id || !driveFileIds.has(r.drive_file_id)))
    .map((r) => ({ destination_key: r.destination_key, filename: r.generated_filename, drive_file_id: r.drive_file_id }));

  const testimonialFiles = inv.destinations.find((d) => d.destination_key === "videos_depoimentos")?.files || [];
  const covered = new Set(testimonialFiles.map((f: any) => String(f.participant_name || "").toUpperCase().replace(/\s+/g, " ").trim()));
  const participantsWithoutTestimonial = participantNames.filter(
    (n) => n && !covered.has(n.toUpperCase().replace(/\s+/g, " ").trim()),
  );

  // Cobertura por dia real da turma (nunca 3 dias fixos).
  const dayCoverage = schedule.days.map((d) => {
    const files = inv.destinations.flatMap((dest) =>
      (dest.files || []).filter((f: any) => Number(String(f.day || "").replace(/\D/g, "")) === d.day_number)
        .map((f: any) => ({ destination_key: dest.destination_key, filename: f.filename, drive_file_id: f.drive_file_id })),
    );
    const inFuture = !!d.date && d.date > new Date().toISOString().slice(0, 10);
    return {
      day_number: d.day_number,
      date: d.date,
      topic: d.topic,
      file_count: files.length,
      files,
      status: files.length ? "covered" : inFuture ? "not_applicable_yet" : "missing",
    };
  });

  return json({
    turma_id: turma.id,
    turma_number: turma.turma_number,
    course_title: courseTitle(turma),
    total_training_days: schedule.total_training_days,
    last_training_day: schedule.last_training_day,
    current_training_day: schedule.current_training_day,
    schedule_source: schedule.schedule_source,
    schedule_inconsistency: schedule.inconsistency,
    day_coverage: dayCoverage,
    invalid_training_days: invalidDays,
    present_categories: present,
    missing_categories: missing,
    videos_without_day: videosWithoutDay,
    testimonials_without_participant: testimonialsWithoutParticipant,
    participants_without_testimonial: participantsWithoutTestimonial,
    invalid_formats: invalidFormats,
    pending_records: pending,
    failed_records: failed,
    drive_files_without_db_record: driveOnly,
    db_records_without_drive_file: dbOnly,
  });
}


/* ------------------- acesso real às mídias (leitura) ------------------- */

function mediaPayload(media: AuthorizedMedia, urls: any) {
  return {
    drive_file_id: media.drive_file_id,
    media_id: media.media_id,
    filename: media.filename,
    mime_type: media.mime_type,
    kind: media.kind,
    size_bytes: media.size_bytes,
    width: media.width,
    height: media.height,
    orientation: media.orientation,
    duration_seconds: media.duration_seconds,
    destination_key: media.destination_key,
    day_number: media.day_number,
    participant_id: media.participant_id,
    participant_name: media.participant_name,
    registered_in_db: media.registered_in_db,
    eligible_for: eligibleFor(media),
    access: { ...urls, read_only: true },
  };
}

const ACCESS_ERROR_STATUS: Record<string, number> = {
  MEDIA_NOT_FOUND: 404,
  MEDIA_NOT_IN_TRAINING: 403,
  TRAINING_DRIVE_NOT_CONFIGURED: 409,
};

async function handleMediaAccess(db: any, turma: any, url: URL) {
  const fileId = (url.searchParams.get("drive_file_id") || "").trim();
  if (!fileId) return json({ error: "MISSING_PARAM", message: "Parâmetro drive_file_id é obrigatório" }, 400);
  const res = await authorizeMedia(db, turma, fileId);
  if (!res.ok) return json({ error: res.error, message: res.message }, ACCESS_ERROR_STATUS[res.error] || 400);
  const urls = await buildAccessUrls(SUPABASE_URL, turma.id, fileId, res.media.kind);
  return json({ turma_id: turma.id, turma_number: turma.turma_number, media: mediaPayload(res.media, urls) });
}

async function handleMediaAccessBatch(db: any, turma: any, url: URL) {
  const raw = (url.searchParams.get("drive_file_ids") || "").trim();
  let ids = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  // Sem lista explícita: usa o inventário da turma com filtros opcionais.
  if (!ids.length) {
    const inv = await buildInventory(db, turma);
    const wantedKeys = (url.searchParams.get("destination_keys") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const wantedDay = url.searchParams.get("day_number");
    for (const d of inv.destinations) {
      if (wantedKeys.length && !wantedKeys.includes(d.destination_key)) continue;
      for (const f of d.files || []) {
        if (wantedDay && Number(String((f as any).day || "").replace(/\D/g, "")) !== Number(wantedDay)) continue;
        ids.push((f as any).drive_file_id);
      }
    }
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25) || 25, 1), 50);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0) || 0, 0);
  const total = ids.length;
  const page = ids.slice(offset, offset + limit);

  const items: any[] = [];
  const errors: any[] = [];
  for (const id of page) {
    const res = await authorizeMedia(db, turma, id);
    if (!res.ok) {
      errors.push({ drive_file_id: id, error: res.error, message: res.message });
      continue;
    }
    const urls = await buildAccessUrls(SUPABASE_URL, turma.id, id, res.media.kind);
    items.push(mediaPayload(res.media, urls));
  }

  return json({
    turma_id: turma.id,
    turma_number: turma.turma_number,
    total,
    offset,
    limit,
    next_offset: offset + limit < total ? offset + limit : null,
    count: items.length,
    media: items,
    errors,
  });
}

/* -------------------------- servidor -------------------------- */


serve(async (req) => {
  const started = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = admin();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^.*smartops-marketing-agent-api/, "").replace(/\/+$/, "") || "/";
  let turmaIdForLog: string | null = null;
  let fingerprint = "unknown";
  let endpointName = rawPath;

  const log = async (status: number, extra: Record<string, unknown> = {}) => {
    try {
      await db.from("marketing_agent_api_log").insert({
        endpoint: endpointName,
        method: req.method,
        turma_id: turmaIdForLog,
        status_code: status,
        ok: status < 400,
        caller_fingerprint: fingerprint,
        duration_ms: Date.now() - started,
        details: extra,
      });
    } catch (_) { /* logging nunca quebra a resposta */ }
  };

  try {
    // Método
    if (req.method !== "GET") {
      await log(405, { reason: "método não permitido na fase somente leitura" });
      return json({ error: "Método não permitido. Esta API é somente leitura (GET)." }, 405);
    }

    // Autenticação
    const authHeader = req.headers.get("Authorization") || "";
    if (!AGENT_KEY) {
      await log(500, { reason: "SMARTOPS_MARKETING_AGENT_API_KEY não configurada" });
      return json({ error: "API não configurada" }, 500);
    }
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

    // Rate limit
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

    // Rotas
    if (rawPath === "/eligible-trainings") {
      endpointName = "/eligible-trainings";
      const res = await handleEligible(db, url);
      await log(200);
      return res;
    }

    if (rawPath === "/rag/search") {
      endpointName = "/rag/search";
      const res = await handleRagSearch(db, url);
      await log(res.status);
      return res;
    }

    // /trainings/by-number/{turma_number}[/sub]
    const byNum = rawPath.match(/^\/trainings\/by-number\/([^/]+)(\/participants|\/media-inventory|\/media-gaps|\/media-access|\/media-access-batch|\/context)?$/);
    if (byNum) {
      const raw = decodeURIComponent(byNum[1]).trim();
      const sub = byNum[2] || "";
      endpointName = `/trainings/by-number/{turma_number}${sub}`;
      if (!/^\d{1,6}$/.test(raw)) {
        await log(400, { reason: "turma_number inválido" });
        return json({ error: "turma_number inválido (esperado inteiro, ex.: 157)" }, 400);
      }
      const turma = await loadTurmaByNumber(db, Number(raw));
      if (!turma) {
        await log(404, { reason: "turma não encontrada por número" });
        return json({ error: `Turma ${raw} não encontrada` }, 404);
      }
      turmaIdForLog = turma.id;
      let res: Response;
      if (sub === "/participants") res = await handleParticipants(db, turma);
      else if (sub === "/media-inventory") res = await handleInventory(db, turma);
      else if (sub === "/media-gaps") res = await handleGaps(db, turma);
      else if (sub === "/media-access") res = await handleMediaAccess(db, turma, url);
      else if (sub === "/media-access-batch") res = await handleMediaAccessBatch(db, turma, url);
      else if (sub === "/context") res = await handleContext(db, turma);
      else res = await handleTraining(db, turma);
      await log(res.status);
      return res;
    }

    const m = rawPath.match(/^\/trainings\/([^/]+)(\/participants|\/media-inventory|\/media-gaps|\/media-access|\/media-access-batch|\/context)?$/);
    if (m) {
      const ident = decodeURIComponent(m[1]).trim();
      const sub = m[2] || "";
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ident);
      const isNumber = /^\d{1,6}$/.test(ident);
      endpointName = `/trainings/{turma_id}${sub}`;
      if (!isUuid && !isNumber) {
        await log(400, { reason: "identificador inválido" });
        return json({ error: "Identificador inválido (use o UUID da turma ou o número da turma, ex.: 157)" }, 400);
      }
      const turma = isUuid ? await loadTurma(db, ident) : await loadTurmaByNumber(db, Number(ident));
      turmaIdForLog = turma?.id ?? (isUuid ? ident : null);
      if (!turma) {
        await log(404, { reason: "turma não encontrada" });
        return json({ error: "Turma não encontrada" }, 404);
      }
      let res: Response;
      if (sub === "/participants") res = await handleParticipants(db, turma);
      else if (sub === "/media-inventory") res = await handleInventory(db, turma);
      else if (sub === "/media-gaps") res = await handleGaps(db, turma);
      else if (sub === "/media-access") res = await handleMediaAccess(db, turma, url);
      else if (sub === "/media-access-batch") res = await handleMediaAccessBatch(db, turma, url);
      else if (sub === "/context") res = await handleContext(db, turma);
      else res = await handleTraining(db, turma);
      await log(res.status);
      return res;
    }

    await log(404, { reason: "rota inexistente" });
    return json({ error: "Rota não encontrada", path: rawPath }, 404);
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    console.error("[smartops-marketing-agent-api]", msg);
    await log(500, { error: msg });
    return json({ error: "Erro interno ao processar a consulta" }, 500);
  }
});

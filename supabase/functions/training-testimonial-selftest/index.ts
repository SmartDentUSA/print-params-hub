/**
 * training-testimonial-selftest
 *
 * Smoke test do pipeline de depoimentos. NÃO transcreve, NÃO publica,
 * NÃO envia nada ao Panda. Apenas:
 *  - valida a autorização (Bearer do agente, x-api-key e rejeição da anon key);
 *  - valida acesso à pasta oficial "Depoimentos" no Panda Video;
 *  - lista candidatos reais de depoimento no Drive da turma informada.
 * Nunca expõe valores de segredos.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authorizeTestimonialCall, corsHeadersTestimonial, jsonResponse, serviceClient,
  TESTIMONIAL_DESTINATION_KEY, MAX_AUDIO_BYTES,
} from "../_shared/testimonial-pipeline.ts";
import { assertTestimonialsFolder, testimonialsFolderId } from "../_shared/pandavideo-testimonials.ts";
import { driveFindChild, driveListFilesDetailed, getDriveAccessToken } from "../_shared/drive.ts";

const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

async function probe(fn: string, headers: Record<string, string>) {
  try {
    const res = await fetch(`${FN_BASE}/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({}),
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 200) };
  } catch (e) {
    return { status: 0, body: String((e as Error).message) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  const turmaNumber = Number(body?.turma_number ?? 157);
  const db = serviceClient();
  const out: Record<string, unknown> = { turma_number: turmaNumber };

  // 1) Autorização: agent key em Bearer e em x-api-key; anon deve ser rejeitada.
  const agentKey = (Deno.env.get("SMARTOPS_MARKETING_AGENT_API_KEY") || "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const targets = [
    "training-testimonial-transcribe",
    "training-testimonial-panda-upload",
    "training-testimonial-publish",
  ];
  const authResults: Record<string, unknown> = {};
  for (const fn of targets) {
    authResults[fn] = {
      bearer_agent: await probe(fn, { Authorization: `Bearer ${agentKey}` }),
      x_api_key: await probe(fn, { "x-api-key": agentKey }),
      anon_bearer: await probe(fn, { Authorization: `Bearer ${anonKey}` }),
      no_credential: await probe(fn, {}),
    };
  }
  out.auth = authResults;
  out.agent_key_configured = agentKey.length > 0;

  // 2) Pasta oficial no Panda Video.
  try {
    const folder = await assertTestimonialsFolder();
    out.panda_folder = { ok: true, id: folder.id, name: folder.name, expected: testimonialsFolderId() };
  } catch (e) {
    out.panda_folder = { ok: false, error: String((e as Error).message) };
  }

  // 3) Candidatos reais de depoimento da turma.
  const { data: turma } = await db
    .from("smartops_course_turmas")
    .select("id, turma_number, start_date, end_date, drive_folder_id, course_id")
    .eq("turma_number", turmaNumber)
    .maybeSingle();
  out.turma = turma ?? null;

  if (turma?.drive_folder_id) {
    try {
      const token = await getDriveAccessToken();
      const sub = await driveFindChild(token, turma.drive_folder_id, "Depoimentos", true);
      if (!sub) {
        out.drive = { ok: true, depoimentos_folder: null, note: "Subpasta 'Depoimentos' ainda não existe" };
      } else {
        const files = await driveListFilesDetailed(token, sub);
        const videos = files
          .filter((f) => (f.mimeType || "").startsWith("video/") || (f.mimeType || "").startsWith("audio/"))
          .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
          .map((f) => ({
            drive_file_id: f.id,
            name: f.name,
            mime_type: f.mimeType,
            size_bytes: f.size,
            within_stt_limit: f.size != null ? f.size <= MAX_AUDIO_BYTES : null,
          }));
        out.drive = { ok: true, depoimentos_folder: sub, total_files: files.length, video_candidates: videos };
      }
    } catch (e) {
      out.drive = { ok: false, error: String((e as Error).message) };
    }
  }

  // 4) Mídias já registradas e depoimentos existentes.
  const { data: media } = await db
    .from("training_drive_media")
    .select("id, drive_file_id, original_filename, generated_filename, size_bytes, mime_type, participant_name_snapshot, participant_type, status, destination_key, category")
    .eq("turma_id", turma?.id ?? "00000000-0000-0000-0000-000000000000")
    .eq("destination_key", TESTIMONIAL_DESTINATION_KEY);
  out.registered_media = media ?? [];

  const { data: testimonials } = await db
    .from("training_testimonials")
    .select("id, drive_file_id, participant_name, status, pandavideo_id, panda_folder_id, video_player, video_conversion_status, knowledge_slug")
    .eq("turma_id", turma?.id ?? "00000000-0000-0000-0000-000000000000");
  out.testimonials = testimonials ?? [];

  return jsonResponse(out);
});

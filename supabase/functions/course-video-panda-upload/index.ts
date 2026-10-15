/**
 * course-video-panda-upload
 * Recebe o vídeo bruto (body) de um usuário autenticado ou do portal do profissional
 * e o envia via TUS ao Panda Video, na pasta "# - Videos dos cursos Kols".
 * Headers: x-filename, x-course-id (opcional), x-orientation (vertical|horizontal), content-length.
 * Nome no Panda: "Nome do Profissional - Nome do curso - Chamada vertical|horizontal".
 * Vertical com curso: cópia privada no Storage (para as redes) + pipeline kol-course-reels-publish.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getPandaVideo, pandaApiKey, pickUploaderHost } from "../_shared/pandavideo-testimonials.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-filename, x-title, x-portal-token, x-course-id, x-orientation` };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const b64 = (v: string) => btoa(String.fromCharCode(...new TextEncoder().encode(v)));
const KOL_FOLDER_NAME = "# - Videos dos cursos Kols";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function kolFolderId(): Promise<string> {
  const env = (Deno.env.get("PANDAVIDEO_KOL_COURSES_FOLDER_ID") || "").trim();
  if (env) return env;
  const h = { Authorization: pandaApiKey(), "Content-Type": "application/json" };
  const r = await fetch("https://api-v2.pandavideo.com.br/folders", { headers: h });
  const d = await r.json().catch(() => ({}));
  const list: any[] = d?.folders ?? (Array.isArray(d) ? d : []);
  const found = list.find((f) => String(f?.name || "").trim().toLowerCase() === KOL_FOLDER_NAME.toLowerCase());
  if (found?.id) return String(found.id);
  const c = await fetch("https://api-v2.pandavideo.com.br/folders", { method: "POST", headers: h, body: JSON.stringify({ name: KOL_FOLDER_NAME }) });
  const cd = await c.json().catch(() => ({}));
  const id = cd?.id ?? cd?.folder?.id;
  if (!id) throw new Error(`Não foi possível criar a pasta "${KOL_FOLDER_NAME}" no Panda: ${JSON.stringify(cd).slice(0, 200)}`);
  return String(id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization") || "";
    const portalToken = (req.headers.get("x-portal-token") || "").trim();
    let allowed = false;
    let portalLeadId: string | null = null;
    if (portalToken && portalToken.length >= 12 && portalToken.length <= 128) {
      const { data: t } = await admin.from("professional_portal_tokens")
        .select("*").eq("token", portalToken).maybeSingle();
      allowed = !!t && !t.revoked_at && (!t.expires_at || new Date(t.expires_at).getTime() > Date.now());
      portalLeadId = (t as any)?.lead_id ?? (t as any)?.producer_lead_id ?? null;
    } else {
      const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      allowed = !!user;
    }
    if (!allowed) return json({ error: "Não autenticado" }, 401);

    const size = Number(req.headers.get("content-length") || 0);
    if (!size || size <= 0) return json({ error: "Arquivo vazio" }, 400);
    if (!req.body) return json({ error: "Arquivo ausente" }, 400);
    const filename = decodeURIComponent(req.headers.get("x-filename") || "video.mp4").slice(0, 200);
    const orientation = (req.headers.get("x-orientation") || "").toLowerCase() === "vertical" ? "vertical" : "horizontal";
    const courseId = (req.headers.get("x-course-id") || "").trim();

    // Nome padronizado: Profissional - Curso - Chamada vertical/horizontal
    let course: any = null;
    let profName = "";
    if (/^[0-9a-f-]{36}$/i.test(courseId)) {
      const { data: c } = await admin.from("professional_courses").select("id, title, producer_lead_id").eq("id", courseId).maybeSingle();
      if (c && (!portalLeadId || c.producer_lead_id === portalLeadId)) {
        course = c;
        const { data: l } = await admin.from("lia_attendances").select("nome, prof_display_name").eq("id", c.producer_lead_id).is("merged_into", null).maybeSingle();
        profName = String((l as any)?.prof_display_name || (l as any)?.nome || "").trim();
      }
    }
    const fallbackTitle = decodeURIComponent(req.headers.get("x-title") || filename);
    const title = (course
      ? `${profName || "Profissional"} - ${course.title} - Chamada ${orientation}`
      : fallbackTitle).slice(0, 200);
    const ext = (filename.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const pandaFilename = `${title.replace(/[\\/:*?"<>|]/g, " ")}.${ext}`;

    // Vertical: duplica o stream para o Storage privado (mídia das redes)
    let pandaBody: ReadableStream<Uint8Array> = req.body;
    let storagePromise: Promise<string | null> = Promise.resolve(null);
    if (course && orientation === "vertical") {
      const [a, b] = req.body.tee();
      pandaBody = a;
      const path = `${course.id}/reels-${Date.now()}.${ext}`;
      storagePromise = fetch(`${SUPABASE_URL}/storage/v1/object/kol-course-reels/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": ext === "mov" ? "video/quicktime" : "video/mp4", "x-upsert": "true" },
        body: b,
        // @ts-ignore Deno stream upload
        duplex: "half",
      }).then(async (r) => { if (!r.ok) { console.error("[storage]", r.status, await r.text()); return null; } return path; })
        .catch((e) => { console.error("[storage]", e); return null; });
    }

    const videoId = crypto.randomUUID();
    const folderId = await kolFolderId();
    const meta = [
      `authorization ${b64(pandaApiKey())}`,
      `video_id ${b64(videoId)}`,
      `filename ${b64(pandaFilename)}`,
      `title ${b64(title)}`,
      `folder_id ${b64(folderId)}`,
    ].join(", ");
    const host = await pickUploaderHost();
    const [res, storagePath] = await Promise.all([
      fetch(`${host}/files`, {
        method: "POST",
        headers: { "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Content-Type": "application/offset+octet-stream", "Upload-Metadata": meta },
        body: pandaBody,
        // @ts-ignore
        duplex: "half",
      }),
      storagePromise,
    ]);
    const txt = await res.text();
    if (!res.ok) throw new Error(`Upload Panda ${res.status}: ${txt.slice(0, 300)}`);

    let state = null;
    for (let i = 0; i < 8 && !state?.video_player; i++) {
      state = await getPandaVideo(videoId).catch(() => null);
      if (!state?.video_player) await new Promise((r) => setTimeout(r, 2500));
    }

    let pipeline: string | null = null;
    if (course && orientation === "vertical") {
      await admin.from("professional_courses").update({
        reels_pandavideo_id: videoId,
        reels_storage_path: storagePath,
        ...(state?.video_player ? { reels_video_url: state.video_player } : {}),
        reels_social_status: storagePath ? "pending" : "error",
        reels_social_error: storagePath ? null : "Cópia do vídeo para as redes falhou",
      }).eq("id", course.id);
      if (storagePath) {
        pipeline = "started";
        const p = fetch(`${SUPABASE_URL}/functions/v1/kol-course-reels-publish`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: course.id }),
        }).catch((e) => console.error("[pipeline]", e));
        // @ts-ignore EdgeRuntime existe no Supabase
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
      }
    }

    return json({
      pandavideo_id: videoId, title, folder_id: folderId,
      video_player: state?.video_player ?? null, thumbnail: state?.thumbnail ?? null,
      status: state?.status ?? "uploaded", pipeline,
    });
  } catch (e) {
    console.error("[course-video-panda-upload]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

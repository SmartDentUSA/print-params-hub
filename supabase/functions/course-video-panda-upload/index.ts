/**
 * course-video-panda-upload
 * Recebe o arquivo de vídeo bruto (body) de um usuário autenticado e o envia
 * via TUS ao Panda Video, retornando o player para salvar em video_url.
 * Headers: x-filename, x-title (opcional), content-length obrigatório.
 * Pasta: PANDAVIDEO_COURSES_FOLDER_ID quando configurado.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getPandaVideo, pandaApiKey, pickUploaderHost } from "../_shared/pandavideo-testimonials.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-filename, x-title` };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const b64 = (v: string) => btoa(String.fromCharCode(...new TextEncoder().encode(v)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const portalToken = (req.headers.get("x-portal-token") || "").trim();
    let allowed = false;
    if (portalToken && portalToken.length >= 12 && portalToken.length <= 128) {
      // Profissional no portal (sem login): token válido, não revogado e não expirado
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      const { data: t } = await admin.from("professional_portal_tokens")
        .select("revoked_at, expires_at").eq("token", portalToken).maybeSingle();
      allowed = !!t && !t.revoked_at && (!t.expires_at || new Date(t.expires_at).getTime() > Date.now());
    } else {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      allowed = !!user;
    }
    if (!allowed) return json({ error: "Não autenticado" }, 401);

    const size = Number(req.headers.get("content-length") || 0);
    if (!size || size <= 0) return json({ error: "Arquivo vazio" }, 400);
    if (!req.body) return json({ error: "Arquivo ausente" }, 400);
    const filename = decodeURIComponent(req.headers.get("x-filename") || "video.mp4").slice(0, 200);
    const title = decodeURIComponent(req.headers.get("x-title") || filename).slice(0, 200);

    const videoId = crypto.randomUUID();
    const folderId = (Deno.env.get("PANDAVIDEO_COURSES_FOLDER_ID") || "").trim();
    const meta = [
      `authorization ${b64(pandaApiKey())}`,
      `video_id ${b64(videoId)}`,
      `filename ${b64(filename)}`,
      `title ${b64(title)}`,
      ...(folderId ? [`folder_id ${b64(folderId)}`] : []),
    ].join(", ");
    const host = await pickUploaderHost();
    const res = await fetch(`${host}/files`, {
      method: "POST",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(size),
        "Content-Type": "application/offset+octet-stream",
        "Upload-Metadata": meta,
      },
      body: req.body,
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`Upload Panda ${res.status}: ${txt.slice(0, 300)}`);

    let state = null;
    for (let i = 0; i < 8 && !state?.video_player; i++) {
      state = await getPandaVideo(videoId).catch(() => null);
      if (!state?.video_player) await new Promise((r) => setTimeout(r, 2500));
    }
    return json({
      pandavideo_id: videoId,
      video_player: state?.video_player ?? null,
      thumbnail: state?.thumbnail ?? null,
      status: state?.status ?? "uploaded",
    });
  } catch (e) {
    console.error("[course-video-panda-upload]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

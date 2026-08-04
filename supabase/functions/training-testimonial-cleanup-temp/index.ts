// Temporário: remove artefatos do teste E2E (vídeo no Panda + arquivo no Drive).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDriveAccessToken } from "../_shared/drive.ts";
import { deletePandaVideo } from "../_shared/pandavideo-testimonials.ts";
import { authorizeTestimonialCall, corsHeadersTestimonial, jsonResponse } from "../_shared/testimonial-pipeline.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
  const { panda_video_id, drive_file_id } = await req.json().catch(() => ({}));
  const out: Record<string, string> = {};
  if (panda_video_id) {
    try { await deletePandaVideo(panda_video_id); out.panda = "deleted"; }
    catch (e) { out.panda = `erro: ${(e as Error).message}`; }
  }
  if (drive_file_id) {
    try {
      const token = await getDriveAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${drive_file_id}?supportsAllDrives=true`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      out.drive = res.ok || res.status === 404 ? "deleted" : `erro ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) { out.drive = `erro: ${(e as Error).message}`; }
  }
  return jsonResponse(out);
});

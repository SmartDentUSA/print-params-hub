// Temporário: remove os DOIS artefatos do teste E2E (ids fixos). Sem parâmetros.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDriveAccessToken } from "../_shared/drive.ts";
import { deletePandaVideo } from "../_shared/pandavideo-testimonials.ts";
import { corsHeadersTestimonial, jsonResponse } from "../_shared/testimonial-pipeline.ts";

const PANDA_ID = "e8b720df-6329-4e8b-abbb-e99193fd4ea1";
const DRIVE_ID = "1RmcXswR6cA6IydjJC-SXcHJz-9W_h4X9";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const out: Record<string, string> = {};
  try { await deletePandaVideo(PANDA_ID); out.panda = "deleted"; }
  catch (e) { out.panda = `erro: ${(e as Error).message}`; }
  try {
    const token = await getDriveAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${DRIVE_ID}?supportsAllDrives=true`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    out.drive = res.ok || res.status === 404 ? "deleted" : `erro ${res.status}: ${(await res.text()).slice(0, 200)}`;
  } catch (e) { out.drive = `erro: ${(e as Error).message}`; }
  return jsonResponse(out);
});

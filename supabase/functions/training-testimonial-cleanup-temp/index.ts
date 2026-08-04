// Temporário: remove os artefatos do teste E2E (ids fixos). Sem parâmetros.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { driveTrashFile, getDriveAccessToken } from "../_shared/drive.ts";
import { deletePandaVideo, getPandaVideo } from "../_shared/pandavideo-testimonials.ts";
import { corsHeadersTestimonial, jsonResponse } from "../_shared/testimonial-pipeline.ts";

const PANDA_ID = "e8b720df-6329-4e8b-abbb-e99193fd4ea1";
const DRIVE_ID = "1RmcXswR6cA6IydjJC-SXcHJz-9W_h4X9";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const out: Record<string, unknown> = {};
  try {
    const state = await getPandaVideo(PANDA_ID);
    out.panda_state = state ? { id: state.id, title: state.title, folder: state.folder_id } : null;
    if (state) {
      try { await deletePandaVideo(state.id); out.panda = "deleted"; }
      catch (e) { out.panda = `erro: ${(e as Error).message}`; }
    } else out.panda = "not_found";
  } catch (e) { out.panda = `erro: ${(e as Error).message}`; }
  try {
    const token = await getDriveAccessToken();
    await driveTrashFile(token, DRIVE_ID);
    out.drive = "trashed";
  } catch (e) { out.drive = `erro: ${(e as Error).message}`; }
  return jsonResponse(out);
});

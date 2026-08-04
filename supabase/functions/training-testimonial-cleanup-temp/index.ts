// Temporário: marca o vídeo de teste no Panda (delete via API retorna 500) e
// remove as linhas de teste do banco.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersTestimonial, jsonResponse, serviceClient } from "../_shared/testimonial-pipeline.ts";

const VIDEO_ID = "6fa63054-66b2-4a87-aefd-16ada3eca094";
const TEST_TITLE = "ZZ [TESTE INTERNO - REMOVER MANUALMENTE] Turma 157";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const out: Record<string, unknown> = {};
  const key = Deno.env.get("PANDAVIDEO_API_KEY")!;
  const res = await fetch(`https://api-v2.pandavideo.com.br/videos/${VIDEO_ID}`, {
    method: "PUT",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ title: TEST_TITLE }),
  });
  out.panda_rename = `${res.status} ${(await res.text()).slice(0, 200)}`;

  const db = serviceClient();
  const del1 = await db.from("training_testimonials").delete().ilike("generated_filename", "%DEPOIMENTO_TESTE-SISTEMA%").select("id");
  out.testimonials_removed = del1.data?.length ?? del1.error?.message;
  const del2 = await db.from("training_drive_media").delete().ilike("generated_filename", "%DEPOIMENTO_TESTE-SISTEMA%").select("id");
  out.drive_media_removed = del2.data?.length ?? del2.error?.message;
  return jsonResponse(out);
});

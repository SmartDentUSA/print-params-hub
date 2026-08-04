// Temporário: localiza e remove o vídeo de teste na pasta oficial de Depoimentos.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { deletePandaVideo, testimonialsFolderId } from "../_shared/pandavideo-testimonials.ts";
import { corsHeadersTestimonial, jsonResponse } from "../_shared/testimonial-pipeline.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });
  const key = Deno.env.get("PANDAVIDEO_API_KEY") || Deno.env.get("lVIDEO_API_KEY")!;
  const folder = testimonialsFolderId();
  const res = await fetch(`https://api-v2.pandavideo.com.br/videos?folder_id=${folder}&limit=50`, {
    headers: { Authorization: key },
  });
  const text = await res.text();
  let list: any[] = [];
  try {
    const data = JSON.parse(text);
    list = data?.videos ?? data?.data ?? (Array.isArray(data) ? data : []);
  } catch { /* devolve cru abaixo */ }
  const found = list.filter((v) => /TESTE|DEPOIMENTO_TESTE|Claudio Rog/i.test(String(v?.title || "")));
  const deleted: Record<string, string> = {};
  for (const v of found) {
    try { await deletePandaVideo(String(v.id)); deleted[String(v.id)] = "deleted"; }
    catch (e) { deleted[String(v.id)] = `erro: ${(e as Error).message}`; }
  }
  return jsonResponse({
    status: res.status,
    total: list.length,
    titles: list.map((v) => ({ id: v?.id, title: v?.title })).slice(0, 50),
    deleted,
    raw: list.length ? undefined : text.slice(0, 500),
  });
});

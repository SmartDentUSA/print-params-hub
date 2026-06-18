import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { callPoe } from "../_shared/providers/poe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  event_id: z.string().uuid(),
  language: z.enum(["pt", "en", "es"]),
  prompt: z.string().trim().min(3).max(2000),
  reference_image_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
});

const LANG_LABEL: Record<string, string> = {
  pt: "português brasileiro",
  en: "inglês",
  es: "espanhol",
};

function extractImageUrl(text: string): string | null {
  if (!text) return null;
  const md = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (md) return md[1];
  const bare = text.match(/(https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|webp)(?:\?[^\s)"']*)?)/i);
  if (bare) return bare[1];
  const any = text.match(/(https?:\/\/[^\s)"']+)/);
  return any ? any[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { event_id, language, prompt, reference_image_url, logo_url } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: ev, error: evErr } = await supabase
      .from("smartops_events")
      .select("id,name,country,location,start_date,end_date,company_stand")
      .eq("id", event_id)
      .maybeSingle();
    if (evErr || !ev) {
      return new Response(JSON.stringify({ error: "Evento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPrompt = [
      `Crie uma capa hero horizontal 16:9 (1200x675px) para o evento "${ev.name}" — material da marca Smart Dent (fluxo digital odontológico).`,
      `Idioma da arte: ${LANG_LABEL[language]}. Aplique tipografia limpa e palavras-chave nesse idioma se houver overlay.`,
      ev.location || ev.country ? `Contexto: ${[ev.location, ev.country].filter(Boolean).join(" — ")}.` : "",
      ev.start_date || ev.end_date ? `Datas: ${[ev.start_date, ev.end_date].filter(Boolean).join(" → ")}.` : "",
      "Estética: editorial premium, alto contraste, tecnológica, cores Smart Dent (azul profundo + acentos). Composição cinematográfica com espaço para overlay de título no canto esquerdo.",
      reference_image_url ? "Use a imagem de referência fornecida como inspiração visual (paleta, ambiente)." : "",
      logo_url ? "Considere posicionar o logo do evento fornecido no canto superior direito, discreto." : "",
      "Brief do usuário:",
      prompt,
    ].filter(Boolean).join("\n");

    const content: any[] = [{ type: "text", text: fullPrompt }];
    if (reference_image_url) content.push({ type: "image_url", image_url: { url: reference_image_url } });
    if (logo_url) content.push({ type: "image_url", image_url: { url: logo_url } });

    const poeRes = await callPoe({
      model: "Nano-Banana",
      messages: [{ role: "user", content }],
    });
    if (!poeRes.ok) {
      return new Response(JSON.stringify({ error: "Poe falhou", details: poeRes.error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imageUrl = extractImageUrl(poeRes.text ?? "");
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "URL de imagem não retornada pela IA", raw: poeRes.text?.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ error: "Falha ao baixar imagem gerada", status: imgResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    const ts = Date.now();
    const path = `events-ai/${event_id}/${language}-${ts}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("wa-media")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Upload falhou", details: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = supabase.storage.from("wa-media").getPublicUrl(path);

    const coverCol = `cover_image_${language}`;
    const promptCol = `ai_image_prompt_${language}`;
    const updates: Record<string, string> = {
      [coverCol]: pub.publicUrl,
      [promptCol]: fullPrompt,
    };
    // Mantém cover_image_url legado em sincronia com a versão PT (fallback do site).
    if (language === "pt") {
      (updates as any).cover_image_url = pub.publicUrl;
    }
    const { error: updErr } = await supabase
      .from("smartops_events")
      .update(updates)
      .eq("id", event_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: "Falha ao salvar capa", details: updErr.message, url: pub.publicUrl }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      language,
      url: pub.publicUrl,
      path,
      prompt_used: fullPrompt,
      model: "Nano-Banana (Poe)",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[event-generate-image] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
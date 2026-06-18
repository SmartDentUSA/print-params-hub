import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { callPoe } from "../_shared/providers/poe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  product_name: z.string().trim().max(200).optional().default(""),
  platform: z.string().trim().max(40).optional().default("instagram"),
  aspect: z.enum(["square", "vertical", "horizontal"]).optional().default("square"),
  preset_id: z.string().trim().max(60).optional(),
  width: z.number().int().min(256).max(4096).optional(),
  height: z.number().int().min(256).max(4096).optional(),
});

function extractImageUrl(text: string): string | null {
  if (!text) return null;
  const md = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (md) return md[1];
  const bare = text.match(/(https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|webp)(?:\?[^\s)"']*)?)/i);
  if (bare) return bare[1];
  const any = text.match(/(https?:\/\/[^\s)"']+)/);
  return any ? any[1] : null;
}

function aspectHint(a: string, w?: number, h?: number, presetId?: string): string {
  const dims = w && h ? `${w}x${h}px` : "";
  if (presetId === "reddit") return `Formato quadrado 1:1 (${dims || "1080x1080px"}) — Reddit.`;
  if (presetId === "linkedin_carousel") return `Formato vertical 4:5 (${dims || "1080x1350px"}) — Página de carrossel LinkedIn (PDF).`;
  if (presetId === "ig_fb_feed") return `Formato vertical 4:5 (${dims || "1080x1350px"}) — Instagram/Facebook Feed & Stories.`;
  if (presetId === "hero_kb") return `Formato horizontal 16:9 (${dims || "1200x675px"}) — Capa hero Base de Conhecimento.`;
  if (a === "vertical") return `Formato vertical 4:5 (${dims || "1080x1350px"}).`;
  if (a === "horizontal") return `Formato horizontal 16:9 (${dims || "1920x1080px"}).`;
  return `Formato quadrado 1:1 (${dims || "1080x1080px"}).`;
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
    const { prompt, product_name, platform, aspect, preset_id, width, height } = parsed.data;

    const fullPrompt = [
      `Crie uma imagem premium para post de ${platform} da marca Smart Dent (fluxo digital odontológico, impressão 3D).`,
      aspectHint(aspect, width, height, preset_id),
      product_name ? `Produto em destaque: ${product_name}.` : "",
      "Estética: editorial premium, tecnológica, alto contraste, espaço respirado, sem texto literal (a menos que explicitado).",
      "Brief do usuário:",
      prompt,
    ].filter(Boolean).join("\n");

    const poeRes = await callPoe({
      model: "Nano-Banana",
      messages: [{ role: "user", content: fullPrompt }],
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
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `social-ai-generated/${ts}-${rand}.${ext}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: upErr } = await supabase.storage
      .from("wa-media")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Upload falhou", details: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = supabase.storage.from("wa-media").getPublicUrl(path);

    return new Response(JSON.stringify({
      ok: true,
      url: pub.publicUrl,
      path,
      type: "image" as const,
      model: "Nano-Banana (Poe)",
      prompt_used: fullPrompt,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[social-generate-image] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
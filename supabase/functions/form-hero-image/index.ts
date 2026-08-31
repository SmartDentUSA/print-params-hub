// form-hero-image — gera banners "hero" para landing pages de formulários usando
// as fotos reais do produto (catálogo) + logo Smart Dent como referência visual.
// Modelo: Lovable AI Gateway (google/gemini-3-pro-image) com image input.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

const BodySchema = z.object({
  form_id: z.string().uuid().optional(),
  headline: z.string().trim().min(3).max(200),
  subheadline: z.string().trim().max(200).optional().default(""),
  badge_text: z.string().trim().max(80).optional().default(""),
  cta_text: z.string().trim().max(60).optional().default(""),
  product_name: z.string().trim().max(200).optional().default(""),
  bullets: z.array(z.string().trim().min(1).max(80)).max(6).optional().default([]),
  reference_images: z.array(z.string().url()).max(6).optional().default([]),
  include_logo: z.boolean().optional().default(true),
  aspect: z.enum(["horizontal", "square", "vertical"]).optional().default("horizontal"),
  style_notes: z.string().trim().max(600).optional().default(""),
  apply_to_form: z.boolean().optional().default(false),
});

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length) return null;
    const type = r.headers.get("content-type") || "image/png";
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function aspectHint(a: string): string {
  if (a === "square") return "Formato quadrado 1:1 (1080x1080px).";
  if (a === "vertical") return "Formato vertical 4:5 (1080x1350px).";
  return "Formato horizontal 16:10 (1600x1000px), estilo banner hero de landing page.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b = parsed.data;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const refUrls = [...b.reference_images];
    if (b.include_logo) refUrls.unshift(SMARTDENT_LOGO_URL);

    const inlined: string[] = [];
    for (const u of refUrls.slice(0, 7)) {
      const d = await toDataUrl(u);
      if (d) inlined.push(d);
    }

    const bulletLines = b.bullets.length
      ? b.bullets.map((t, i) => `  ${i + 1}. "${t}"`).join("\n")
      : "  (sem bullets)";

    const prompt = [
      "Crie um banner HERO publicitário premium para landing page da Smart Dent (odontologia digital, impressão 3D chairside).",
      aspectHint(b.aspect),
      "",
      "REFERÊNCIAS ANEXADAS: use as fotografias reais dos produtos exatamente como estão (mesma forma, cor e proporção — não redesenhe nem invente equipamentos) e reproduza o logotipo Smart Dent fielmente no canto superior esquerdo.",
      "",
      "LAYOUT (obrigatório):",
      "- Fundo claro em degradê suave (branco → cinza-azulado muito claro) com formas geométricas circulares sutis.",
      "- Coluna esquerda: logo Smart Dent no topo; abaixo um badge arredondado com contorno laranja; abaixo o headline em tipografia sans-serif pesada azul-marinho, com a última linha em laranja (#E8821A).",
      "- Linha divisória fina e, sob ela, uma fileira horizontal de ícones de contorno finos (line icons) — um por benefício — com o texto curto do benefício abaixo de cada ícone.",
      "- Botão CTA laranja arredondado com ícone de WhatsApp e o texto do CTA em caixa alta; ao lado, um texto de apoio curto em duas linhas.",
      "- Coluna direita: composição dos produtos das fotos anexadas em cena de estúdio, sombra suave no chão, sem fundo poluído.",
      "",
      `HEADLINE: "${b.headline}"`,
      b.subheadline ? `APOIO: "${b.subheadline}"` : "",
      b.badge_text ? `BADGE: "${b.badge_text}"` : "",
      b.cta_text ? `CTA: "${b.cta_text}"` : "",
      b.product_name ? `PRODUTO: ${b.product_name}` : "",
      "BULLETS DE VANTAGENS (renderize exatamente estes textos, sem erros de ortografia):",
      bulletLines,
      "",
      "Estética: editorial corporativo premium, alto contraste, muito espaço em branco, sem pessoas, sem preços, sem marcas d'água, sem texto inventado além do especificado.",
      b.style_notes,
    ].filter(Boolean).join("\n");

    const content: any[] = [{ type: "text", text: prompt }];
    for (const d of inlined) content.push({ type: "image_url", image_url: { url: d } });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      console.error("[form-hero-image] gateway erro", resp.status, raw.slice(0, 500));
      return new Response(JSON.stringify({ error: "Geração falhou", status: resp.status, details: raw.slice(0, 500) }), {
        status: resp.status === 402 || resp.status === 429 ? resp.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let json: any; try { json = JSON.parse(raw); } catch { json = null; }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      return new Response(JSON.stringify({ error: "Modelo não retornou imagem", raw: raw.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const path = `form-hero-ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await supabase.storage
      .from("wa-media")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Upload falhou", details: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = supabase.storage.from("wa-media").getPublicUrl(path);
    const url = pub.publicUrl;

    let applied = false;
    if (b.apply_to_form && b.form_id) {
      const { error: updErr } = await supabase
        .from("smartops_forms")
        .update({ hero_image_url: url, hero_image_alt: b.headline.slice(0, 160) })
        .eq("id", b.form_id);
      applied = !updErr;
      if (updErr) console.error("[form-hero-image] update form falhou", updErr.message);
    }

    return new Response(JSON.stringify({ ok: true, url, path, applied, references_used: inlined.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[form-hero-image] erro", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

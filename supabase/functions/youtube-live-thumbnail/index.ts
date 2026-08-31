// youtube-live-thumbnail — gera a capa (thumbnail 1280x720) da live no YouTube
// com gancho de dor/ganho do produto, usando fotos reais do catálogo como referência.
// Texto: google/gemini-3.6-flash · Imagem: google/gemini-3-pro-image (AI Gateway).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { getValidAccessToken } from "../_shared/google-oauth.ts";
import {
  fetchEnrichedProductDossier,
  fetchProductDossier,
  renderDossierForPrompt,
} from "../_shared/product-rag.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  headline: z.string().trim().max(80).optional(),
  highlight: z.string().trim().max(60).optional(),
  badge_text: z.string().trim().max(24).optional(),
  style_notes: z.string().trim().max(600).optional().default(""),
  apply_to_youtube: z.boolean().optional().default(true),
});

function videoIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:v=|youtu\.be\/|live\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length) return null;
    const type = r.headers.get("content-type") || "image/png";
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function loadProductContext(names: string[]) {
  const dossiers: string[] = [];
  const images: string[] = [];
  for (const n of names.slice(0, 3)) {
    try {
      const enriched = await fetchEnrichedProductDossier(admin as any, n);
      const d = enriched?.local ?? (await fetchProductDossier(admin as any, n));
      if (d) dossiers.push(renderDossierForPrompt(d, "PRODUTO"));
    } catch (_) { /* soft-fail */ }
    const { data: row } = await admin
      .from("system_a_catalog")
      .select("image_url, image_urls")
      .eq("active", true)
      .ilike("name", `%${n}%`)
      .limit(1)
      .maybeSingle();
    const list = Array.isArray((row as any)?.image_urls) ? (row as any).image_urls : [];
    for (const u of [...list, (row as any)?.image_url]) {
      if (typeof u === "string" && u.startsWith("http") && images.length < 3) images.push(u);
    }
  }
  return { dossiers, images };
}

async function buildCopy(course: any, dossiers: string[], override: { headline?: string; highlight?: string; badge?: string }) {
  const fallback = {
    headline: override.headline || String(course.title || "AO VIVO").toUpperCase().slice(0, 60),
    highlight: override.highlight || "SEM ADAPTAÇÕES",
    badge: override.badge || "AO VIVO",
  };
  if (override.headline && override.highlight) return fallback;
  if (!LOVABLE_API_KEY) return fallback;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Você cria copy de THUMBNAIL de live no YouTube para a Smart Dent (odontologia digital, impressão 3D). " +
              "O gancho deve atacar a DOR real que o produto resolve e prometer o GANHO, em português do Brasil, tom direto e curioso, sem clickbait falso. " +
              "NUNCA cite preços. Sem emojis. Texto em CAIXA ALTA, curto e legível em miniatura. " +
              'Responda SOMENTE JSON: {"headline": string (até 42 caracteres, 2 a 5 palavras de impacto), "highlight": string (até 24 caracteres, o ganho/promessa), "badge": string (até 12 caracteres, ex: AO VIVO)}',
          },
          {
            role: "user",
            content: JSON.stringify({
              curso: course.title,
              descricao: course.description ?? null,
              produtos: course.related_product_names ?? [],
              dossies: dossiers,
            }),
          },
        ],
      }),
    });
    if (!resp.ok) return fallback;
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "");
    const p = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/, "").trim());
    return {
      headline: override.headline || String(p.headline || fallback.headline).toUpperCase().slice(0, 60),
      highlight: override.highlight || String(p.highlight || fallback.highlight).toUpperCase().slice(0, 40),
      badge: override.badge || String(p.badge || "AO VIVO").toUpperCase().slice(0, 16),
    };
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    const { data: turma } = await admin
      .from("smartops_course_turmas")
      .select("id, label, course_id, live_url")
      .eq("id", b.turma_id)
      .maybeSingle();
    if (!turma) return json({ error: "Sessão não encontrada. Salve o curso antes de gerar a capa." }, 404);

    const { data: course } = await admin
      .from("smartops_courses")
      .select("id, title, description, category, instructor_name, related_product_names")
      .eq("id", (turma as any).course_id)
      .maybeSingle();
    if (!course) return json({ error: "Curso não encontrado" }, 404);

    const produtos: string[] = ((course as any).related_product_names ?? []).filter(Boolean);
    const { dossiers, images } = await loadProductContext(produtos);
    const copy = await buildCopy(course, dossiers, {
      headline: b.headline,
      highlight: b.highlight,
      badge: b.badge_text,
    });

    const inlined: string[] = [];
    for (const u of images) {
      const d = await toDataUrl(u);
      if (d) inlined.push(d);
    }

    const prompt = [
      "Crie uma THUMBNAIL (capa) de transmissão ao vivo do YouTube, formato horizontal 16:9 (1280x720px), estética cinematográfica de alto impacto.",
      "",
      "CENA: fundo de estúdio escuro (quase preto) com luz volumétrica azul fria vindo da direita e um leve halo laranja; profissional da odontologia adulto, barba curta, jaleco/camisa escura, expressão confiante segurando entre os dedos uma coroa dentária impressa em 3D à direita do quadro, olhando para a câmera. Iluminação dramática de recorte, contraste alto, textura de pele realista (fotografia real, não ilustração).",
      images.length
        ? "PRODUTOS: use as fotografias anexadas exatamente como estão (mesma forma, cor e proporção — não redesenhe nem invente equipamentos), posicionadas sobre uma bancada escura no terço inferior central, com reflexo suave."
        : "PRODUTOS: uma impressora 3D odontológica e uma câmara de pós-cura sobre bancada escura no terço inferior central.",
      "",
      "TEXTO (renderize exatamente, sem erros de ortografia, tipografia sans-serif condensada muito pesada, alinhado à esquerda no terço esquerdo):",
      `- Badge pequeno com fundo laranja (#F26722) e texto branco: "${copy.badge}"`,
      `- Headline gigante em branco, quebrado em 2 ou 3 linhas: "${copy.headline}"`,
      `- Linha de destaque em laranja (#F26722), logo abaixo do headline: "${copy.highlight}"`,
      produtos.length ? `- Linha fina em branco, caixa alta, menor: "${produtos[0].toUpperCase().slice(0, 40)}"` : "",
      "",
      "REGRAS: nenhum outro texto além do especificado; sem marca d'água; sem logotipo do YouTube; sem preços; sem números inventados; margem de segurança nas bordas; legível em miniatura pequena.",
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
      console.error("[youtube-live-thumbnail] gateway", resp.status, raw.slice(0, 400));
      return json(
        { error: "Geração da capa falhou", status: resp.status, details: raw.slice(0, 400) },
        resp.status === 402 || resp.status === 429 ? resp.status : 502,
      );
    }
    let payload: any; try { payload = JSON.parse(raw); } catch { payload = null; }
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "Modelo não retornou imagem", raw: raw.slice(0, 300) }, 502);

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const path = `live-thumbs/${b.turma_id}-${Date.now()}.png`;
    const { error: upErr } = await admin.storage
      .from("wa-media")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return json({ error: "Upload falhou", details: upErr.message }, 500);
    const { data: pub } = admin.storage.from("wa-media").getPublicUrl(path);
    const url = pub.publicUrl;

    await admin
      .from("smartops_course_turmas")
      .update({ live_thumbnail_url: url })
      .eq("id", b.turma_id);

    // Aplica a capa no vídeo do YouTube (thumbnails.set)
    let appliedToYoutube = false;
    let youtubeError: string | null = null;
    const videoId = videoIdFromUrl((turma as any).live_url);
    if (b.apply_to_youtube && videoId) {
      try {
        const token = await getValidAccessToken();
        const up = await fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
          { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" }, body: bytes },
        );
        const upTxt = await up.text();
        if (!up.ok) throw new Error(`thumbnails.set → ${up.status} ${upTxt.slice(0, 300)}`);
        appliedToYoutube = true;
      } catch (e) {
        youtubeError = (e as Error).message;
        console.error("[youtube-live-thumbnail] thumbnails.set", youtubeError);
      }
    }

    return json({
      ok: true,
      url,
      path,
      copy,
      references_used: inlined.length,
      video_id: videoId,
      applied_to_youtube: appliedToYoutube,
      youtube_error: youtubeError,
      needs_google_auth: !!youtubeError && /invalid_grant|insufficient|401|403|OAuth|expirado/i.test(youtubeError),
    });
  } catch (e) {
    const msg = (e as Error).message ?? "internal_error";
    console.error("[youtube-live-thumbnail]", msg);
    return json({ error: msg }, 500);
  }
});

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
import { renderLiveDossierForPrompt } from "../_shared/system-a-live.ts";
import { renderStrategyForPrompt } from "../_shared/smartdent-strategy.ts";
import { renderHooksForPrompt } from "../_shared/smartdent-hooks.ts";


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

/**
 * Imagens reais dos produtos SELECIONADOS no editor de curso
 * ("Produtos do portfólio relacionados"). Regra: UMA imagem por produto,
 * para que todos os produtos escolhidos apareçam na capa — antes o loop
 * consumia as 3 vagas com image_url + og_image_url do primeiro produto.
 * Prioridade por produto:
 * 1) system_a_catalog.image_url / og_image_url
 * 2) resins.image_background_removed_url / image_urls / image_url
 * 3) hero_image_url do formulário vinculado ao produto (product_catalog_id)
 */
const MAX_PRODUCT_IMAGES = 6;
const MAX_PRODUCT_DOSSIERS = 4;

async function loadProductContext(names: string[]) {
  const dossiers: string[] = [];
  const images: string[] = [];
  const sources: string[] = [];
  const missing: string[] = [];

  const selected = names.slice(0, MAX_PRODUCT_IMAGES);

  for (let i = 0; i < selected.length; i++) {
    const n = selected[i];

    if (i < MAX_PRODUCT_DOSSIERS) {
      try {
        const enriched = await fetchEnrichedProductDossier(admin as any, n);
        const d = enriched?.local ?? (await fetchProductDossier(admin as any, n));
        if (d) dossiers.push(renderDossierForPrompt(d, `PRODUTO ${i + 1}: ${n}`));
        const liveText = renderLiveDossierForPrompt(enriched?.live ?? null);
        if (liveText) dossiers.push(liveText);
      } catch (_) { /* soft-fail */ }
    }

    // uma única imagem por produto selecionado
    let picked: { url: string; src: string } | null = null;
    const take = (u: unknown, src: string) => {
      if (picked) return;
      if (typeof u !== "string" || !u.startsWith("http")) return;
      if (images.includes(u)) return;
      picked = { url: u, src };
    };

    // 1) catálogo Sistema A
    const { data: row, error: catErr } = await admin
      .from("system_a_catalog")
      .select("id, name, image_url, og_image_url")
      .eq("active", true)
      .ilike("name", `%${n}%`)
      .limit(1)
      .maybeSingle();
    if (catErr) console.warn("[youtube-live-thumbnail] catalog image lookup", catErr.message);
    take((row as any)?.image_url, `catalog:${(row as any)?.name ?? n}`);
    take((row as any)?.og_image_url, `catalog_og:${(row as any)?.name ?? n}`);

    // 2) resinas (fundo removido tem prioridade visual)
    if (!picked) {
      const { data: resin } = await admin
        .from("resins")
        .select("name, image_background_removed_url, image_urls, image_url")
        .ilike("name", `%${n}%`)
        .limit(1)
        .maybeSingle();
      take((resin as any)?.image_background_removed_url, `resin_nobg:${n}`);
      const list = Array.isArray((resin as any)?.image_urls) ? (resin as any).image_urls : [];
      for (const u of list) take(u, `resin:${n}`);
      take((resin as any)?.image_url, `resin:${n}`);
    }

    // 3) hero da landing page do formulário do produto
    if (!picked) {
      const catalogId = (row as any)?.id ?? null;
      let q = admin
        .from("smartops_forms")
        .select("name, hero_image_url, product_catalog_id")
        .not("hero_image_url", "is", null)
        .limit(3);
      q = catalogId ? q.eq("product_catalog_id", catalogId) : q.ilike("name", `%${n}%`);
      const { data: forms } = await q;
      for (const f of forms ?? []) take((f as any)?.hero_image_url, `form:${(f as any)?.name ?? n}`);
    }

    if (picked) {
      images.push((picked as { url: string; src: string }).url);
      sources.push((picked as { url: string; src: string }).src);
    } else {
      missing.push(n);
    }
  }

  console.log(
    "[youtube-live-thumbnail] produtos selecionados:",
    JSON.stringify({ selected, resolved: sources, missing }),
  );
  return { dossiers, images, sources, missing };
}


/** Logo oficial da Smart Dent (company_info do catálogo Sistema A). */
async function loadBrandLogo(): Promise<string | null> {
  try {
    const { data } = await admin
      .from("system_a_catalog")
      .select("image_url, og_image_url, extra_data")
      .eq("category", "company_info")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const extra = (data as any)?.extra_data ?? {};
    const variants = extra?.media?.logo_variants ?? {};
    const candidates = [
      variants?.png_transparent, variants?.transparent, variants?.primary, variants?.default,
      (data as any)?.image_url, (data as any)?.og_image_url,
    ];
    for (const c of candidates) if (typeof c === "string" && c.startsWith("http")) return c;
  } catch (e) {
    console.warn("[youtube-live-thumbnail] logo lookup", (e as Error).message);
  }
  return null;
}

async function buildCopy(course: any, dossiers: string[], override: { headline?: string; highlight?: string; badge?: string }) {
  const fallback = {
    headline: override.headline || String(course.title || "AO VIVO").toUpperCase().slice(0, 60),
    highlight: override.highlight || "SEM ADAPTAÇÕES",
    badge: override.badge || "AO VIVO",
    scene: "",
  };
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
              "DIREÇÃO OBRIGATÓRIA DA COPY: escreva de forma INDUTIVA E AFIRMATIVA, dirigida a QUEM BUSCA TECNOLOGIA — convide, mostre o caminho e o ganho. " +
              "É PROIBIDO escrever no sentido inverso: sem acusação, sem culpa, sem pergunta de fracasso, sem frases começando por NÃO/PARE/CHEGA/VOCÊ ESTÁ ERRANDO/SEU PROBLEMA, sem tom de derrota. " +
              "Fale a partir do mote comercial da Tecnologia Invisível: a complexidade fica no sistema, o profissional avança — clínica: menos operação, mais odontologia; laboratório: menos variabilidade, mais produção previsível. " +
              "A dor pode ser referenciada apenas como PONTO DE PARTIDA implícito, mas o texto final é sempre o GANHO e o convite (ex.: 'FLUXO DIGITAL QUE FUNCIONA', 'ENTREGA NO MESMO DIA', 'PRODUÇÃO PREVISÍVEL'). " +
              "NUNCA use linguagem de especificação técnica (nivelamento automático, micras, resolução, velocidade, potência): fale de fluxo, previsibilidade, delegação, tempo clínico e entrega. " +
              "Use APENAS os dossiês de produto fornecidos (RAG) e siga as premissas estratégicas abaixo (use os ganchos apenas como referência de TOM, sempre reescritos na direção indutiva). " +
              "NUNCA cite preços. Sem emojis. Texto em CAIXA ALTA, curto e legível em miniatura.\n\n" +
              renderStrategyForPrompt() + "\n\n" + renderHooksForPrompt() + "\n\n" +
              'Responda SOMENTE JSON: {"headline": string (até 42 caracteres, 2 a 5 palavras, afirmação indutiva de ganho para quem busca tecnologia), "highlight": string (até 24 caracteres, o ganho/promessa afirmativa), "badge": string (até 12 caracteres, ex: AO VIVO), "scene": string (até 180 caracteres, em português: o AMBIENTE REAL e a AÇÃO concreta do profissional coerentes com as APLICAÇÕES do produto conforme os dossiês — ex.: consultório com cadeira odontológica ao fundo conferindo uma coroa recém-impressa; laboratório de fluxo digital acompanhando a fresagem. Nunca cite equipamento que não esteja nos dossiês)}',

          },
          {
            role: "user",
            content: JSON.stringify({
              curso: course.title,
              descricao: course.description ?? null,
              categoria: course.category ?? null,
              produtos: course.related_product_names ?? [],
              dossies_rag: dossiers,
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
      scene: String(p.scene || "").slice(0, 220),
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
    const { dossiers, images, sources, missing } = await loadProductContext(produtos);
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
    // Logo oficial anexado por último (referência de marca, obrigatório na capa)
    const logoUrl = await loadBrandLogo();
    const logoData = logoUrl ? await toDataUrl(logoUrl) : null;

    // Alterna gênero do profissional a cada capa gerada (determinístico por turma)
    const genderSeed = String((turma as any).id ?? "") + String((turma as any).updated_at ?? "");
    let seedSum = 0;
    for (const ch of genderSeed) seedSum += ch.charCodeAt(0);
    const isFemale = seedSum % 2 === 0;
    const professional = isFemale
      ? "uma dentista mulher adulta (30-45 anos), cabelo preso, jaleco escuro"
      : "um dentista homem adulto (30-45 anos), jaleco escuro";

    // Linha de produtos sem corte no meio da palavra (cabe em ~70 caracteres)
    let productLine = "";
    for (const p of produtos) {
      const next = productLine ? `${productLine} + ${p.toUpperCase()}` : p.toUpperCase();
      if (next.length > 70) break;
      productLine = next;
    }

    const prompt = [
      "Crie uma THUMBNAIL (capa) de transmissão ao vivo do YouTube, formato horizontal 16:9 (1280x720px), estética cinematográfica de alto impacto.",
      "",
      renderStrategyForPrompt(true),
      "",
      dossiers.length
        ? "CONTEXTO DO PRODUTO (use somente estes dados; não invente equipamentos, peças ou resultados):\n" +
          dossiers.join("\n").slice(0, 2500)
        : "",
      "",
      `ENQUADRAMENTO DO PROFISSIONAL (OBRIGATÓRIO): ${professional}, ocupando NO MÁXIMO 30% da largura da imagem, no terço direito, plano médio (da cintura/peito para cima) — NUNCA um retrato grande em close ocupando a capa. O rosto não deve ser o elemento dominante; o texto e os produtos têm prioridade visual.`,
      copy.scene
        ? `CONTEXTO DA CENA (OBRIGATÓRIO, vindo da RAG do produto — o profissional deve estar claramente NESTE contexto, executando esta ação real, nunca posando de forma genérica): ${copy.scene}`
        : "CONTEXTO DA CENA (OBRIGATÓRIO): ambiente clínico/laboratorial real de fluxo digital odontológico; o profissional executa uma ação concreta coerente com os produtos anexados (conferir uma peça recém-impressa, operar o fluxo), nunca posando de forma genérica.",
      inlined.length
        ? "AMBIENTE: fundo de estúdio escuro (quase preto) com luz volumétrica azul fria vindo da direita e um leve halo laranja. Iluminação dramática de recorte, contraste alto, fotografia real (não ilustração)."
        : "AMBIENTE: fundo de estúdio escuro (quase preto) com luz volumétrica azul fria e halo laranja; o profissional segura uma coroa dentária impressa em 3D entre os dedos. NÃO inclua nenhum equipamento, impressora, scanner ou embalagem na cena.",
      inlined.length
        ? [
            `PRODUTOS — FOTOGRAFIAS OFICIAIS DO CATÁLOGO (RAG). Foram anexadas ${inlined.length} imagem(ns), nesta ordem exata: ${sources
              .slice(0, inlined.length)
              .map((s, i) => `imagem ${i + 1} = ${produtos[i] ?? s}`)
              .join(" · ")}.`,
            "CONTRATO DE FIDELIDADE (INVIOLÁVEL): trate cada imagem anexada como recorte fotográfico imutável. É PROIBIDO redesenhar, estilizar, substituir por outro modelo, trocar cores, alterar painéis, botões, textos, marcas, formato ou proporção de qualquer produto. É PROIBIDO alterar a PROPORÇÃO DE TAMANHO entre eles: preserve a escala relativa real e coerente das fotos (equipamento grande permanece grande, frasco de resina permanece pequeno).",
            "ORDEM (INVIOLÁVEL): disponha os produtos da ESQUERDA para a DIREITA na MESMA ORDEM em que foram anexados, alinhados sobre uma bancada escura no terço inferior central, sem sobrepor o rosto nem o texto. Não reordene, não espelhe, não duplique, não remova nenhum produto.",
            "Ajuste APENAS iluminação, sombra de contato e reflexo sutil para integrar cada recorte à cena.",
          ].join("\n")
        : "PRODUTO: nenhuma foto oficial disponível — é PROIBIDO desenhar ou imaginar qualquer equipamento, impressora, scanner, frasco de resina ou embalagem. Mantenha a cena apenas com o profissional, a coroa impressa e o fundo de estúdio.",
      missing.length
        ? `PRODUTOS SEM FOTO OFICIAL (${missing.join(", ")}): NÃO os represente visualmente — nunca invente a aparência destes itens.`
        : "",

      "",
      "TEXTO (renderize exatamente, sem erros de ortografia, tipografia sans-serif condensada muito pesada, alinhado à esquerda no terço esquerdo):",
      `- Badge pequeno com fundo laranja (#F26722) e texto branco: "${copy.badge}"`,
      `- Headline gigante em branco, quebrado em 2 ou 3 linhas: "${copy.headline}"`,
      `- Linha de destaque em laranja (#F26722), logo abaixo do headline: "${copy.highlight}"`,
      productLine
        ? `- Linha fina em branco, caixa alta, menor, com os produtos da live (renderize esta linha COMPLETA, sem cortar palavras): "${productLine}"`
        : "",


      "",
      logoData
        ? "LOGOTIPO (OBRIGATÓRIO): a ÚLTIMA imagem anexada é o logotipo oficial da Smart Dent. Reproduza-o EXATAMENTE como está (forma, cor, proporção, tipografia) no canto superior esquerdo, tamanho discreto (cerca de 12% da largura), com leve brilho para destacar do fundo escuro. É PROIBIDO redesenhar, reescrever ou inventar o logotipo."
        : "MARCA: escreva apenas o texto \"SMART DENT\" em caixa alta, branco, discreto no canto superior esquerdo. Não invente símbolos nem logotipos.",
      "",
      "REGRAS: nenhum outro texto além do especificado; sem marca d'água; sem logotipo do YouTube; sem preços; sem números inventados; nenhum equipamento além das fotos anexadas; margem de segurança nas bordas; legível em miniatura pequena; PROIBIDO close-up de rosto ocupando mais de 30% da capa e PROIBIDO uma pessoa cobrindo a maior parte da imagem.",
      b.style_notes,
    ].filter(Boolean).join("\n");


    const content: any[] = [{ type: "text", text: prompt }];
    for (const d of inlined) content.push({ type: "image_url", image_url: { url: d } });
    if (logoData) content.push({ type: "image_url", image_url: { url: logoData } });

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
      logo_used: !!logoData,
      reference_sources: sources.slice(0, inlined.length),
      products_selected: produtos,
      products_without_photo: missing,
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

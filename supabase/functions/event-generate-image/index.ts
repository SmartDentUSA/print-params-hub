import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
import { z } from "npm:zod";
import { callPoe } from "../_shared/providers/poe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  event_id: z.string().uuid(),
  language: z.enum(["pt", "en", "es"]),
  prompt: z.string().trim().max(2000).optional(),
  reference_image_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
});

const LANG_LABEL: Record<string, string> = {
  pt: "português brasileiro",
  en: "inglês",
  es: "espanhol",
};

const COUNTRY_FLAGS: Record<string, { flag: string; label: string }> = {
  "brasil": { flag: "🇧🇷", label: "Brasil" },
  "brazil": { flag: "🇧🇷", label: "Brasil" },
  "estados unidos": { flag: "🇺🇸", label: "Estados Unidos" },
  "eua": { flag: "🇺🇸", label: "Estados Unidos" },
  "usa": { flag: "🇺🇸", label: "Estados Unidos" },
  "united states": { flag: "🇺🇸", label: "Estados Unidos" },
  "italia": { flag: "🇮🇹", label: "Itália" },
  "itália": { flag: "🇮🇹", label: "Itália" },
  "italy": { flag: "🇮🇹", label: "Itália" },
  "alemanha": { flag: "🇩🇪", label: "Alemanha" },
  "germany": { flag: "🇩🇪", label: "Alemanha" },
  "franca": { flag: "🇫🇷", label: "França" },
  "frança": { flag: "🇫🇷", label: "França" },
  "france": { flag: "🇫🇷", label: "França" },
  "espanha": { flag: "🇪🇸", label: "Espanha" },
  "spain": { flag: "🇪🇸", label: "Espanha" },
  "reino unido": { flag: "🇬🇧", label: "Reino Unido" },
  "uk": { flag: "🇬🇧", label: "Reino Unido" },
  "united kingdom": { flag: "🇬🇧", label: "Reino Unido" },
  "portugal": { flag: "🇵🇹", label: "Portugal" },
  "mexico": { flag: "🇲🇽", label: "México" },
  "méxico": { flag: "🇲🇽", label: "México" },
  "argentina": { flag: "🇦🇷", label: "Argentina" },
  "china": { flag: "🇨🇳", label: "China" },
  "japao": { flag: "🇯🇵", label: "Japão" },
  "japão": { flag: "🇯🇵", label: "Japão" },
  "japan": { flag: "🇯🇵", label: "Japão" },
  "emirados arabes": { flag: "🇦🇪", label: "Emirados Árabes" },
  "emirados árabes": { flag: "🇦🇪", label: "Emirados Árabes" },
  "uae": { flag: "🇦🇪", label: "Emirados Árabes" },
  "canada": { flag: "🇨🇦", label: "Canadá" },
  "canadá": { flag: "🇨🇦", label: "Canadá" },
  "suica": { flag: "🇨🇭", label: "Suíça" },
  "suíça": { flag: "🇨🇭", label: "Suíça" },
  "switzerland": { flag: "🇨🇭", label: "Suíça" },
  "holanda": { flag: "🇳🇱", label: "Holanda" },
  "netherlands": { flag: "🇳🇱", label: "Holanda" },
};

function resolveFlag(country?: string | null): { flag: string; label: string } {
  if (!country) return { flag: "", label: "" };
  const key = country.trim().toLowerCase();
  return COUNTRY_FLAGS[key] ?? { flag: "", label: country };
}

const MONTHS_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
function fmtDateRange(start?: string | null, end?: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return `${MONTHS_PT[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2,"0")}`;
  };
  const s = start ? fmt(start) : "";
  const e = end ? fmt(end) : "";
  if (s && e) return `${s} - ${e}`;
  return s || e || "";
}

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

    const { flag, label: countryLabel } = resolveFlag(ev.country);
    const dateRange = fmtDateRange(ev.start_date, ev.end_date);
    const cityLine = ev.location || "";
    const stand = ev.company_stand || "";
    const eventName = ev.name || "";

    const layoutBlock = [
      "=== LAYOUT OBRIGATÓRIO (posicionamento dos elementos) ===",
      "Canvas 16:9 (1200x675px), fundo escuro premium conforme camadas cinematográficas.",
      "",
      "CANTO SUPERIOR ESQUERDO:",
      `- Logo Smart Dent (branco, traço fino) + ao lado a bandeira do país do evento (${flag || "[bandeira]"} ${countryLabel}), pequena, com cantos arredondados sutis.`,
      "",
      "CANTO SUPERIOR DIREITO:",
      "- Logo do evento fornecido, grande, em branco, com leve sombra. Se não houver logo, escrever o nome do evento em tipografia display branca, peso bold, alinhado à direita.",
      "",
      "ÁREA CENTRAL ESQUERDA (texto principal):",
      '- Linha 1: "PRESENÇA CONFIRMADA" em caps, peso bold, branco, tracking amplo, fonte pequena.',
      "- Linha 2: bloco de respiro de ~3 linhas reservado para copy posterior — NÃO renderizar texto fictício, lorem ipsum ou placeholder visível; manter a área limpa apenas com o fundo cinematográfico.",
      "",
      "RODAPÉ (faixa inferior, alinhada à esquerda, separadores verticais finos brancos entre blocos):",
      `- Bloco 1: bandeira ${flag || "[bandeira do país]"} grande (cantos arredondados) + ao lado, em duas linhas: "${cityLine.toUpperCase()}" em caps bold branco / "${dateRange}" em caps branco fino.`,
      `- Bloco 2: "STAND:" label fino caps + número do stand "${stand}" em display bold branco.`,
      `- Bloco 3: nome do evento "${eventName.toUpperCase()}" em caps bold branco, alinhado à esquerda.`,
      "",
      "REGRAS:",
      "- Sem textos inventados, sem lorem ipsum, sem datas falsas — usar EXATAMENTE os valores fornecidos acima.",
      "- Tipografia sans-serif geométrica condensada, branca pura sobre o fundo cinematográfico.",
      "- Manter respiro generoso entre blocos; nada deve encostar nas bordas.",
      "- Bandeiras sempre como retângulos com cantos levemente arredondados, nunca como círculos.",
    ].join("\n");

    const cinematicLayers = reference_image_url ? [
      "REGRA PRINCIPAL: a MESMA imagem de referência fornecida (skyline, ponte, venue, arquitetura ou paisagem urbana do evento) deve ser usada simultaneamente como FUNDO TOTAL e como ELEMENTO DE DESTAQUE. Nunca usar fundo independente, sólido preto, genérico ou vazio.",
      "CAMADA 1 — BASE: expandir a imagem de referência para ocupar 100% do canvas 16:9 (1200x675px).",
      "CAMADA 2 — PROFUNDIDADE: aplicar nessa base Gaussian Blur forte, leve ampliação (105–120%), redução de nitidez e contraste para não competir com o conteúdo.",
      "CAMADA 3 — FILTRO CINEMATOGRÁFICO: sobrepor overlay escuro 60–85%, gradiente preto→transparente vindo da esquerda, vinheta suave, textura premium discreta, leve glow branco, reflexo metálico sutil e luz volumétrica.",
      "CAMADA 4 — DESTAQUE: inserir novamente a MESMA imagem original em alta definição ocupando a lateral direita (ou área de destaque), sem desfoque, contraste elevado, recorte elegante, bordas suaves e profundidade.",
      "RESULTADO ESPERADO: unidade visual entre fundo desfocado e destaque nítido — sensação tecnológica, premium, editorial, corporativa, de evento internacional.",
      "PROIBIDO: fundo sólido preto puro, fundo genérico diferente da imagem lateral, colagem evidente, imagens desconectadas, fundo totalmente vazio.",
    ] : [
      "Sem imagem de referência: criar cenário sintético editorial Smart Dent (azul profundo + acentos metálicos), cinematográfico, com profundidade e atmosfera de evento internacional. NUNCA fundo sólido preto puro nem fundo vazio.",
    ];

    const fullPrompt = [
      `Crie uma capa hero horizontal 16:9 (1200x675px) para o evento "${ev.name}" — material da marca Smart Dent (fluxo digital odontológico).`,
      `Idioma da arte: ${LANG_LABEL[language]}. Tipografia limpa, palavras-chave no idioma, área de respiro no canto esquerdo para overlay de título.`,
      ev.location || ev.country ? `Contexto: ${[ev.location, ev.country].filter(Boolean).join(" — ")}.` : "",
      ev.start_date || ev.end_date ? `Datas: ${[ev.start_date, ev.end_date].filter(Boolean).join(" → ")}.` : "",
      "",
      layoutBlock,
      "",
      "=== COMPOSIÇÃO CINEMATOGRÁFICA EM 4 CAMADAS ===",
      ...cinematicLayers,
      "",
      logo_url ? "Posicionar o logo do evento fornecido no canto superior direito, discreto, com leve sombra." : "",
      prompt ? "Brief adicional do usuário:" : "",
      prompt || "",
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
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
import { z } from "npm:zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgCoverBytes(args: { eventName: string; flag: string; cityLine: string; dateRange: string; stand: string; countryLabel: string }): Uint8Array {
  const title = escapeXml((args.eventName || "SMART DENT EVENT").toUpperCase());
  const meta = escapeXml(`${args.flag ? args.flag + " " : ""}${args.cityLine.toUpperCase()}${args.dateRange ? "  ·  " + args.dateRange : ""}${args.stand ? "  ·  STAND " + args.stand : ""}`.trim());
  const country = escapeXml(args.countryLabel || "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07111f"/><stop offset="0.52" stop-color="#12324b"/><stop offset="1" stop-color="#0b1118"/></linearGradient>
    <radialGradient id="glow" cx="72%" cy="38%" r="55%"><stop offset="0" stop-color="#78d8ff" stop-opacity="0.26"/><stop offset="1" stop-color="#78d8ff" stop-opacity="0"/></radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/></filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <path d="M0 520 C220 430 340 610 540 510 C780 390 930 500 1200 390 L1200 675 L0 675 Z" fill="#ffffff" opacity="0.05"/>
  <text x="72" y="70" fill="#f7fbff" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" filter="url(#shadow)">Smart Dent ${country ? "  " + country : ""}</text>
  <text x="72" y="250" fill="#f7fbff" font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-size="30" font-weight="600" letter-spacing="5" filter="url(#shadow)">PRESENÇA CONFIRMADA</text>
  <foreignObject x="70" y="285" width="900" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial Narrow,Arial,Helvetica,sans-serif;font-size:86px;line-height:0.9;font-weight:900;color:#f7fbff;text-transform:uppercase;text-shadow:0 10px 28px rgba(0,0,0,.75);word-break:normal;overflow-wrap:break-word;letter-spacing:0">${title}</div></foreignObject>
  <text x="72" y="616" fill="#edf7ff" opacity="0.92" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500" filter="url(#shadow)">${meta}</text>
</svg>`;
  return new TextEncoder().encode(svg);
}

async function generateImageWithLovable(prompt: string): Promise<{ bytes: Uint8Array; contentType: string } | { error: string; status: number; details?: string }> {
  if (!LOVABLE_API_KEY) return { error: "LOVABLE_API_KEY não configurada", status: 500 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let resp: Response;
  try {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1536x1024",
        quality: "low",
        n: 1,
        stream: false,
      }),
    });
  } catch (e: any) {
    clearTimeout(timeout);
    return { error: "Lovable AI Gateway indisponível", status: 502, details: e?.name === "AbortError" ? "Tempo limite da geração atingido" : e?.message || String(e) };
  }
  clearTimeout(timeout);

  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw text */ }

  if (!resp.ok) {
    return {
      error: "Lovable AI Gateway falhou",
      status: resp.status,
      details: json?.error?.message || json?.message || text.slice(0, 800),
    };
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 === "string" && b64.length > 0) {
    return { bytes: base64ToBytes(b64), contentType: "image/png" };
  }

  const url = json?.data?.[0]?.url;
  if (typeof url === "string" && url.startsWith("http")) {
    const imgResp = await fetch(url);
    if (!imgResp.ok) return { error: "Falha ao baixar imagem gerada", status: imgResp.status, details: await imgResp.text().catch(() => "") };
    return {
      bytes: new Uint8Array(await imgResp.arrayBuffer()),
      contentType: imgResp.headers.get("content-type") || "image/png",
    };
  }

  return { error: "Imagem não retornada pela IA", status: 502, details: text.slice(0, 800) };
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
      "=== POSICIONAMENTO TIPOGRÁFICO (peça editorial cinematográfica, NÃO mockup de UI) ===",
      "Canvas 16:9 (1200x675px). Tudo flutua integrado à atmosfera cinematográfica — NUNCA caixas, NUNCA blocos sólidos, NUNCA fundos cinza atrás de texto, NUNCA placeholders visíveis.",
      "",
      "TOPO ESQUERDO (discreto, pequeno, margem generosa):",
      `- Wordmark "Smart Dent" em branco fino, e ao lado a bandeira ${flag || ""} ${countryLabel} renderizada como pequeno retângulo com cantos levemente arredondados (largura ~28px). Ambos pequenos, elegantes, integrados — não dominantes.`,
      "",
      "TOPO DIREITO:",
      "- Logo do evento fornecido, tamanho médio, integrado com leve glow branco e sombra suave. Sem moldura, sem fundo branco atrás. Se não houver logo, omitir esta área.",
      "",
      "EIXO CENTRAL ESQUERDO (hierarquia editorial vertical, alinhada à esquerda com respiro generoso):",
      '- Eyebrow pequeno em caps, tracking amplo, branco fino: "PRESENÇA CONFIRMADA".',
      `- Título display abaixo, MUITO grande, peso black, branco puro, leading apertado, em caps: "${eventName.toUpperCase()}". Pode ocupar 2 linhas se necessário. Esta é a âncora visual da peça.`,
      "- NÃO inserir nenhum bloco cinza, retângulo placeholder, texto fake, lorem ipsum ou área reservada visível. Apenas o eyebrow + título sobre o fundo cinematográfico.",
      "",
      "RODAPÉ (linha única horizontal na base, alinhada à esquerda, tipografia fina caps branca, separadores verticais finos translúcidos entre blocos — sem barra preta atrás):",
      `- ${flag || ""} ${cityLine.toUpperCase()}${dateRange ? "  ·  " + dateRange : ""}${stand ? "  ·  STAND " + stand : ""}`,
      "- Tudo em uma única linha discreta, peso regular, tamanho pequeno, branco 90% opacidade. Sem caixas, sem fundos, sem ícones extras.",
      "",
      "REGRAS DE OURO:",
      "- ZERO mockup de UI, ZERO retângulos cinza, ZERO caixas com fundo sólido, ZERO placeholder visível.",
      "- ZERO inserção de fotos recortadas em moldura dentro do canvas (sem 'cartão' com foto do evento à direita).",
      "- Tipografia sans-serif geométrica condensada (estilo Druk, Founders Grotesk Condensed, Neue Haas Unica).",
      "- Texto sempre branco puro sobre a atmosfera cinematográfica, integrado com leve glow para legibilidade.",
      "- Usar EXATAMENTE os valores fornecidos acima. Nunca inventar datas, cidades, nomes ou números de stand.",
      `- Se "STAND ${stand}" estiver vazio, OMITIR completamente o bloco de stand (não escrever "STAND:" sozinho).`,
    ].join("\n");

    const cinematicLayers = reference_image_url ? [
      "FUNDO CINEMATOGRÁFICO ÚNICO: a imagem de referência fornecida (skyline, ponte, venue, arquitetura, paisagem urbana do evento) ocupa 100% do canvas como FUNDO INTEGRAL — sem moldura, sem recorte, sem inserção duplicada como 'cartão lateral'.",
      "CAMADA 1 — BASE: expandir a imagem em fullbleed cobrindo todo o canvas 16:9.",
      "CAMADA 2 — PROFUNDIDADE: blur gaussiano médio (apenas o suficiente para o texto respirar — ainda dá pra reconhecer o local), leve ampliação 110%, dessaturação parcial, contraste cinematográfico.",
      "CAMADA 3 — TRATAMENTO: gradiente escuro vindo da esquerda (preto 75% → transparente no centro-direito) para abrigar a tipografia; vinheta suave; leve grain de filme; glow branco difuso atrás do título; tom geral azul-noite editorial.",
      "RESULTADO: uma única imagem cinematográfica integrada — sensação de pôster editorial premium de evento internacional. Sem colagem, sem cartões, sem molduras, sem inserts.",
      "PROIBIDO: fundo preto sólido puro, fundo genérico, colagem evidente, foto recortada em retângulo dentro do canvas, segundo plano de imagem 'destaque' à direita.",
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
      logo_url ? "Reservar o canto superior direito para o logo do evento, discreto, com leve sombra. Se o logo não estiver disponível como referência visual nesta chamada, não inventar detalhes ilegíveis — usar uma marca tipográfica limpa do nome do evento." : "",
      prompt ? "Brief adicional do usuário:" : "",
      prompt || "",
    ].filter(Boolean).join("\n");

    const generation = await generateImageWithLovable(fullPrompt);
    if ("error" in generation) {
      console.error("[event-generate-image] geração falhou:", generation.status, generation.details || generation.error);
      generation = {
        bytes: svgCoverBytes({ eventName, flag, cityLine, dateRange, stand, countryLabel }),
        contentType: "image/svg+xml",
      };
    }

    const bytes = generation.bytes;
    const contentType = generation.contentType;
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
      model: "openai/gpt-image-2 (Lovable AI Gateway)",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[event-generate-image] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
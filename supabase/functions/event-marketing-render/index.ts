// event-marketing-render
// Gera as artes de divulgação do evento a partir da ARTE PADRÃO enviada no
// cadastro (`smartops_events.marketing_art_url`):
//   - carrossel 4:5: capa + 1 card por palestrante + card final "COMENTE <PALAVRA>"
//   - stories 9:16: 1 por palestrante, com foto, dia, hora e tema
// Mesmo pipeline dos thumbs das lives do YouTube: google/gemini-3-pro-image via
// AI Gateway, com a arte do evento, o logo e a foto do palestrante anexados como
// referência imutável. Uma arte por chamada (cursor).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { CAROUSEL, STORY, type CarouselSlide, type SpeakerSession } from "./layouts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "wa-media";

const BodySchema = z.object({
  event_id: z.string().uuid(),
  comment_keyword: z.string().min(2).max(24).optional(),
  kinds: z.array(z.enum(["carousel", "stories"])).min(1).optional(),
  /** Mantido por compatibilidade: a geração é sempre por IA. */
  ai_background: z.boolean().optional(),
  cursor: z.number().int().min(0).optional(),
});

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "google/gemini-3-pro-image";

/** Grade fixa do card — igual em TODAS as artes, para não variar o layout. */
function layoutSpec(aspect: "4:5" | "9:16"): string[] {
  const common = [
    "GRADE FIXA E OBRIGATÓRIA (use exatamente esta estrutura em todos os cards, mudando apenas foto e texto):",
    "1) FAIXA SUPERIOR escura de altura fixa: logotipo do evento alinhado à ESQUERDA e logotipo Smart Dent branco alinhado à DIREITA, ambos no mesmo eixo vertical.",
    "2) ETIQUETA em pílula laranja #F26722, canto superior esquerdo do corpo, texto branco em caixa alta pequeno.",
  ];
  if (aspect === "4:5") {
    return [
      ...common,
      "3) BLOCO DO PALESTRANTE: foto circular à ESQUERDA (diâmetro ~1/4 da largura), nome em caixa alta à DIREITA da foto, em duas linhas no máximo; especialidade em letra menor logo abaixo do nome.",
      "4) CORPO: cartão claro de cantos arredondados ocupando a metade inferior, com uma LINHA POR DEMONSTRAÇÃO, sempre na ordem data · horário · tema, separadas por finas linhas horizontais.",
      "5) RODAPÉ escuro de altura fixa: nome do evento à esquerda, local e estande à direita.",
      "Alinhamento à esquerda em todo o card, margens iguais nas quatro bordas, mesma escala tipográfica em todos os cards.",
    ];
  }
  return [
    ...common,
    "3) METADE SUPERIOR: foto do palestrante grande e centralizada em recorte circular, nome em caixa alta centralizado abaixo dela e especialidade em letra menor.",
    "4) METADE INFERIOR: cartão claro de cantos arredondados com uma LINHA POR DEMONSTRAÇÃO na ordem data · horário · tema, separadas por finas linhas horizontais.",
    "5) RODAPÉ escuro de altura fixa: nome do evento, local e estande.",
    "Composição centralizada, margens iguais, mesma escala tipográfica em todos os stories.",
  ];
}

/** Prompt de arte: a IA compõe o card inteiro, com os textos EXATOS informados. */
function artPrompt(
  textLines: string[],
  aspect: "4:5" | "9:16",
  refCount: number,
  hasEventLogo: boolean,
  hasTemplate: boolean,
): string {
  return [
    `Crie uma ARTE FINAL de divulgação em proporção ${aspect} (${aspect === "4:5" ? "1080x1350, card de carrossel do Instagram" : "1080x1920, story do Instagram"}) para um evento de odontologia digital da Smart Dent.`,
    "REFERÊNCIA DE ESTILO (INVIOLÁVEL): a PRIMEIRA imagem anexada é a arte oficial do evento. Reproduza a mesma identidade visual — paleta azul-marinho profundo, azul-claro e laranja (#F26722), mesmos elementos gráficos, mesma atmosfera e mesma tipografia sans-serif pesada.",
    hasEventLogo
      ? "LOGO DO EVENTO: a SEGUNDA imagem anexada é o logotipo do evento. Reproduza-o exatamente como está, no topo, sem redesenhar nem reescrever."
      : "",
    hasTemplate
      ? "GABARITO DE LAYOUT (OBRIGATÓRIO): a ÚLTIMA imagem anexada é um card já aprovado desta mesma sequência. Copie o layout dela pixel a pixel — mesmas posições, mesmos tamanhos de fonte, mesmas cores, mesmos blocos e mesmas margens. MUDE APENAS a fotografia e os textos indicados. É PROIBIDO criar uma composição diferente."
      : "",
    ...layoutSpec(aspect),
    refCount > (hasEventLogo ? 2 : 1)
      ? "FOTOS ANEXADAS: trate cada fotografia anexada como recorte imutável. É PROIBIDO redesenhar, estilizar, trocar ou inventar pessoas."
      : "",
    "TEXTO (renderize EXATAMENTE como escrito, sem erros de ortografia, sem inventar nada, sem traduzir, hierarquia clara e muito legível no celular):",
    ...textLines.map((l) => `- ${l}`),
    "TIPOGRAFIA: sans-serif condensada pesada, textos brancos sobre fundo escuro e textos azul-marinho sobre o cartão claro, destaques em laranja #F26722, margens de segurança generosas nas bordas.",
    "PROIBIDO: qualquer texto além do especificado, preços, números inventados, marca d'água, logotipo de rede social, moldura de interface, texto cortado ou sobreposto de forma ilegível.",
  ].filter(Boolean).join("\n");
}


/** Gera a arte pelo AI Gateway (mesma chamada usada nos thumbs das lives). */
async function aiArt(prompt: string, refDataUris: string[]): Promise<Uint8Array> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY não configurada para gerar as artes.");
  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of refDataUris) content.push({ type: "image_url", image_url: { url } });
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  const raw = await r.text();
  if (!r.ok) {
    console.error("[event-marketing-render] gateway", r.status, raw.slice(0, 400));
    throw new Error(`Geração da arte falhou (${r.status}): ${raw.slice(0, 200)}`);
  }
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const img = payload?.data?.[0]?.b64_json;
  if (!img) throw new Error("O modelo não retornou imagem.");
  const bin = atob(img);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}



function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}


async function fetchDataUri(url?: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\//.test(mime) || /svg/.test(mime)) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;
    return `data:${mime};base64,${b64(bytes)}`;
  } catch {
    return null;
  }
}

const WEEK_FULL = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parts(iso: string): { d: number; m: number; y: number } | null {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { d, m, y };
}

/** "18 de setembro de 2026" */
function dateLong(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.d} de ${MONTHS[p.m - 1]} de ${p.y}`;
}

/** "sexta-feira" */
function weekdayLabel(iso: string): string {
  const p = parts(iso);
  if (!p) return "";
  return WEEK_FULL[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
}

function fmtRange(a?: string | null, b?: string | null): string {
  const f = (v?: string | null) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "");
  if (!a) return "";
  if (!b || a === b) return f(a);
  return `${f(a)} a ${f(b)}`;
}

function timeLabel(s?: string | null, e?: string | null): string {
  const t = (v?: string | null) => (v ? v.slice(0, 5).replace(":", "h") : "");
  return e ? `${t(s)} às ${t(e)}` : t(s);
}

function keywordFrom(event: any, override?: string): string {
  const base = override || event.slug || event.name || "EVENTO";
  return String(base)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .slice(0, 16) || "EVENTO";
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided === ANON_KEY) {
    console.warn("[event-marketing-render] autenticação ausente ou chave pública recebida");
    return json({ error: "UNAUTHORIZED", message: "Entre novamente no Sistema B para gerar as artes." }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let allowed = provided === SERVICE_ROLE;
  if (!allowed) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${provided}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      console.warn("[event-marketing-render] sessão inválida:", userError?.message || "usuário ausente");
      return json({ error: "UNAUTHORIZED", message: "Sua sessão expirou. Entre novamente no Sistema B." }, 401);
    }

    // Mesma autorização já usada no upload e na criação das pastas dos eventos.
    const { data: can, error: permissionError } = await db.rpc("fn_can_manage_event_media", {
      _user_id: user.id,
    });
    if (permissionError) {
      console.error("[event-marketing-render] falha na permissão:", permissionError.message);
      return json({ error: "PERMISSION_CHECK_FAILED", message: permissionError.message }, 500);
    }
    allowed = can === true;
    console.log("[event-marketing-render] autorização", { user_id: user.id, allowed });
  }
  if (!allowed) return json({ error: "FORBIDDEN", message: "Seu usuário não tem permissão para gerar artes do evento." }, 403);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors }, 400);
    const { event_id } = parsed.data;
    const kinds = parsed.data.kinds || ["carousel", "stories"];

    const { data: event, error } = await db
      .from("smartops_events")
      .select(
        "id, name, slug, location, country, company_stand, start_date, end_date, event_logo_url, marketing_art_url, marketing_assets, speakers",
      )
      .eq("id", event_id)
      .maybeSingle();
    if (error) return json({ error: "DB_ERROR", message: error.message }, 500);
    if (!event) return json({ error: "EVENT_NOT_FOUND" }, 404);
    if (!event.marketing_art_url) {
      return json({ error: "ART_MISSING", message: "Envie a arte padrão de divulgação do evento primeiro." }, 409);
    }

    const artDataUri = await fetchDataUri(event.marketing_art_url);
    if (!artDataUri) return json({ error: "ART_UNREADABLE", message: "Não foi possível ler a arte enviada." }, 422);
    const eventLogoDataUri = await fetchDataUri(event.event_logo_url);


    const speakers = Array.isArray(event.speakers) ? (event.speakers as any[]) : [];

    // Um card por palestrante, com as demonstrações em ordem de data/hora
    const speakerCards = speakers
      .map((s) => {
        const name = String(s?.name || "").trim();
        const raw = (Array.isArray(s?.sessions) ? s.sessions : []).filter((x: any) => x?.date);
        const sessions: SpeakerSession[] = raw
          .slice()
          .sort((a: any, b: any) =>
            `${String(a.date)}${a.start_time || ""}`.localeCompare(`${String(b.date)}${b.start_time || ""}`),
          )
          .map((ses: any) => {
            const iso = String(ses.date).slice(0, 10);
            return {
              dateLong: dateLong(iso),
              weekday: weekdayLabel(iso),
              theme: String(ses?.theme || s?.theme || "").trim(),
              timeLabel: timeLabel(ses?.start_time, ses?.end_time),
            };
          });
        return {
          name,
          specialty: String(s?.specialty || s?.theme || "").trim(),
          photoUrl: String(s?.photo_url || ""),
          sessions,
        };
      })
      .filter((s) => s.name && s.sessions.length);

    const locationLabel = [event.location, event.country].filter(Boolean).join(" · ");
    const keyword = keywordFrom(event, parsed.data.comment_keyword);




    const cursor = parsed.data.cursor || 0;
    const stamp = Date.now();
    const outputs: Array<{ kind: string; label: string; url: string; width: number; height: number }> = [];

    async function save(png: Uint8Array, name: string, kind: string, label: string, w: number, h: number) {
      const path = `events-marketing/${event.id}/${stamp}-${name}.png`;
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, png, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);
      const { data } = db.storage.from(BUCKET).getPublicUrl(path);
      outputs.push({ kind, label, url: data.publicUrl, width: w, height: h });
    }

    const dateRange = fmtRange(event.start_date, event.end_date);

    const slides: CarouselSlide[] = kinds.includes("carousel")
      ? [
        {
          kind: "cover",
          headline: "Toda a tecnologia ao vivo.",
          subline: "Visite nosso estande e participe das demonstrações.",
          dateLabel: dateRange,
          location: locationLabel,
          stand: event.company_stand || "",
          cta: "Esperamos você!",
        },
        ...speakerCards.map((s) => ({
          kind: "speaker" as const,
          speakerName: s.name,
          photoDataUri: null,
          sessions: s.sessions,
          dateLabel: dateRange,
        })),
        {
          kind: "closing" as const,
          eventName: event.name,
          dateLabel: dateRange,
          location: locationLabel,
          stand: event.company_stand || "",
          tagline: "Tecnologia que transforma sorrisos.",
          keyword,
        },
      ]
      : [];
    const total = slides.length + (kinds.includes("stories") ? speakerCards.length : 0);
    if (!total) {
      return json({
        error: "NOTHING_TO_RENDER",
        message: "Cadastre palestrantes com dia, horário e tema antes de gerar as artes.",
      }, 409);
    }
    if (cursor >= total) return json({ error: "INVALID_CURSOR", message: "Etapa de geração inválida." }, 400);

    const eventHeader = [
      `Evento: "${event.name}"`,
      dateRange ? `Datas: "${dateRange}"` : "",
      locationLabel ? `Local: "${locationLabel}"` : "",
      event.company_stand ? `Estande: "${event.company_stand}"` : "",
    ].filter(Boolean);

    if (cursor < slides.length) {
      const slide = slides[cursor];
      const refs = [artDataUri];
      if (eventLogoDataUri) refs.push(eventLogoDataUri);
      let textLines: string[];
      let label: string;
      if (slide.kind === "cover") {
        textLines = [
          ...eventHeader,
          'Headline gigante em caixa alta: "TODA A TECNOLOGIA AO VIVO"',
          'Subtítulo: "Visite nosso estande e participe das demonstrações."',
          'Chamada final: "ESPERAMOS VOCÊ!"',
        ];
        label = "Carrossel · Capa";
      } else if (slide.kind === "closing") {
        textLines = [
          ...eventHeader,
          'Headline: "AGENDA DE DEMONSTRAÇÕES AO VIVO"',
          'Frase de marca: "Tecnologia que transforma sorrisos."',
          `Chamada final destacada: "COMENTE ${keyword} E RECEBA A AGENDA COMPLETA"`,
        ];
        label = "Carrossel · Fechamento";
      } else {
        const speaker = speakerCards.find((item) => item.name === slide.speakerName)!;
        const photo = await fetchDataUri(speaker.photoUrl);
        if (photo) refs.push(photo);
        textLines = [
          ...eventHeader,
          'Etiqueta no topo: "DEMONSTRAÇÃO AO VIVO"',
          `Nome do palestrante em destaque: "${speaker.name}"`,
          speaker.specialty ? `Especialidade em letra menor: "${speaker.specialty}"` : "",
          ...speaker.sessions.slice(0, 4).map((ses, i) =>
            `Demonstração ${i + 1} — data: "${ses.dateLong}" · dia da semana: "${ses.weekday}" · horário: "${ses.timeLabel}" · tema: "${ses.theme}"`
          ),
        ].filter(Boolean);
        label = `Carrossel · ${speaker.name}`;
        if (photo) {
          textLines.push(
            "FOTO DO PALESTRANTE: a imagem anexada do rosto é fotografia real e imutável — recorte-a em um círculo à esquerda do nome. É PROIBIDO redesenhar, estilizar, trocar o rosto, alterar pele, cabelo ou roupa.",
          );
        }
      }
      const png = await aiArt(artPrompt(textLines, "4:5", refs.length, Boolean(eventLogoDataUri)), refs);
      await save(png, `carrossel-${String(cursor + 1).padStart(2, "0")}`, "carousel", label, CAROUSEL.width, CAROUSEL.height);
    } else {
      const i = cursor - slides.length;
      const s = speakerCards[i];
      const refs = [artDataUri];
      if (eventLogoDataUri) refs.push(eventLogoDataUri);
      const photo = await fetchDataUri(s.photoUrl);
      if (photo) refs.push(photo);
      const textLines = [
        ...eventHeader,
        'Etiqueta no topo: "DEMONSTRAÇÃO AO VIVO"',
        `Nome do palestrante em destaque: "${s.name}"`,
        s.specialty ? `Especialidade em letra menor: "${s.specialty}"` : "",
        ...s.sessions.slice(0, 3).map((ses, idx) =>
          `Demonstração ${idx + 1} — data: "${ses.dateLong}" · dia da semana: "${ses.weekday}" · horário: "${ses.timeLabel}" · tema: "${ses.theme}"`
        ),
        photo
          ? "FOTO DO PALESTRANTE: a imagem anexada do rosto é fotografia real e imutável — use-a grande na metade superior, sem redesenhar, estilizar ou trocar o rosto."
          : "",
      ].filter(Boolean);
      const png = await aiArt(artPrompt(textLines, "9:16", refs.length, Boolean(eventLogoDataUri)), refs);
      await save(png, `story-${String(i + 1).padStart(2, "0")}`, "story", `Story · ${s.name}`, STORY.width, STORY.height);
    }


    const previousAssets = cursor > 0 && Array.isArray(event.marketing_assets)
      ? event.marketing_assets as Array<{ kind: string; label: string; url: string; width: number; height: number }>
      : [];
    const allOutputs = [...previousAssets, ...outputs];
    await db
      .from("smartops_events")
      .update({ marketing_assets: allOutputs, marketing_assets_generated_at: new Date().toISOString() })
      .eq("id", event.id);

    return json({
      success: true,
      comment_keyword: keyword,
      count: allOutputs.length,
      assets: allOutputs,
      done: cursor + 1 >= total,
      next_cursor: cursor + 1,
      total,
    });
  } catch (e: any) {
    console.error("[event-marketing-render] erro:", e?.message || e);
    return json({ success: false, error: "RENDER_FAILED", message: e?.message || String(e) }, 500);
  }
});

// event-marketing-render
// Gera as artes de divulgação do evento a partir da ARTE PADRÃO enviada no
// cadastro (`smartops_events.marketing_art_url`):
//   - carrossel 1080×1350 (4:5): capa + 1 card por dia com palestrantes/temas
//     + card final "COMENTE <PALAVRA>"
//   - stories 1080×1920 (9:16): 1 por palestrante, com foto, dia, hora e tema
// Nenhuma imagem é gerada por IA: só crop/escala e composição gráfica.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import {
  CAROUSEL,
  STORY,
  buildCarouselSvg,
  buildStorySvg,
  type CarouselSlide,
  type SessionItem,
} from "./layouts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const BUCKET = "wa-media";

const BodySchema = z.object({
  event_id: z.string().uuid(),
  comment_keyword: z.string().min(2).max(24).optional(),
  kinds: z.array(z.enum(["carousel", "stories"])).min(1).optional(),
  /** Gera o FUNDO com IA (mesma tecnologia dos thumbs das lives), usando a arte
   *  enviada como referência de estilo. Os textos continuam 100% exatos. */
  ai_background: z.boolean().optional(),
});

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";

/** Fundo gerado por IA a partir da arte padrão do evento (referência de estilo).
 *  Nunca escreve texto: nomes, temas e horários são compostos depois em SVG. */
async function aiBackground(
  refDataUri: string,
  aspect: "4:5" | "9:16",
  eventName: string,
): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const prompt = [
    `Crie uma IMAGEM DE FUNDO em proporção ${aspect} para divulgação do evento de odontologia digital "${eventName}".`,
    "Use a imagem anexada apenas como REFERÊNCIA de identidade visual: paleta azul-marinho profundo, azul-claro e laranja, atmosfera de congresso/estande, tecnologia odontológica digital.",
    "Composição limpa, iluminação suave, profundidade, gradiente escuro na base e no topo para receber textos brancos por cima.",
    "PROIBIDO: qualquer texto, letra, número, palavra, logotipo, marca-d'água, moldura ou interface. Sem rostos reconhecíveis em close.",
    "Resultado: apenas cenário/fundo gráfico-fotográfico, sem nenhum tipo de escrita.",
  ].join(" ");
  try {
    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: refDataUri } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) {
      console.error("[event-marketing-render] IA fundo falhou:", r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const out = await r.json();
    const img = out?.data?.[0]?.b64_json;
    return img ? `data:image/png;base64,${img}` : null;
  } catch (e) {
    console.error("[event-marketing-render] IA fundo erro:", (e as Error)?.message);
    return null;
  }
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

function asset(name: string): Promise<Uint8Array> {
  return Deno.readFile(new URL(`./assets/${name}`, import.meta.url));
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

const WEEK = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function dayLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} · ${wd}`;
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

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(fetch(WASM_URL));
  return wasmReady;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const provided = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided) return json({ error: "UNAUTHORIZED" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);
  let allowed = provided === SERVICE_ROLE;
  if (!allowed) {
    try {
      const { data: u } = await db.auth.getUser(provided);
      if (u?.user?.id) {
        const { data: can } = await db.rpc("can_manage_training_media", { _user_id: u.user.id });
        allowed = can === true;
      }
    } catch {
      allowed = false;
    }
  }
  if (!allowed) return json({ error: "UNAUTHORIZED", message: "Sem permissão para gerar artes do evento" }, 401);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors }, 400);
    const { event_id } = parsed.data;
    const kinds = parsed.data.kinds || ["carousel", "stories"];

    const { data: event, error } = await db
      .from("smartops_events")
      .select(
        "id, name, slug, location, country, company_stand, start_date, end_date, event_logo_url, marketing_art_url, speakers",
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
    const logoDataUri = `data:image/png;base64,${b64(await asset("smartdent-logo.png"))}`;
    const eventLogoDataUri = await fetchDataUri(event.event_logo_url);
    const common = { artDataUri, logoDataUri, eventLogoDataUri };

    const speakers = Array.isArray(event.speakers) ? (event.speakers as any[]) : [];
    const photos = new Map<string, string | null>();
    for (const s of speakers) {
      if (s?.photo_url && !photos.has(s.photo_url)) photos.set(s.photo_url, await fetchDataUri(s.photo_url));
    }

    // Sessões agrupadas por dia
    const byDay = new Map<string, SessionItem[]>();
    for (const s of speakers) {
      const name = String(s?.name || "").trim();
      const sessions = Array.isArray(s?.sessions) ? s.sessions : [];
      for (const ses of sessions) {
        const date = String(ses?.date || "").slice(0, 10);
        if (!date) continue;
        const list = byDay.get(date) || [];
        list.push({
          timeLabel: timeLabel(ses?.start_time, ses?.end_time),
          theme: String(ses?.theme || s?.theme || "").trim(),
          speakerName: name || "Palestrante",
          photoDataUri: s?.photo_url ? photos.get(s.photo_url) || null : null,
        });
        byDay.set(date, list);
      }
    }
    const days = [...byDay.keys()].sort();
    for (const d of days) {
      byDay.get(d)!.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
    }

    const locationLabel = [event.location, event.country].filter(Boolean).join(" · ");
    const keyword = keywordFrom(event, parsed.data.comment_keyword);

    await ensureWasm();
    const fontBuffers = [await asset("Poppins-Bold.ttf"), await asset("Poppins-Regular.ttf")];
    const render = (svg: string, width: number) =>
      new Resvg(svg, {
        fitTo: { mode: "width", value: width },
        font: { fontBuffers, defaultFontFamily: "Poppins", loadSystemFonts: false },
      })
        .render()
        .asPng();

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

    if (kinds.includes("carousel")) {
      const slides: CarouselSlide[] = [
        {
          kind: "cover",
          eventName: event.name,
          dateLabel: fmtRange(event.start_date, event.end_date),
          location: locationLabel,
          stand: event.company_stand || "",
        },
        ...days.map((d) => ({ kind: "day" as const, dayLabel: dayLabel(d), sessions: byDay.get(d)! })),
        { kind: "cta", keyword, eventName: event.name },
      ];
      for (let i = 0; i < slides.length; i += 1) {
        const { svg } = buildCarouselSvg(slides[i], common);
        const png = render(svg, CAROUSEL.width);
        const label =
          slides[i].kind === "cover"
            ? "Carrossel · Capa"
            : slides[i].kind === "cta"
              ? `Carrossel · Comente ${keyword}`
              : `Carrossel · ${(slides[i] as any).dayLabel}`;
        await save(png, `carrossel-${String(i + 1).padStart(2, "0")}`, "carousel", label, CAROUSEL.width, CAROUSEL.height);
      }
    }

    if (kinds.includes("stories")) {
      for (let i = 0; i < speakers.length; i += 1) {
        const s = speakers[i];
        const name = String(s?.name || "").trim();
        const sessions = (Array.isArray(s?.sessions) ? s.sessions : []).filter((x: any) => x?.date);
        if (!name || !sessions.length) continue;
        const { svg } = buildStorySvg({
          ...common,
          speakerName: name,
          specialty: String(s?.specialty || s?.theme || "").trim(),
          photoDataUri: s?.photo_url ? photos.get(s.photo_url) || null : null,
          sessions: sessions.slice(0, 3).map((ses: any) => ({
            dayLabel: dayLabel(String(ses.date).slice(0, 10)),
            timeLabel: timeLabel(ses?.start_time, ses?.end_time),
            theme: String(ses?.theme || s?.theme || "").trim(),
          })),
          eventName: event.name,
          location: locationLabel,
          stand: event.company_stand || "",
        });
        const png = render(svg, STORY.width);
        await save(png, `story-${String(i + 1).padStart(2, "0")}`, "story", `Story · ${name}`, STORY.width, STORY.height);
      }
    }

    if (!outputs.length) {
      return json({
        error: "NOTHING_TO_RENDER",
        message: "Cadastre palestrantes com dia, horário e tema antes de gerar as artes.",
      }, 409);
    }

    await db
      .from("smartops_events")
      .update({ marketing_assets: outputs, marketing_assets_generated_at: new Date().toISOString() })
      .eq("id", event.id);

    return json({ success: true, comment_keyword: keyword, count: outputs.length, assets: outputs });
  } catch (e: any) {
    console.error("[event-marketing-render] erro:", e?.message || e);
    return json({ success: false, error: "RENDER_FAILED", message: e?.message || String(e) }, 500);
  }
});

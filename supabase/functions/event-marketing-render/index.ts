// event-marketing-render
// Gera as artes de divulgação do evento a partir da ARTE PADRÃO enviada no
// cadastro (`smartops_events.marketing_art_url`):
//   - carrossel 4:5: capa + 1 card por palestrante + card final "COMENTE <PALAVRA>"
//   - stories 9:16: 1 por palestrante, com foto, dia, hora e tema
// A arte do evento é usada como fundo, enquanto fotos e textos são compostos
// em uma grade determinística. Isso garante que todos os cards tenham exatamente
// o mesmo layout e que nomes, datas, horários e temas não sejam alterados por IA.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import {
  buildCarouselSvg,
  buildStorySvg,
  CAROUSEL,
  STORY,
  type CarouselSlide,
  type SpeakerSession,
} from "./layouts.ts";
import { SMARTDENT_LOGO_DATA_URI } from "./logo-data.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "wa-media";
const RENDER_BASE_URL = (Deno.env.get("VERCEL_URL") || "https://print-params-hub.lovable.app").replace(/\/$/, "");

const BodySchema = z.object({
  event_id: z.string().uuid(),
  comment_keyword: z.string().min(2).max(24).optional(),
  kinds: z.array(z.enum(["carousel", "stories"])).min(1).optional(),
  /** Mantido por compatibilidade com o painel; o layout final é sempre fixo. */
  ai_background: z.boolean().optional(),
  cursor: z.number().int().min(0).optional(),
});

async function renderPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#fff}
    svg{display:block;width:${width}px;height:${height}px}
  </style></head><body>${svg}</body></html>`;
  const response = await fetch(`${RENDER_BASE_URL}/api/render-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, width, height }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Falha ao converter a arte (${response.status}): ${detail}`);
  }
  return new Uint8Array(await response.arrayBuffer());
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
        "id, name, slug, location, country, company_stand, start_date, end_date, event_logo_url, marketing_art_url, marketing_hero_url, marketing_assets, speakers",
      )
      .eq("id", event_id)
      .maybeSingle();
    if (error) return json({ error: "DB_ERROR", message: error.message }, 500);
    if (!event) return json({ error: "EVENT_NOT_FOUND" }, 404);
    if (!event.marketing_art_url) {
      return json({ error: "ART_MISSING", message: "Envie a arte padrão de divulgação do evento primeiro." }, 409);
    }

    const artDataUri = String(event.marketing_art_url);
    const eventLogoDataUri = event.event_logo_url ? String(event.event_logo_url) : null;
    const eventHeroUrl = event.marketing_hero_url ? String(event.marketing_hero_url) : "";
    const smartDentLogo = SMARTDENT_LOGO_DATA_URI;


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
          lessonImageUrl: String(s?.lesson_image_url || ""),
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
          heroDataUri: s.lessonImageUrl || eventHeroUrl || null,
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

    if (cursor < slides.length) {
      const slide = slides[cursor];
      let label: string;
      if (slide.kind === "cover") {
        label = "Carrossel · Capa";
      } else if (slide.kind === "closing") {
        label = "Carrossel · Fechamento";
      } else {
        const speaker = speakerCards.find((item) => item.name === slide.speakerName);
        if (!speaker) return json({ error: "SPEAKER_NOT_FOUND", message: "Palestrante não encontrado para esta arte." }, 422);
        slide.photoDataUri = speaker.photoUrl || null;
        slide.heroDataUri = speaker.lessonImageUrl || eventHeroUrl || null;
        label = `Carrossel · ${speaker.name}`;
      }
      const rendered = buildCarouselSvg(slide, {
        artDataUri,
        logoDataUri: smartDentLogo,
        eventLogoDataUri,
      });
      const png = await renderPng(rendered.svg, rendered.width, rendered.height);
      await save(png, `carrossel-${String(cursor + 1).padStart(2, "0")}`, "carousel", label, CAROUSEL.width, CAROUSEL.height);
    } else {
      const i = cursor - slides.length;
      const s = speakerCards[i];
      if (!s) return json({ error: "SPEAKER_NOT_FOUND", message: "Palestrante não encontrado para este story." }, 422);
      const photo = s.photoUrl || null;
      const rendered = buildStorySvg({
        artDataUri,
        logoDataUri: smartDentLogo,
        eventLogoDataUri,
        speakerName: s.name,
        specialty: s.specialty,
        photoDataUri: photo,
        heroDataUri: s.lessonImageUrl || eventHeroUrl || null,
        sessions: s.sessions,
        eventName: event.name,
        location: locationLabel,
        stand: event.company_stand || "",
      });
      const png = await renderPng(rendered.svg, rendered.width, rendered.height);
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

// Roteiros do Social Publisher no Copilot, na ordem das telas:
// • Criar Post: Conteúdo (produto, legenda/IA, hashtags, 1º comentário) → Mídia →
//   Canais (+ título/board/subreddit quando o canal exige) → Agendamento → Salvar.
// • Agendar em massa: Mídias → Canais e formatos → Datas (1ª publicação,
//   frequência, horário) → Marcações → Orientação → legendas por mídia → Agendar.
import type { WizardQuestion, WizardScript, WizardAnswer } from "./copilotWizard.ts";
import { WIZ_CONFIRM, WIZ_CANCEL, WIZ_SKIP } from "./copilotWizard.ts";
import { formatDateBR, matchOption, parseDateBR, type WizardOption } from "./copilotWizardParse.ts";
import { CHANNEL_FORMAT_OPTIONS, type ChannelFormatOption } from "./social/channelFormats.ts";
import {
  BULK_MAX_INTERVAL, BULK_MAX_T, BULK_MIN_T, BULK_TZ, VIDEO_ONLY,
  bulkChannels, bulkPlan, bulkPostType, fmtTime, handles, type BulkMedia, type BulkOptions,
} from "./social/bulkPlan.ts";
import { localInputToIso } from "./social/scheduleTime.ts";
import { SOCIAL_CHANNELS, type SocialPlatform } from "./socialChannels.ts";

export type SocialProduct = { ref: string; name: string; slug: string; category: string };
export type SocialCopy = { caption: string; hashtags: string[]; first_comment: string };
export type BulkCopyResult = { ok: true; copy: SocialCopy } | { ok: false; error: string };
export type SocialPostDeps = {
  searchProducts(q: string): Promise<SocialProduct[]>;
  generateCaption(input: { product_name?: string; product_slug?: string; product_category?: string; instructions?: string }): Promise<SocialCopy>;
  generateBulkCopies(media: BulkMedia[], instructions: string, mentions: string[], platform: string): Promise<BulkCopyResult[]>;
  nowMs?(): number;
};

const TZ = BULK_TZ;
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
export const MAX_BULK_POSTS = 30;
const SKIP: WizardOption = { value: WIZ_SKIP, label: "Pular" };
const REVIEW_OPTS = (what: string): WizardOption[] => [{ value: WIZ_CONFIRM, label: `Confirmar e ${what}` }, { value: WIZ_CANCEL, label: "Cancelar" }];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const now = (d: { nowMs?(): number }) => (d.nowMs ? d.nowMs() : Date.now());

/** "10", "10h", "10:30", "10h30" → minutos do dia. */
export function parseTimeBR(raw: string): number | null {
  const t = norm(raw).replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?:[:h](\d{2}))?(?:h|hs|min)?$/);
  if (!m) return null;
  const h = +m[1], mi = m[2] ? +m[2] : 0;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** "#a, b #c" → ["a","b","c"], sem repetição. */
export function parseHashtags(raw: string): string[] {
  return Array.from(new Set(String(raw || "").split(/[\s,;]+/).map((h) => h.trim().replace(/^#+/, "")).filter(Boolean)));
}

/** Lista JSON de mídias enviadas pelo botão (só https). */
export function parseMediaList(raw: string): BulkMedia[] | null {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const out = arr.filter((m) => m && /^https:\/\//.test(String(m.url)) && (m.type === "image" || m.type === "video"))
      .map((m) => ({ url: String(m.url), type: m.type, path: m.path ? String(m.path) : undefined, width: Number(m.width) || undefined, height: Number(m.height) || undefined } as BulkMedia));
    return out.length === arr.length ? out : null;
  } catch { return null; }
}

const parseIds = (raw: string): string[] | null => {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : null; } catch { return null; }
};
const mediaLabel = (m: BulkMedia[]) => {
  const v = m.filter((x) => x.type === "video").length, i = m.length - v;
  return [i ? `${i} imagem(ns)` : "", v ? `${v} vídeo(s)` : ""].filter(Boolean).join(" e ") || "sem mídia";
};

/* ──────────────────────────── Criar post ──────────────────────────── */

const VIDEO_FORMATS = new Set(["youtube-video", "youtube-shorts", "tiktok-video", "instagram-reels", "facebook-reels", "pinterest-video-pin"]);
const MEDIA_FORMATS = new Set(["instagram-feed", "instagram-stories", "facebook-stories", "pinterest-pin", "pinterest-idea-pin", "gallery-media", "reddit-image", "tiktok-carousel", "instagram-carousel", "facebook-album"]);
const MULTI_FORMATS = new Set(["instagram-carousel", "facebook-album", "tiktok-carousel"]);

/** Formatos que aceitam as mídias escolhidas (mesmas exigências da validação da tela). */
export function compatibleFormats(media: BulkMedia[]): ChannelFormatOption[] {
  const hasVideo = media.some((m) => m.type === "video");
  const hasImage = media.some((m) => m.type === "image");
  return CHANNEL_FORMAT_OPTIONS.filter((o) => {
    if (VIDEO_FORMATS.has(o.key) && !hasVideo) return false;
    if (MEDIA_FORMATS.has(o.key) && !media.length) return false;
    if (MULTI_FORMATS.has(o.key) && media.length < 2) return false;
    if (o.key === "pinterest-pin" && !hasImage) return false;
    return true;
  });
}

type ExtraField = "title" | "pinterest_board" | "subreddit" | "destination_url";
type Extra = { ch: number; field: ExtraField };
export type PostChannel = { platform: SocialPlatform; format: string; title?: string; pinterest_board?: string; subreddit?: string; reddit_kind?: string; destination_url?: string; tiktok_privacy?: string };

export type PostStep =
  | "produto_busca" | "produto" | "legenda_modo" | "ia_orientacao" | "ia_resultado" | "legenda"
  | "hashtags" | "comentario" | "midia" | "canais" | "extra" | "quando" | "data" | "hora" | "review";
export type PostData = {
  product: SocialProduct | null; caption: string; hashtags: string[]; first_comment: string;
  media: BulkMedia[]; channelKeys: string[]; channels: PostChannel[];
  publish_now: boolean; date: string | null; time: number | null; scheduled_at: string | null;
};
export type PostState = {
  step: PostStep; today: string; data: PostData; results: SocialProduct[];
  ai: SocialCopy | null; aiInstructions: string; extras: Extra[]; extraIdx: number;
};

const C = "Conteúdo";
const optLabel = (key: string) => CHANNEL_FORMAT_OPTIONS.find((o) => o.key === key)?.label ?? key;

function channelFromKey(key: string): PostChannel | null {
  const o = CHANNEL_FORMAT_OPTIONS.find((x) => x.key === key);
  if (!o) return null;
  const ch: PostChannel = { platform: o.platform, format: o.format };
  if (o.platform === "reddit") ch.reddit_kind = o.format === "Texto" ? "text" : o.format === "Link" ? "link" : "image";
  if (o.platform === "tiktok") ch.tiktok_privacy = "public";
  return ch;
}

function extrasFor(channels: PostChannel[]): Extra[] {
  const out: Extra[] = [];
  channels.forEach((c, ch) => {
    if (c.platform === "youtube" || c.platform === "pinterest" || c.platform === "reddit") out.push({ ch, field: "title" });
    if (c.platform === "pinterest") out.push({ ch, field: "pinterest_board" });
    if (c.platform === "reddit") out.push({ ch, field: "subreddit" });
    if (c.platform === "reddit" && c.format === "Link") out.push({ ch, field: "destination_url" });
  });
  return out;
}

const firstLine = (s: string, max: number) => (s || "").split("\n")[0].trim().slice(0, max);
const chLabel = (c: PostChannel) => CHANNEL_FORMAT_OPTIONS.find((o) => o.platform === c.platform && o.format === c.format)?.label ?? `${c.platform} ${c.format}`;

function postQuestion(s: PostState): WizardQuestion {
  const d = s.data;
  switch (s.step) {
    case "produto_busca":
      return { where: `${C} › Produto`, input: "text", ask: "Qual **produto** é o assunto do post? Digite parte do nome.", help: "A IA usa o catálogo desse produto para escrever a legenda. Se o post não for sobre um produto, clique em Sem produto.", quick: [{ value: WIZ_SKIP, label: "Sem produto" }], placeholder: "Ex.: Vitality, RayShape, Smart Print" };
    case "produto":
      return { where: `${C} › Produto`, input: "choice", ask: "Qual destes é o produto?", options: [...s.results.map((p) => ({ value: p.ref, label: p.name, hint: p.category })), { value: "__again", label: "Buscar outro nome" }, { value: WIZ_SKIP, label: "Sem produto" }] };
    case "legenda_modo":
      return { where: `${C} › Legenda`, input: "choice", ask: "Como você quer a **legenda**?", options: [{ value: "ia", label: "✨ Escrever com IA" }, { value: "manual", label: "Vou digitar a legenda" }] };
    case "ia_orientacao":
      return { where: `${C} › Gerar com IA › Instruções`, input: "text", ask: "Alguma **orientação** para a IA? (opcional)", help: "Ex.: tom educativo, chamar para o WhatsApp, citar o curso de sábado.", quick: [SKIP] };
    case "ia_resultado":
      return { where: `${C} › Gerar com IA`, input: "choice", ask: "Gostou da legenda gerada?", options: [{ value: "use", label: "Usar esta legenda" }, { value: "again", label: "Gerar outra" }, { value: "manual", label: "Vou digitar" }] };
    case "legenda":
      return { where: `${C} › Legenda`, input: "textarea", ask: "Digite a **legenda** do post.", help: `Até ${MAX_CAPTION} caracteres. Hashtags vêm na próxima pergunta.`, quick: d.caption ? [{ value: "__keep", label: "Manter a legenda atual" }] : [{ value: WIZ_SKIP, label: "Sem legenda" }] };
    case "hashtags":
      return { where: `${C} › Hashtags`, input: "text", ask: "Quais **hashtags**? Separe por espaço.", help: `Até ${MAX_HASHTAGS}. Pode digitar com ou sem #.`, quick: d.hashtags.length ? [{ value: "__keep", label: `Manter as ${d.hashtags.length} hashtags` }, { value: WIZ_SKIP, label: "Sem hashtags" }] : [{ value: WIZ_SKIP, label: "Sem hashtags" }], placeholder: "#odontologia #impressao3d" };
    case "comentario":
      return { where: `${C} › Primeiro comentário`, input: "textarea", ask: "Quer um **primeiro comentário**? (opcional)", help: "É publicado logo depois do post (Instagram/Facebook).", quick: d.first_comment ? [{ value: "__keep", label: "Manter o comentário da IA" }, { value: WIZ_SKIP, label: "Sem comentário" }] : [SKIP] };
    case "midia":
      return { where: "Mídia", input: "upload", accept: "image/*,video/*", multiple: true, ask: "Envie as **imagens ou vídeos** do post.", help: "Mais de uma imagem vira carrossel. Vídeo até 500 MB.", quick: d.caption ? [{ value: WIZ_SKIP, label: "Sem mídia (só texto)" }] : [] };
    case "canais": {
      const opts = compatibleFormats(d.media);
      return { where: "Canais › Selecione canais", input: "multi", ask: "Em quais **canais e formatos** publicar?", help: "Cada formato marcado vira uma publicação. Só aparecem os formatos que aceitam a mídia enviada.", options: opts.map((o) => ({ value: o.key, label: o.label })), selected: d.channelKeys.length ? d.channelKeys : opts.some((o) => o.key === "instagram-feed") ? ["instagram-feed"] : [] };
    }
    case "extra": {
      const e = s.extras[s.extraIdx], c = d.channels[e.ch], name = chLabel(c);
      if (e.field === "title") {
        const max = c.platform === "youtube" ? 100 : 120;
        const fl = firstLine(d.caption, max);
        return { where: `Canais › ${name} › Título`, input: "text", ask: `Qual o **título** no ${name}?`, help: `Obrigatório. Até ${max} caracteres.`, quick: fl ? [{ value: "__first", label: "Usar a 1ª linha da legenda" }] : [] };
      }
      if (e.field === "pinterest_board") return { where: `Canais › ${name} › Pasta`, input: "text", ask: "Em qual **pasta (board)** do Pinterest? (opcional)", help: "Sem pasta, vai para a pasta padrão da conta.", quick: [SKIP] };
      if (e.field === "subreddit") return { where: `Canais › ${name} › Subreddit`, input: "text", ask: "Em qual **subreddit**?", help: "Sem o r/. Ex.: Dentistry", placeholder: "Dentistry" };
      return { where: `Canais › ${name} › Link`, input: "text", ask: "Qual o **link** do post no Reddit?", placeholder: "https://..." };
    }
    case "quando":
      return { where: "Agendamento", input: "choice", ask: "Quando publicar?", options: [{ value: "sched", label: "Agendar data e hora" }, { value: "now", label: "Publicar agora" }] };
    case "data":
      return { where: "Agendamento › Data", input: "date", ask: "Em qual **data**?", quick: [{ value: "hoje", label: "Hoje" }, { value: "amanhã", label: "Amanhã" }] };
    case "hora":
      return { where: "Agendamento › Horário (Brasília)", input: "text", ask: "Em qual **horário**?", help: "Ex.: 10:30 ou 18h.", quick: ["09:00", "12:00", "18:00"].map((v) => ({ value: v, label: v })) };
    case "review":
      return { where: d.publish_now ? "Publicar agora" : "Agendar", input: "choice", ask: "Confira o resumo acima. **Posso salvar o post?**", help: d.publish_now ? "Ao confirmar o post entra na fila e é publicado em instantes." : "Ao confirmar o post fica agendado no Calendário.", options: REVIEW_OPTS(d.publish_now ? "publicar" : "agendar") };
  }
}

async function postAnswer(s: PostState, raw: string, deps: SocialPostDeps): Promise<WizardAnswer<PostState>> {
  const r = String(raw ?? "").trim();
  const d = s.data;
  const go = (step: PostStep, patch: Partial<PostData> = {}, extra: Partial<PostState> = {}, note?: string): WizardAnswer<PostState> =>
    ({ state: { ...s, ...extra, step, data: { ...d, ...patch } }, note });
  const err = (error: string): WizardAnswer<PostState> => ({ error });
  const generate = async (instructions: string) => {
    try {
      const ai = await deps.generateCaption({ product_name: d.product?.name, product_slug: d.product?.slug, product_category: d.product?.category, instructions });
      if (!ai.caption?.trim()) return err("A IA não devolveu legenda. Clique em Gerar outra ou volte e escolha digitar.");
      const tags = ai.hashtags?.length ? `\n\n${ai.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : "";
      const fc = ai.first_comment ? `\n\n_1º comentário:_ ${ai.first_comment}` : "";
      return go("ia_resultado", {}, { ai, aiInstructions: instructions }, `**Legenda gerada:**\n\n${ai.caption}${tags}${fc}`);
    } catch (e) {
      return err(`A IA não respondeu (${e instanceof Error ? e.message : e}). Tente de novo ou volte e escolha digitar.`);
    }
  };

  switch (s.step) {
    case "produto_busca": {
      if (r === WIZ_SKIP) return go("legenda_modo", { product: null });
      if (r.length < 2) return err("Digite pelo menos 2 letras do nome do produto, ou clique em Sem produto.");
      const results = (await deps.searchProducts(r)).slice(0, 12);
      if (!results.length) return err(`Não achei produto com “${r}”. Tente outra parte do nome ou clique em Sem produto.`);
      return go("produto", {}, { results });
    }
    case "produto": {
      if (r === "__again") return go("produto_busca", {}, { results: [] });
      if (r === WIZ_SKIP) return go("legenda_modo", { product: null });
      const opt = matchOption(r, s.results.map((p) => ({ value: p.ref, label: p.name })));
      const p = opt && s.results.find((x) => x.ref === opt.value);
      return p ? go("legenda_modo", { product: p }) : err("Escolha um dos produtos da lista.");
    }
    case "legenda_modo": {
      const opt = matchOption(r, [{ value: "ia", label: "Escrever com IA" }, { value: "manual", label: "Vou digitar a legenda" }]);
      if (!opt) return err("Escolha Escrever com IA ou Vou digitar.");
      return go(opt.value === "ia" ? "ia_orientacao" : "legenda");
    }
    case "ia_orientacao": return generate(r === WIZ_SKIP ? "" : r.slice(0, 600));
    case "ia_resultado": {
      const opt = matchOption(r, [{ value: "use", label: "Usar esta legenda" }, { value: "again", label: "Gerar outra" }, { value: "manual", label: "Vou digitar" }]);
      if (!opt) return err("Escolha Usar, Gerar outra ou Vou digitar.");
      if (opt.value === "again") return generate(s.aiInstructions);
      if (opt.value === "manual") return go("legenda");
      const ai = s.ai!;
      return go("hashtags", { caption: ai.caption.slice(0, MAX_CAPTION), hashtags: parseHashtags((ai.hashtags || []).join(" ")).slice(0, MAX_HASHTAGS), first_comment: ai.first_comment || "" });
    }
    case "legenda": {
      if (r === "__keep") return go("hashtags");
      if (r === WIZ_SKIP) return go("hashtags", { caption: "" });
      if (r.length > MAX_CAPTION) return err(`A legenda tem ${r.length} caracteres; o limite é ${MAX_CAPTION}.`);
      return go("hashtags", { caption: r });
    }
    case "hashtags": {
      if (r === "__keep") return go("comentario");
      if (r === WIZ_SKIP) return go("comentario", { hashtags: [] });
      const tags = parseHashtags(r);
      if (tags.length > MAX_HASHTAGS) return err(`São ${tags.length} hashtags; o limite é ${MAX_HASHTAGS}.`);
      return go("comentario", { hashtags: tags });
    }
    case "comentario": {
      if (r === "__keep") return go("midia");
      if (r === WIZ_SKIP) return go("midia", { first_comment: "" });
      return go("midia", { first_comment: r.slice(0, MAX_CAPTION) });
    }
    case "midia": {
      if (r === WIZ_SKIP) {
        if (!d.caption) return err("Sem legenda o post precisa de pelo menos uma imagem ou vídeo.");
        return go("canais", { media: [], channelKeys: [] });
      }
      const media = parseMediaList(r);
      if (!media || !media.length) return err("Clique em Enviar arquivos e escolha as imagens ou vídeos.");
      return go("canais", { media: media.slice(0, 20), channelKeys: [] });
    }
    case "canais": {
      const keys = parseIds(r);
      const allowed = new Set<string>(compatibleFormats(d.media).map((o) => o.key));
      if (!keys || !keys.length) return err("Marque pelo menos um canal e clique em Concluir.");
      if (keys.some((k) => !allowed.has(k))) return err("Um dos formatos não aceita a mídia enviada. Marque só os da lista.");
      const channels = keys.map(channelFromKey).filter(Boolean) as PostChannel[];
      const extras = extrasFor(channels);
      return go(extras.length ? "extra" : "quando", { channelKeys: keys, channels }, { extras, extraIdx: 0 });
    }
    case "extra": {
      const e = s.extras[s.extraIdx];
      const c = { ...d.channels[e.ch] };
      if (e.field === "title") {
        const max = c.platform === "youtube" ? 100 : 120;
        const v = r === "__first" ? firstLine(d.caption, max) : r;
        if (!v) return err("O título é obrigatório neste canal.");
        if (v.length > max) return err(`Título com ${v.length} caracteres; o limite é ${max}.`);
        c.title = v;
      } else if (e.field === "pinterest_board") {
        if (r !== WIZ_SKIP && r) c.pinterest_board = r.slice(0, 120);
      } else if (e.field === "subreddit") {
        const v = r.replace(/^\/?r\//i, "").trim();
        if (!/^[A-Za-z0-9_]{2,40}$/.test(v)) return err("Digite só o nome do subreddit, sem espaços. Ex.: Dentistry");
        c.subreddit = v;
      } else {
        if (!/^https?:\/\/\S+\.\S+/.test(r)) return err("Cole um link começando com https://");
        c.destination_url = r;
      }
      const channels = d.channels.map((x, i) => (i === e.ch ? c : x));
      const next = s.extraIdx + 1;
      return next < s.extras.length ? go("extra", { channels }, { extraIdx: next }) : go("quando", { channels }, { extraIdx: next });
    }
    case "quando": {
      const opt = matchOption(r, [{ value: "sched", label: "Agendar data e hora" }, { value: "now", label: "Publicar agora" }]);
      if (!opt) return err("Escolha Agendar ou Publicar agora.");
      return opt.value === "now" ? go("review", { publish_now: true, date: null, time: null, scheduled_at: null }) : go("data", { publish_now: false });
    }
    case "data": {
      const date = parseDateBR(r, s.today);
      if (!date) return err("Não entendi a data. Use dd/mm/aaaa, “hoje” ou “amanhã”.");
      if (date < s.today) return err("Essa data já passou.");
      return go("hora", { date });
    }
    case "hora": {
      const t = parseTimeBR(r);
      if (t === null) return err("Não entendi o horário. Ex.: 10:30 ou 18h.");
      const iso = localInputToIso(`${d.date}T${fmtTime(t)}`, TZ);
      if (new Date(iso).getTime() <= now(deps) + 60_000) return err("Esse horário já passou. Escolha um horário futuro.");
      return go("review", { time: t, scheduled_at: iso });
    }
    case "review": return { state: s };
  }
}

function postSummary(s: PostState): string {
  const d = s.data;
  const cap = d.caption ? (d.caption.length > 300 ? `${d.caption.slice(0, 300)}…` : d.caption) : "—";
  return [
    "**Resumo do post**",
    `- **Produto:** ${d.product?.name ?? "—"}`,
    `- **Legenda:** ${cap.replace(/\n/g, " ")}`,
    `- **Hashtags:** ${d.hashtags.length ? d.hashtags.map((h) => `#${h}`).join(" ") : "—"}`,
    `- **1º comentário:** ${d.first_comment || "—"}`,
    `- **Mídia:** ${mediaLabel(d.media)}`,
    `- **Canais:** ${d.channels.map((c) => [chLabel(c), c.title ? `“${c.title}”` : "", c.subreddit ? `r/${c.subreddit}` : "", c.pinterest_board ? `pasta ${c.pinterest_board}` : ""].filter(Boolean).join(" ")).join("; ")}`,
    `- **Quando:** ${d.publish_now ? "publicar agora" : `${formatDateBR(d.date)} às ${fmtTime(d.time ?? 0)} (Brasília)`}`,
  ].join("\n");
}

export const socialPostWizard: WizardScript<PostState, SocialPostDeps> = {
  key: "post_social",
  title: "Criar post",
  intro: "Vamos criar o post no **Social Publisher › Criar Post**, campo a campo como na tela. No fim eu mostro o resumo e salvo depois do seu Confirmar.",
  async init(_deps, today) {
    return {
      step: "produto_busca", today, results: [], ai: null, aiInstructions: "", extras: [], extraIdx: 0,
      data: { product: null, caption: "", hashtags: [], first_comment: "", media: [], channelKeys: [], channels: [], publish_now: false, date: null, time: null, scheduled_at: null },
    };
  },
  question: postQuestion,
  answer: postAnswer,
  isReview: (s) => s.step === "review",
  summary: postSummary,
  payload(s) {
    const d = s.data;
    return {
      caption: d.caption, hashtags: d.hashtags, first_comment: d.first_comment,
      product_name: d.product?.name ?? null, product_slug: d.product?.slug ?? null, product_ref: d.product?.ref ?? null, product_category: d.product?.category ?? null,
      media_items: d.media, channels: d.channels, publish_now: d.publish_now, scheduled_at: d.scheduled_at, timezone: TZ,
      post_type: d.media.length > 1 && d.media.every((m) => m.type === "image") ? "carousel" : "feed",
    };
  },
};

/* ──────────────────────── Agendamento em massa ──────────────────────── */

export type BulkStep =
  | "midias" | "canais" | "ig_formatos" | "ig_grade" | "yt_formato" | "subreddit" | "pin_board"
  | "inicio" | "frequencia" | "horario" | "empresas" | "pessoas" | "colabs" | "orientacao" | "review";
export type BulkPost = { media: BulkMedia; date: string; time: string; copy: SocialCopy };
export type BulkState = {
  step: BulkStep; today: string; media: BulkMedia[]; opts: BulkOptions;
  start: string | null; interval: number; time: number | null;
  companies: string[]; people: string[]; instructions: string; posts: BulkPost[]; failures: string[];
};

const BM = "Agendar em massa";
const platformLabel = (p: SocialPlatform) => `${SOCIAL_CHANNELS[p].emoji} ${SOCIAL_CHANNELS[p].label}${VIDEO_ONLY.includes(p) ? " (só vídeos)" : ""}`;
const hasVideo = (s: BulkState) => s.media.some((m) => m.type === "video");

/** Próxima pergunta depois de "after" no bloco de canais (pula o que não se aplica). */
function nextChannelStep(s: BulkState, after: BulkStep): BulkStep {
  const order: BulkStep[] = ["ig_formatos", "ig_grade", "yt_formato", "subreddit", "pin_board", "inicio"];
  const applies = (st: BulkStep) => {
    const ch = s.opts.channels;
    if (st === "ig_formatos") return ch.includes("instagram");
    if (st === "ig_grade") return ch.includes("instagram") && s.opts.igReels && hasVideo(s);
    if (st === "yt_formato") return ch.includes("youtube") && hasVideo(s);
    if (st === "subreddit") return ch.includes("reddit");
    if (st === "pin_board") return ch.includes("pinterest");
    return true;
  };
  const i = after === "canais" ? 0 : order.indexOf(after) + 1;
  return order.slice(i).find(applies) ?? "inicio";
}

/** Mídias que ficariam sem nenhum canal com as opções atuais. */
export function uncoveredMedia(media: BulkMedia[], opts: BulkOptions) {
  return media.filter((m) => bulkChannels(opts, m.type === "video", "x").length === 0);
}

function bulkQuestion(s: BulkState): WizardQuestion {
  switch (s.step) {
    case "midias":
      return { where: `${BM} › 1. Mídias`, input: "upload", accept: "image/*,video/*", multiple: true, ask: "Envie as **imagens e vídeos** — cada um vira uma publicação.", help: `Até ${MAX_BULK_POSTS} mídias por vez; vídeo até 500 MB.` };
    case "canais": {
      const ps = (Object.keys(SOCIAL_CHANNELS) as SocialPlatform[]).filter((p) => hasVideo(s) || !VIDEO_ONLY.includes(p));
      return { where: `${BM} › 2. Canais e formatos`, input: "multi", ask: "Em quais **canais** publicar?", options: ps.map((p) => ({ value: p, label: platformLabel(p) })), selected: s.opts.channels };
    }
    case "ig_formatos": {
      const opts = [{ value: "feed", label: "Feed" }, ...(hasVideo(s) ? [{ value: "reels", label: "Reels (vídeos)" }] : []), { value: "stories", label: "Stories" }];
      const sel = [s.opts.igFeed && "feed", s.opts.igReels && hasVideo(s) && "reels", s.opts.igStories && "stories"].filter(Boolean) as string[];
      return { where: `${BM} › 2. Canais › Instagram`, input: "multi", ask: "Quais **formatos no Instagram**?", help: "Cada formato marcado vira uma publicação no Instagram.", options: opts, selected: sel };
    }
    case "ig_grade":
      return { where: `${BM} › 2. Canais › Instagram`, input: "choice", ask: "Os **Reels** aparecem também na grade do perfil?", options: [{ value: "show", label: "Sim, mostrar na grade" }, { value: "hide", label: "Não, ocultar da grade" }] };
    case "yt_formato":
      return { where: `${BM} › 2. Canais › YouTube`, input: "choice", ask: "No YouTube, como **vídeo** ou **Shorts**?", options: [{ value: "Vídeo", label: "Vídeo" }, { value: "Shorts", label: "Shorts" }] };
    case "subreddit":
      return { where: `${BM} › 2. Canais › Reddit`, input: "text", ask: "Em qual **subreddit**?", help: "Obrigatório para o Reddit. Sem o r/.", placeholder: "Dentistry" };
    case "pin_board":
      return { where: `${BM} › 2. Canais › Pinterest`, input: "text", ask: "Em qual **pasta (board)** do Pinterest? (opcional)", quick: [SKIP] };
    case "inicio":
      return { where: `${BM} › 3. Datas › Primeira publicação`, input: "date", ask: "Qual a **data da primeira publicação**?", quick: [{ value: "amanhã", label: "Amanhã" }] };
    case "frequencia":
      return { where: `${BM} › 3. Datas › Frequência`, input: "number", ask: "De quantos em quantos **dias** publicar?", help: `De 1 a ${BULK_MAX_INTERVAL} dias.`, quick: [{ value: "1", label: "Todo dia" }, { value: "2", label: "A cada 2 dias" }, { value: "7", label: "1 vez por semana" }] };
    case "horario":
      return { where: `${BM} › 3. Datas › Horário`, input: "text", ask: "Em qual **horário** (Brasília)?", help: "Entre 07:00 e 21:00, de 15 em 15 minutos.", quick: ["09:00", "12:00", "18:00"].map((v) => ({ value: v, label: v })) };
    case "empresas":
      return { where: `${BM} › 4. Marcações › Marcar empresas`, input: "text", ask: "Quer **marcar empresas**? Digite os @perfis.", placeholder: "@smartdent.oficial", quick: [SKIP] };
    case "pessoas":
      return { where: `${BM} › 4. Marcações › Marcar pessoas`, input: "text", ask: "Quer **marcar pessoas**? Digite os @perfis.", quick: [SKIP] };
    case "colabs":
      return { where: `${BM} › 4. Marcações › Colaboradores`, input: "text", ask: "Algum **colaborador** (até 3 @perfis)?", help: "O post aparece também no perfil do colaborador quando ele aceita.", quick: [SKIP] };
    case "orientacao":
      return { where: `${BM} › 5. Orientação para as legendas`, input: "textarea", ask: "Alguma **orientação para as legendas**? (opcional)", help: `Em seguida eu leio cada mídia e escrevo a legenda — com ${s.media.length} mídia(s) pode levar alguns minutos.`, quick: [SKIP], placeholder: "Ex.: tom educativo, chamar para o WhatsApp" };
    case "review":
      return { where: `${BM} › Agendar`, input: "choice", ask: "Confira o resumo acima. **Posso agendar as publicações?**", help: "Ao confirmar todas entram no Calendário.", options: REVIEW_OPTS("agendar") };
  }
}

async function bulkAnswer(s: BulkState, raw: string, deps: SocialPostDeps): Promise<WizardAnswer<BulkState>> {
  const r = String(raw ?? "").trim();
  const go = (step: BulkStep, patch: Partial<BulkState> = {}, note?: string): WizardAnswer<BulkState> => ({ state: { ...s, ...patch, step }, note });
  const setOpts = (o: Partial<BulkOptions>) => ({ ...s.opts, ...o });
  const err = (error: string): WizardAnswer<BulkState> => ({ error });
  const leaveChannels = (st: BulkState, after: BulkStep): WizardAnswer<BulkState> => {
    const next = nextChannelStep(st, after);
    if (next === "inicio") {
      const left = uncoveredMedia(st.media, st.opts);
      if (left.length) return err(`${left.length} mídia(s) ficariam sem canal (imagem não vai para YouTube/TikTok nem para Reels). Volte e marque outro canal ou formato.`);
    }
    return { state: { ...st, step: next } };
  };

  switch (s.step) {
    case "midias": {
      const media = parseMediaList(r);
      if (!media || !media.length) return err("Clique em Enviar arquivos e escolha as mídias.");
      const all = [...s.media, ...media];
      if (all.length > MAX_BULK_POSTS) return err(`São ${all.length} mídias; o limite é ${MAX_BULK_POSTS} por vez.`);
      return go("canais", { media: all });
    }
    case "canais": {
      const ids = parseIds(r) as SocialPlatform[] | null;
      if (!ids || !ids.length) return err("Marque pelo menos um canal e clique em Concluir.");
      if (ids.some((p) => !(p in SOCIAL_CHANNELS))) return err("Canal desconhecido.");
      return leaveChannels({ ...s, opts: setOpts({ channels: ids }) }, "canais");
    }
    case "ig_formatos": {
      const ids = parseIds(r);
      if (!ids || !ids.length) return err("Marque pelo menos um formato do Instagram.");
      return leaveChannels({ ...s, opts: setOpts({ igFeed: ids.includes("feed"), igReels: ids.includes("reels"), igStories: ids.includes("stories") }) }, "ig_formatos");
    }
    case "ig_grade": {
      const opt = matchOption(r, [{ value: "show", label: "Sim, mostrar na grade" }, { value: "hide", label: "Não, ocultar da grade" }]);
      if (!opt) return err("Escolha mostrar ou ocultar.");
      return leaveChannels({ ...s, opts: setOpts({ igHideFromGrid: opt.value === "hide" }) }, "ig_grade");
    }
    case "yt_formato": {
      const opt = matchOption(r, [{ value: "Vídeo", label: "Vídeo" }, { value: "Shorts", label: "Shorts" }]);
      if (!opt) return err("Escolha Vídeo ou Shorts.");
      return leaveChannels({ ...s, opts: setOpts({ ytFormat: opt.value as "Vídeo" | "Shorts" }) }, "yt_formato");
    }
    case "subreddit": {
      const v = r.replace(/^\/?r\//i, "").trim();
      if (!/^[A-Za-z0-9_]{2,40}$/.test(v)) return err("Digite só o nome do subreddit, sem espaços. Ex.: Dentistry");
      return leaveChannels({ ...s, opts: setOpts({ subreddit: v }) }, "subreddit");
    }
    case "pin_board":
      return leaveChannels({ ...s, opts: setOpts({ pinBoard: r === WIZ_SKIP ? "" : r.slice(0, 120) }) }, "pin_board");
    case "inicio": {
      const date = parseDateBR(r, s.today);
      if (!date) return err("Não entendi a data. Use dd/mm/aaaa ou “amanhã”.");
      if (date < s.today) return err("Essa data já passou.");
      return go("frequencia", { start: date });
    }
    case "frequencia": {
      const n = Number(r.replace(/\D/g, ""));
      if (!Number.isInteger(n) || n < 1 || n > BULK_MAX_INTERVAL) return err(`Digite um número de 1 a ${BULK_MAX_INTERVAL}.`);
      return go("horario", { interval: n });
    }
    case "horario": {
      const t = parseTimeBR(r);
      if (t === null) return err("Não entendi o horário. Ex.: 10:30.");
      if (t < BULK_MIN_T || t > BULK_MAX_T) return err("O horário precisa ficar entre 07:00 e 21:00.");
      if (t % 15) return err("Use horários de 15 em 15 minutos, ex.: 10:00, 10:15, 10:30.");
      if (new Date(localInputToIso(`${s.start}T${fmtTime(t)}`, TZ)).getTime() <= now(deps)) return err("A primeira publicação precisa ser no futuro. Volte e escolha outra data ou um horário mais tarde.");
      return go("empresas", { time: t });
    }
    case "empresas": return go("pessoas", { companies: r === WIZ_SKIP ? [] : handles(r) });
    case "pessoas": return go("colabs", { people: r === WIZ_SKIP ? [] : handles(r) });
    case "colabs": {
      const c = r === WIZ_SKIP ? [] : handles(r);
      if (c.length > 3) return err("O Instagram aceita no máximo 3 colaboradores.");
      return go("orientacao", { opts: setOpts({ tags: Array.from(new Set([...s.companies, ...s.people])), collabs: c }) });
    }
    case "orientacao": {
      const instructions = r === WIZ_SKIP ? "" : r.slice(0, 1000);
      const plan = bulkPlan(s.media, s.start!, s.interval, s.time!);
      const mentions = [...s.opts.tags, ...s.opts.collabs].map((h) => `@${h}`);
      const results = await deps.generateBulkCopies(plan.map((p) => p.media), instructions, mentions, s.opts.channels[0]);
      const posts: BulkPost[] = [];
      const failures: string[] = [];
      plan.forEach((p, i) => {
        const res = results[i];
        if (res && res.ok) posts.push({ ...p, copy: res.copy });
        else failures.push(`Mídia ${i + 1}: ${(res as { error?: string } | undefined)?.error ?? "sem resposta"}`);
      });
      if (!posts.length) return err(`Não consegui escrever nenhuma legenda:\n${failures.join("\n")}\nTente de novo.`);
      return go("review", { instructions, posts, failures }, failures.length ? `⚠️ ${failures.length} mídia(s) ficaram de fora:\n${failures.join("\n")}` : undefined);
    }
    case "review": return { state: s };
  }
}

/** Publicações prontas para gravar (mesmos canais/tipo que a tela de agendamento em massa). */
export function bulkRows(s: BulkState) {
  return s.posts.map((p) => {
    const isVideo = p.media.type === "video";
    return {
      caption: p.copy.caption, hashtags: p.copy.hashtags, first_comment: p.copy.first_comment,
      media_items: [p.media], channels: bulkChannels(s.opts, isVideo, p.copy.caption),
      publish_now: false, scheduled_at: localInputToIso(`${p.date}T${p.time}`, TZ), timezone: TZ,
      post_type: bulkPostType(s.opts, isVideo),
    };
  });
}

function bulkSummary(s: BulkState): string {
  const lines = s.posts.map((p, i) => {
    const chs = bulkChannels(s.opts, p.media.type === "video", p.copy.caption).map((c) => `${SOCIAL_CHANNELS[c.platform as SocialPlatform]?.label ?? c.platform} ${c.format}`).join(", ");
    const cap = p.copy.caption.replace(/\n/g, " ");
    return `${i + 1}. **${formatDateBR(p.date)} ${p.time}** · ${p.media.type === "video" ? "vídeo" : "imagem"} · ${chs}\n   “${cap.length > 110 ? `${cap.slice(0, 110)}…` : cap}”`;
  });
  return [
    `**Resumo — ${s.posts.length} publicação(ões)**`,
    `- **A cada:** ${s.interval} dia(s) às ${fmtTime(s.time ?? 0)} (Brasília)`,
    `- **Marcações:** ${s.opts.tags.length ? s.opts.tags.map((h) => `@${h}`).join(" ") : "—"}${s.opts.collabs.length ? ` · colaboradores ${s.opts.collabs.map((h) => `@${h}`).join(" ")}` : ""}`,
    "",
    ...lines,
  ].join("\n");
}

export const socialBulkWizard: WizardScript<BulkState, SocialPostDeps> = {
  key: "posts_massa",
  title: "Agendar posts em massa",
  intro: "Vamos agendar várias publicações de uma vez, como em **Social Publisher › Agendar em massa**. Cada mídia vira um post com legenda escrita pela IA; você revisa tudo antes de eu agendar.",
  async init(_deps, today) {
    return {
      step: "midias", today, media: [], start: null, interval: 1, time: null, companies: [], people: [], instructions: "", posts: [], failures: [],
      opts: { channels: ["instagram"], igFeed: true, igReels: true, igStories: false, igHideFromGrid: false, ytFormat: "Shorts", subreddit: "", pinBoard: "", tags: [], collabs: [] },
    };
  },
  question: bulkQuestion,
  answer: bulkAnswer,
  isReview: (s) => s.step === "review",
  summary: bulkSummary,
  payload: (s) => ({ posts: bulkRows(s) }),
};

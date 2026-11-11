// Passo a passo do Social Publisher no Copilot: valida de novo no servidor o que
// a conversa coletou (mesmas regras das telas Criar Post, Agendar em massa e
// Post Grupos) e devolve as linhas prontas para gravar. Validadores puros,
// cobertos por social_test.ts; a gravação fica em run*.

export const SOCIAL_ADMIN_ONLY = "Posts e grupos do Social Publisher só podem ser criados por administradores (mesma regra da tela).";
export const SOCIAL_TZ = "America/Sao_Paulo";
export const MAX_BULK_POSTS = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "pinterest", "reddit", "twitter", "linkedin", "gmb", "gallery"];
/** Formatos aceitos por canal (Criar Post + Agendar em massa). */
const FORMATS: Record<string, string[]> = {
  instagram: ["Feed", "Carrossel", "Stories", "Reels"],
  facebook: ["Post", "Álbum", "Stories", "Reels"],
  twitter: ["Post"],
  youtube: ["Vídeo", "Shorts"],
  pinterest: ["Image Pin", "Video Pin", "Idea Pin"],
  gmb: ["Update"],
  gallery: ["Mídia"],
  tiktok: ["Vídeo", "Carrossel"],
  reddit: ["Texto", "Link", "Imagem"],
  linkedin: ["Post"],
};
const NEEDS_MEDIA = new Set(["instagram", "tiktok", "youtube", "pinterest", "gallery"]);
const POST_TYPES = ["feed", "carousel", "reels", "story"];
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => str(v, max) || null;

type V<T> = { row: T | null; errors: string[] };

function validateMedia(raw: unknown, errors: string[]) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 20) { errors.push("Mídias inválidas (máximo 20)."); return []; }
  return raw.map((m: any, i) => {
    const url = String(m?.url || "");
    if (!/^https:\/\/\S+$/.test(url)) errors.push(`Mídia ${i + 1}: link inválido.`);
    if (m?.type !== "image" && m?.type !== "video") errors.push(`Mídia ${i + 1}: tipo deve ser imagem ou vídeo.`);
    const out: Record<string, unknown> = { url, type: m?.type };
    if (m?.path) out.path = String(m.path).slice(0, 300);
    if (Number(m?.width) > 0) out.width = Math.round(Number(m.width));
    if (Number(m?.height) > 0) out.height = Math.round(Number(m.height));
    return out;
  });
}

function validateChannels(raw: unknown, media: any[], errors: string[]) {
  if (!Array.isArray(raw) || !raw.length) { errors.push("Escolha pelo menos um canal."); return []; }
  if (raw.length > 25) { errors.push("Canais demais."); return []; }
  const hasVideo = media.some((m) => m.type === "video");
  const seen = new Set<string>();
  return raw.map((c: any) => {
    const platform = String(c?.platform || "");
    const format = String(c?.format || "");
    if (!PLATFORMS.includes(platform)) { errors.push(`Canal desconhecido: ${platform}.`); return null; }
    if (!FORMATS[platform].includes(format)) { errors.push(`Formato ${format} não existe em ${platform}.`); return null; }
    const key = `${platform}:${format}`;
    if (seen.has(key)) errors.push(`Canal repetido: ${platform} ${format}.`);
    seen.add(key);
    if ((platform === "youtube" || platform === "tiktok") && format !== "Carrossel" && !hasVideo) errors.push(`${platform} exige vídeo.`);
    if (NEEDS_MEDIA.has(platform) && !media.length) errors.push(`${platform} exige imagem ou vídeo.`);
    if (format === "Stories" && !media.length) errors.push("Stories exige mídia.");
    const out: Record<string, unknown> = { platform, format };
    const title = str(c?.title, 120);
    if (platform === "youtube" || platform === "pinterest" || platform === "reddit") {
      if (!title) errors.push(`${platform}: título obrigatório.`);
      else if (platform === "youtube" && title.length > 100) errors.push("YouTube: título com mais de 100 caracteres.");
      out.title = title;
    }
    if (platform === "reddit") {
      const sub = str(c?.subreddit, 40).replace(/^\/?r\//i, "");
      if (!/^[A-Za-z0-9_]{2,40}$/.test(sub)) errors.push("Reddit: subreddit inválido.");
      out.subreddit = sub;
      out.reddit_kind = ["text", "link", "image"].includes(c?.reddit_kind) ? c.reddit_kind : format === "Texto" ? "text" : format === "Link" ? "link" : "image";
      if (format === "Link") {
        const u = str(c?.destination_url, 500);
        if (!/^https?:\/\/\S+$/.test(u)) errors.push("Reddit Link: link inválido.");
        out.destination_url = u;
      }
    }
    if (platform === "pinterest" && str(c?.pinterest_board, 120)) out.pinterest_board = str(c.pinterest_board, 120);
    if (platform === "tiktok") out.tiktok_privacy = "public";
    if (platform === "instagram") {
      const tags = Array.isArray(c?.userTags) ? c.userTags.map((t: any) => String(t?.username || "")).filter(Boolean) : [];
      const collabs = Array.isArray(c?.collaborators) ? c.collaborators.map(String).filter(Boolean) : [];
      if (tags.some((h: string) => !HANDLE_RE.test(h)) || collabs.some((h: string) => !HANDLE_RE.test(h))) errors.push("Instagram: @perfil inválido nas marcações.");
      if (collabs.length > 3) errors.push("Instagram: no máximo 3 colaboradores.");
      if (tags.length) out.userTags = tags.slice(0, 20).map((username: string) => ({ username }));
      if (collabs.length) out.collaborators = collabs;
      if (c?.ig_share_to_feed === false && format === "Reels") out.ig_share_to_feed = false;
    }
    return out;
  }).filter(Boolean) as Record<string, unknown>[];
}

/** Um post (Criar Post ou cada item do Agendar em massa). */
export function validateSocialPost(input: any, nowMs = Date.now()): V<Record<string, unknown>> {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { row: null, errors: ["Dados inválidos."] };
  const caption = typeof input.caption === "string" ? input.caption.trim() : "";
  if (caption.length > 2200) errors.push("Legenda acima de 2200 caracteres.");
  const hashtags = Array.isArray(input.hashtags) ? Array.from(new Set(input.hashtags.map((h: unknown) => String(h).trim().replace(/^#+/, "")).filter(Boolean))) as string[] : [];
  if (hashtags.length > 30) errors.push("Máximo de 30 hashtags.");
  const first_comment = opt(input.first_comment, 2200);
  const media = validateMedia(input.media_items, errors);
  if (!caption && !media.length) errors.push("O post precisa de legenda ou mídia.");
  const channels = validateChannels(input.channels, media, errors);
  const publish_now = input.publish_now === true;
  let scheduled_at: string | null = null;
  if (!publish_now) {
    const t = new Date(String(input.scheduled_at || "")).getTime();
    if (!Number.isFinite(t)) errors.push("Data e hora do agendamento inválidas.");
    else if (t <= nowMs) errors.push("O agendamento precisa ser no futuro.");
    else scheduled_at = new Date(t).toISOString();
  }
  const post_type = POST_TYPES.includes(input.post_type) ? input.post_type : "feed";
  if (errors.length) return { row: null, errors };
  return {
    errors,
    row: {
      caption: caption || null, hashtags, first_comment, media_items: media, per_channel_media: {},
      channels, scheduled_at, timezone: SOCIAL_TZ, publish_now, status: publish_now ? "publishing" : "scheduled", post_type,
      product_name: opt(input.product_name, 200), product_slug: opt(input.product_slug, 200),
      product_ref: opt(input.product_ref, 120), product_category: opt(input.product_category, 120),
    },
  };
}

export function validateBulkPosts(input: any, nowMs = Date.now()): V<Record<string, unknown>[]> {
  const posts = Array.isArray(input?.posts) ? input.posts : [];
  if (!posts.length) return { row: null, errors: ["Nenhuma publicação para agendar."] };
  if (posts.length > MAX_BULK_POSTS) return { row: null, errors: [`Máximo de ${MAX_BULK_POSTS} publicações por vez.`] };
  const errors: string[] = [];
  const rows = posts.map((p: any, i: number) => {
    if (p?.publish_now) { errors.push(`Publicação ${i + 1}: o agendamento em massa não publica na hora.`); return null; }
    if (!Array.isArray(p?.media_items) || p.media_items.length !== 1) { errors.push(`Publicação ${i + 1}: precisa de exatamente uma mídia.`); return null; }
    const v = validateSocialPost({ ...p, publish_now: false, product_name: null, product_slug: null, product_ref: null, product_category: null }, nowMs);
    v.errors.forEach((e) => errors.push(`Publicação ${i + 1}: ${e}`));
    return v.row;
  });
  return errors.length ? { row: null, errors } : { row: rows as Record<string, unknown>[], errors };
}

export function validateGroupTargets(input: any): V<{ instance_name: string; enabled: boolean; group_ids: string[]; platforms: string[] }> {
  const errors: string[] = [];
  const instance_name = str(input?.instance_name, 120);
  if (!instance_name) errors.push("Escolha a instância.");
  const group_ids = Array.isArray(input?.group_ids) ? Array.from(new Set(input.group_ids.map(String))) as string[] : [];
  if (group_ids.some((id) => !UUID_RE.test(id))) errors.push("Grupo inválido.");
  if (group_ids.length > 500) errors.push("Máximo de 500 grupos por vez.");
  const platforms = Array.isArray(input?.platforms) ? Array.from(new Set(input.platforms.map(String))) as string[] : [];
  if (group_ids.length && !platforms.length) errors.push("Escolha pelo menos uma rede social.");
  if (platforms.some((p) => !PLATFORMS.includes(p))) errors.push("Rede social desconhecida.");
  if (typeof input?.enabled !== "boolean") errors.push("Informe se a instância fica ativa.");
  return errors.length ? { row: null, errors } : { row: { instance_name, enabled: input.enabled, group_ids, platforms }, errors };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validateLiveAutomation(input: any): V<Record<string, unknown>> {
  const errors: string[] = [];
  const name = str(input?.name, 120);
  if (name.length < 3) errors.push("Nome da automação muito curto.");
  const ids = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.map(String))) as string[] : []);
  const group_ids = ids(input?.group_ids), course_ids = ids(input?.course_ids);
  const instance_names = ids(input?.instance_names).map((s) => s.slice(0, 120));
  if (!group_ids.length) errors.push("Escolha pelo menos um grupo.");
  if ([...group_ids, ...course_ids].some((id) => !UUID_RE.test(id))) errors.push("Grupo ou live inválido.");
  const promo_enabled = input?.promo_enabled === true, live_enabled = input?.live_enabled === true;
  if (!promo_enabled && !live_enabled) errors.push("Ative a propaganda ou o lembrete ao vivo.");
  const days = Number(input?.promo_days_before), mins = Number(input?.live_minutes_before);
  if (!Number.isInteger(days) || days < 0 || days > 30) errors.push("Dias antes deve ser de 0 a 30.");
  if (!Number.isInteger(mins) || mins < 1 || mins > 240) errors.push("Minutos antes deve ser de 1 a 240.");
  const promo_time = String(input?.promo_time || "");
  if (!TIME_RE.test(promo_time)) errors.push("Horário da propaganda inválido.");
  const promo_template = str(input?.promo_template, 4000), live_template = str(input?.live_template, 4000);
  if (promo_enabled && promo_template.length < 10) errors.push("Texto da propaganda muito curto.");
  if (live_enabled && live_template.length < 10) errors.push("Texto do lembrete muito curto.");
  if (errors.length) return { row: null, errors };
  return {
    errors,
    row: {
      name, enabled: input?.enabled === true, group_ids, course_ids, instance_names,
      promo_enabled, promo_days_before: days, promo_time, promo_template: promo_template || null,
      live_enabled, live_minutes_before: mins, live_template: live_template || null,
    },
  };
}

/* ───────────────────────────── Gravação ───────────────────────────── */

export async function runSocialPosts(sb: any, payload: { posts: Record<string, unknown>[]; created_by: string | null }) {
  const rows = payload.posts.map((p) => ({ ...p, created_by: payload.created_by }));
  const { data, error } = await sb.from("social_scheduled_posts").insert(rows).select("id,scheduled_at,publish_now");
  if (error) throw new Error(error.message);
  return { ids: (data || []).map((r: any) => r.id), count: (data || []).length, first: data?.[0]?.scheduled_at ?? null, publish_now: !!data?.[0]?.publish_now };
}

export async function runGroupTargets(sb: any, p: { instance_name: string; enabled: boolean; group_ids: string[]; platforms: string[] }) {
  const { data: inst } = await sb.from("post_group_instance_config").select("instance_name,enabled").eq("instance_name", p.instance_name).maybeSingle();
  if (!inst) throw new Error(`Instância ${p.instance_name} não está em Post Grupos.`);
  let added = 0;
  if (p.group_ids.length) {
    const { data: groups } = await sb.from("wa_groups").select("id").eq("instance_name", p.instance_name).eq("ativo", true).in("id", p.group_ids);
    const valid = new Set((groups || []).map((g: any) => g.id));
    const missing = p.group_ids.filter((id) => !valid.has(id));
    if (missing.length) throw new Error(`${missing.length} grupo(s) não pertencem à instância ${p.instance_name} ou estão inativos.`);
    // Grupos já configurados ficam como estão (não trocamos as redes deles).
    const { data: ins, error } = await sb.from("post_group_targets")
      .upsert(p.group_ids.map((group_id) => ({ instance_name: p.instance_name, group_id, enabled: true, platforms: p.platforms })), { onConflict: "instance_name,group_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    added = (ins || []).length;
  }
  if (inst.enabled !== p.enabled) {
    const { error } = await sb.from("post_group_instance_config").update({ enabled: p.enabled }).eq("instance_name", p.instance_name);
    if (error) throw new Error(error.message);
  }
  return { instance_name: p.instance_name, enabled: p.enabled, added, changed_enabled: inst.enabled !== p.enabled };
}

export async function runLiveAutomation(sb: any, row: Record<string, unknown>) {
  const groupIds = row.group_ids as string[];
  const { data: groups } = await sb.from("wa_groups").select("id").in("id", groupIds);
  if ((groups || []).length !== groupIds.length) throw new Error("Algum grupo escolhido não existe mais.");
  const courseIds = row.course_ids as string[];
  if (courseIds.length) {
    const { data: courses } = await sb.from("smartops_courses").select("id").in("id", courseIds);
    if ((courses || []).length !== courseIds.length) throw new Error("Alguma live escolhida não existe mais.");
  }
  const { data, error } = await sb.from("live_group_automations").insert(row).select("id,name,enabled").single();
  if (error) throw new Error(error.message);
  return data;
}

export function socialResultMessage(type: string, r: any): string {
  if (type === "social_posts") {
    if (r.publish_now) return `✅ **Post na fila de publicação.** Ele sai em instantes; acompanhe em Social Publisher › Calendário.\n- ID: ${r.ids[0]}`;
    const when = r.first ? new Date(r.first).toLocaleString("pt-BR", { timeZone: SOCIAL_TZ, dateStyle: "short", timeStyle: "short" }) : "—";
    return r.count === 1
      ? `✅ **Post agendado** para ${when} (Brasília).\n- ID: ${r.ids[0]}\n- Veja em Social Publisher › Calendário.`
      : `✅ **${r.count} posts agendados**, o primeiro em ${when} (Brasília).\n- Veja em Social Publisher › Calendário.`;
  }
  if (type === "post_group_targets") {
    return `✅ **Post Grupos atualizado — ${r.instance_name}.**\n- Grupos adicionados: ${r.added}\n- Instância: ${r.enabled ? "ATIVA" : "inativa"}${r.changed_enabled ? " (alterada)" : ""}`;
  }
  return `✅ **Automação de lives salva:** ${r.name} — ${r.enabled ? "ativa" : "pausada"}.\n- ID: ${r.id}\n- Ajustes e envio de teste em Social Publisher › Post Grupos › Automação de Lives.`;
}

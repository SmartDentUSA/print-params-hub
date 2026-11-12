// Social posts da campanha (tabelas promocionais → botão "Social posts" da Agenda).
// Publicações do Instagram cuja legenda tem uma das hashtags da tabela.
// A mensagem padrão usa o MESMO prompt do resumo das campanhas de grupos
// (_shared/post-summary.ts) + link da publicação + o mesmo rodapé de cupom dos
// criativos, preenchido no servidor com o cupom do vendedor.
import { COUPON_BLOCK, EQUIPMENT_LINE } from "./creative-message.ts";
import { generatePostSummary } from "./post-summary.ts";

const TAG_CHARS = /[^\p{L}\p{N}_]/gu;

/** "#Black26, smartdent  #black26" → ["black26", "smartdent"] (minúsculas, sem #, sem repetição). */
export function normalizeHashtags(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input.join(" ") : String(input ?? "");
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const t = part.replace(/^#+/, "").replace(TAG_CHARS, "").toLowerCase();
    if (t && t.length <= 80 && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 10);
}

/** A legenda contém exatamente uma das hashtags (#black26 não casa com #black2026). */
export function captionHasHashtag(caption: string | null | undefined, tags: string[]): boolean {
  if (!caption || !tags.length) return false;
  const found = new Set<string>();
  for (const m of String(caption).matchAll(/#([\p{L}\p{N}_]+)/gu)) found.add(m[1].toLowerCase());
  return tags.some((t) => found.has(t));
}

/** Filtro PostgREST (or=) por legenda contendo "#tag"; o casamento exato é refeito em captionHasHashtag. */
export function hashtagOrFilter(tags: string[]): string {
  return tags.map((t) => `caption.ilike.*#${t}*`).join(",");
}

export function postLink(p: { short_link?: string | null; post_url?: string | null }): string {
  return String(p.short_link || p.post_url || "").trim();
}

/** Modelo: resumo da legenda + link da publicação + rodapé do cupom + equipamentos. */
export function buildSocialPostTemplate(summary: string, link: string): string {
  const body = String(summary ?? "").trim();
  const parts = [body, link ? `👉 ${link}` : "", COUPON_BLOCK, EQUIPMENT_LINE].filter(Boolean);
  return parts.join("\n\n");
}

export async function generateSocialPostTemplate(
  post: { caption?: string | null; platform?: string | null; short_link?: string | null; post_url?: string | null },
  apiKey: string | undefined | null,
): Promise<{ message: string; ai: boolean }> {
  const s = await generatePostSummary(String(post.caption ?? ""), post.platform || "instagram", apiKey, "[promo-social]");
  return { message: buildSocialPostTemplate(s.text, postLink(post)), ai: s.ai };
}

export const SOCIAL_POST_FIELDS = "id, caption, platform, post_url, short_link, thumbnail_url, media_url, media_urls, media_type, format, published_at";

/** Publicações do Instagram da tabela (mais recentes primeiro). */
export async function findTablePosts(sb: any, tags: string[], limit = 60): Promise<any[]> {
  if (!tags.length) return [];
  const { data, error } = await sb.from("social_posts").select(SOCIAL_POST_FIELDS)
    .eq("platform", "instagram").eq("status", "published")
    .or(hashtagOrFilter(tags))
    .order("published_at", { ascending: false }).limit(limit * 2);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((p: any) => captionHasHashtag(p.caption, tags)).slice(0, limit);
}

/**
 * Mensagens padrão das publicações (geradas uma vez e guardadas para todos).
 * Publicações ainda sem mensagem são geradas aqui, no máximo `maxNew` por chamada.
 */
export async function ensurePostMessages(
  sb: any, tableId: string, posts: any[], apiKey: string | undefined | null, maxNew = 8,
): Promise<Map<string, { whatsapp_message: string; ai_generated: boolean }>> {
  const ids = posts.map((p) => p.id);
  const map = new Map<string, { whatsapp_message: string; ai_generated: boolean }>();
  if (!ids.length) return map;
  const { data } = await sb.from("promotional_social_post_messages")
    .select("social_post_id, whatsapp_message, ai_generated").eq("promotional_table_id", tableId).in("social_post_id", ids);
  for (const r of data ?? []) map.set(r.social_post_id, { whatsapp_message: r.whatsapp_message ?? "", ai_generated: !!r.ai_generated });
  const missing = posts.filter((p) => !map.has(p.id)).slice(0, maxNew);
  const made = await Promise.all(missing.map(async (p) => ({ p, r: await generateSocialPostTemplate(p, apiKey) })));
  const rows = made.filter((m) => m.r.message.trim()).map((m) => ({
    promotional_table_id: tableId, social_post_id: m.p.id, whatsapp_message: m.r.message, ai_generated: m.r.ai,
  }));
  if (rows.length) {
    // ignoreDuplicates: duas aberturas simultâneas não sobrescrevem uma edição do editor.
    await sb.from("promotional_social_post_messages").upsert(rows, { onConflict: "promotional_table_id,social_post_id", ignoreDuplicates: true });
    for (const r of rows) if (!map.has(r.social_post_id)) map.set(r.social_post_id, { whatsapp_message: r.whatsapp_message, ai_generated: r.ai_generated });
  }
  return map;
}

/** Imagem da publicação para a miniatura (nunca vídeo). */
export function postCover(p: any): string | null {
  const c: string[] = [];
  if (p?.thumbnail_url) c.push(p.thumbnail_url);
  if (Array.isArray(p?.media_urls)) for (const m of p.media_urls) { const u = typeof m === "string" ? m : (m?.url ?? m?.public_url); if (u) c.push(u); }
  if (p?.media_url) c.push(p.media_url);
  for (const u of c) {
    if (!/^https?:\/\//i.test(u)) continue;
    const ext = (u.split("?")[0].split(".").pop() || "").toLowerCase();
    if (["mp4", "mov", "webm", "m4v", "m3u8"].includes(ext)) continue;
    return u;
  }
  return null;
}

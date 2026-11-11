// Regras do "Agendamento em massa" compartilhadas entre a tela e o passo a passo
// do Copilot: datas, canais/formatos de cada mídia e tipo do post. Puro e testável.
import type { SocialPlatform } from "../socialChannels.ts";

export const BULK_TZ = "America/Sao_Paulo";
/** Horário permitido na tela: 07:00 a 21:00, de 15 em 15 minutos. */
export const BULK_MIN_T = 7 * 60;
export const BULK_MAX_T = 21 * 60;
export const BULK_MAX_INTERVAL = 20;
export const VIDEO_ONLY: SocialPlatform[] = ["tiktok", "youtube"];

export type BulkMedia = { url: string; type: "image" | "video"; path?: string; width?: number; height?: number };
export type BulkOptions = {
  channels: SocialPlatform[];
  igFeed: boolean;
  igReels: boolean;
  igStories: boolean;
  igHideFromGrid: boolean;
  ytFormat: "Vídeo" | "Shorts";
  subreddit: string;
  pinBoard: string;
  /** @perfis já separados (sem @). */
  tags: string[];
  collabs: string[];
};

export const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "@a, @b c" → ["a","b","c"], sem repetição. */
export const handles = (s: string) =>
  Array.from(new Set(String(s || "").split(/[\s,;]+/).map((h) => h.trim().replace(/^@+/, "")).filter(Boolean)));

export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Uma publicação por mídia: primeira data + intervalo em dias, sempre no mesmo horário. */
export function bulkPlan<M>(media: M[], startDate: string, interval: number, time: number) {
  return media.map((m, i) => ({ media: m, date: addDays(startDate, i * interval), time: fmtTime(time) }));
}

/** Canais/formatos de uma mídia, igual à tela (vídeo-only some para imagens). */
export function bulkChannels(o: BulkOptions, isVideo: boolean, caption: string) {
  const title = (caption || "").split("\n")[0].slice(0, 100) || "Smart Dent";
  const userTags = o.tags.map((username) => ({ username }));
  return o.channels
    .filter((c) => isVideo || !VIDEO_ONLY.includes(c))
    .flatMap((c): Record<string, unknown>[] => {
      if (c === "instagram") {
        const base = { userTags, collaborators: o.collabs };
        const out: Record<string, unknown>[] = [];
        if (o.igFeed) out.push({ platform: c, format: "Feed", ...base });
        if (isVideo && o.igReels) out.push({ platform: c, format: "Reels", ...base, ...(o.igHideFromGrid ? { ig_share_to_feed: false } : {}) });
        if (o.igStories) out.push({ platform: c, format: "Stories", ...base });
        return out;
      }
      if (c === "youtube") return [{ platform: c, format: o.ytFormat, title: (caption || "").split("\n")[0].slice(0, 100) }];
      if (c === "tiktok") return [{ platform: c, format: "Vídeo", tiktok_privacy: "public" }];
      if (c === "pinterest") return [{ platform: c, format: isVideo ? "Video Pin" : "Image Pin", title, ...(o.pinBoard.trim() ? { pinterest_board: o.pinBoard.trim() } : {}) }];
      if (c === "reddit") return [{ platform: c, format: "Imagem", reddit_kind: "image", subreddit: o.subreddit.trim().replace(/^r\//, ""), title }];
      if (c === "gmb") return [{ platform: c, format: "Update" }];
      if (c === "gallery") return [{ platform: c, format: "Mídia" }];
      if (c === "facebook") return [{ platform: c, format: isVideo ? "Reels" : "Post" }];
      return [{ platform: c, format: "Post" }];
    });
}

export function bulkPostType(o: Pick<BulkOptions, "igFeed" | "igReels" | "igStories">, isVideo: boolean) {
  return isVideo ? (o.igStories && !o.igFeed && !o.igReels ? "story" : "reels") : (o.igStories && !o.igFeed ? "story" : "feed");
}

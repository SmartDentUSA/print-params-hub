/** Origens de clique aceitas (mesma lista de src/lib/clickOrigin.ts e da política do banco). */
export const CLICK_ORIGINS = ["email", "sms", "whatsapp", "grupos", "bio", "instagram", "facebook", "google", "site", "outros_sites"] as const;
export type ClickOrigin = (typeof CLICK_ORIGINS)[number];

export function normalizeClickOrigin(v: unknown): ClickOrigin | null {
  const s = String(v ?? "").trim().toLowerCase();
  return (CLICK_ORIGINS as readonly string[]).includes(s) ? (s as ClickOrigin) : null;
}

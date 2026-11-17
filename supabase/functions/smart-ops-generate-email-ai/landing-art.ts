// As artes dos cards da landing vêm embutidas como data:image, que o Gmail não mostra.
// Cada arte é copiada uma vez para o armazenamento público (nome pelo conteúdo, então a
// mesma arte não é enviada de novo) e o e-mail usa esse endereço.
import type { LandingArt } from "./custom-landing.ts";

const BUCKET = "wa-media";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

async function sha(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function artPath(landingId: string, slug: string, hash: string, mime: string): string {
  const safeId = String(landingId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "landing";
  return `email-landing-art/${safeId}/${slug}-${hash}.${EXT[mime] || "img"}`;
}

// deno-lint-ignore no-explicit-any
export async function publishLandingArt(supabase: any, landingId: string, items: [string, LandingArt | undefined][]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(items.map(async ([slug, art]) => {
    if (!art) return;
    if ("url" in art) { out.set(slug, art.url); return; }
    try {
      const bytes = Uint8Array.from(atob(art.base64), (c) => c.charCodeAt(0));
      const path = artPath(landingId, slug, await sha(bytes), art.mime);
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: art.mime, upsert: false, cacheControl: "31536000",
      });
      if (error && !/exist|duplicate|409/i.test(`${error.message || ""} ${error.statusCode || ""}`)) {
        console.warn("[generate-email-ai] arte não publicada", slug, error.message);
        return;
      }
      out.set(slug, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch (e) {
      console.warn("[generate-email-ai] arte inválida", slug, String(e));
    }
  }));
  return out;
}

/**
 * Supabase Storage Image Transformation helper.
 *
 * Rewrites public Storage URLs to the `/render/image/public/...` CDN
 * endpoint, which serves resized + cached + format-negotiated variants
 * (significantly smaller payloads + 1h browser cache).
 *
 * Safe by design:
 *  - URLs that are not Supabase Storage public objects pass through unchanged.
 *  - Already-transformed `/render/image/` URLs pass through unchanged.
 *  - Empty / null inputs are returned as-is.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

export interface StorageImageOptions {
  width?: number;
  height?: number;
  quality?: number; // 20-100, defaults to 75
  resize?: "cover" | "contain" | "fill";
}

const PUBLIC_OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_IMAGE_SEGMENT = "/storage/v1/render/image/public/";

export function getStorageImageUrl(
  url: string | null | undefined,
  opts: StorageImageOptions = {}
): string {
  if (!url) return url ?? "";

  // Already a transformed URL — leave untouched (idempotent).
  if (url.includes(RENDER_IMAGE_SEGMENT)) return url;

  // Not a Supabase public Storage URL — leave untouched (external CDNs,
  // Loja Integrada, Astron, placeholders, data URIs, etc.).
  if (!url.includes(PUBLIC_OBJECT_SEGMENT)) return url;

  const transformed = url.replace(PUBLIC_OBJECT_SEGMENT, RENDER_IMAGE_SEGMENT);

  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  params.set("resize", opts.resize ?? "contain");

  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}${params.toString()}`;
}

/**
 * Pick the correct file extension from a Blob/File's real MIME type.
 * Use this when persisting uploads so the stored extension matches the
 * actual bytes (prevents "PNG renamed to .webp" inflation that bypasses
 * format negotiation downstream).
 */
export function extensionFromMime(mime: string | undefined, fallback = "bin"): string {
  if (!mime) return fallback;
  const map: Record<string, string> = {
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
  };
  return map[mime.toLowerCase()] ?? fallback;
}
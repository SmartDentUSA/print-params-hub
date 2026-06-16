import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PUBLIC_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://okeogjgqijbfkudfjadz.supabase.co';

const BUCKET = 'wa-media';
const ROOT = 'carrosseis';
const MAX_RESULTS = 50;
const PARALLELISM = 8;
const SLIDE_RE = /^slide-(\d+)\.(png|jpg|jpeg|webp)$/i;

export interface SystemACarousel {
  ref: string;
  total: number;
  slides: string[];
  firstSlideUrl: string;
  createdAt: string | null;
  productHint: string;
}

function publicUrl(path: string) {
  return `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function humanize(ref: string) {
  // ref = carrosseis/{slug}/{uuid} — humanize the slug segment
  const parts = ref.split('/').filter(Boolean);
  const slug = parts.length >= 2 ? parts[1] : parts[parts.length - 1] ?? ref;
  return slug.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchCarousels(): Promise<SystemACarousel[]> {
  // Structure: wa-media/carrosseis/{produto-slug}/{uuid}/slide-N.png
  // 1) List product-slug folders inside `carrosseis/`
  const { data: slugFolders, error: slugErr } = await supabase.storage.from(BUCKET).list(ROOT, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (slugErr || !slugFolders) return [];

  const slugs = slugFolders
    .filter((e: any) => e && e.id === null && e.name)
    .map((e: any) => e.name as string);
  if (!slugs.length) return [];

  // 2) For each slug, list its uuid folders
  const uuidLists = await mapWithLimit(slugs, PARALLELISM, async (slug) => {
    const { data } = await supabase.storage.from(BUCKET).list(`${ROOT}/${slug}`, {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    const folders = (data ?? [])
      .filter((e: any) => e && e.id === null && e.name)
      .map((e: any) => ({
        slug,
        uuid: e.name as string,
        created: (e.created_at as string | null) ?? null,
      }));
    return folders;
  });

  const carouselDirs = uuidLists
    .flat()
    .sort((a, b) => {
      const ta = a.created ? Date.parse(a.created) : 0;
      const tb = b.created ? Date.parse(b.created) : 0;
      return tb - ta;
    })
    .slice(0, MAX_RESULTS);
  if (!carouselDirs.length) return [];

  // 3) For each {slug}/{uuid}, list slide-* files
  const carousels = await mapWithLimit(carouselDirs, PARALLELISM, async (dir) => {
    const ref = `${ROOT}/${dir.slug}/${dir.uuid}`;
    const { data: files } = await supabase.storage.from(BUCKET).list(ref, {
      limit: 50,
      search: 'slide-',
    });
    if (!files) return null;
    const slideEntries = files
      .map((x: any) => {
        const m = x.name?.match(SLIDE_RE);
        if (!m) return null;
        return { idx: parseInt(m[1], 10), name: x.name as string, created: x.created_at as string | null };
      })
      .filter(Boolean) as { idx: number; name: string; created: string | null }[];
    if (slideEntries.length < 1) return null;
    slideEntries.sort((a, b) => a.idx - b.idx);
    const slides = slideEntries.map((s) => publicUrl(`${ref}/${s.name}`));
    const createdAt = dir.created ?? slideEntries[0]?.created ?? null;
    const item: SystemACarousel = {
      ref,
      total: slides.length,
      slides,
      firstSlideUrl: slides[0],
      createdAt,
      productHint: humanize(ref),
    };
    return item;
  });

  return (carousels.filter(Boolean) as SystemACarousel[]).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

export function useSystemACarousels(enabled: boolean = true) {
  return useQuery({
    queryKey: ['system-a-carousels'],
    queryFn: fetchCarousels,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
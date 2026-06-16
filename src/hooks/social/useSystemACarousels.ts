import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PUBLIC_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://okeogjgqijbfkudfjadz.supabase.co';

const BUCKET = 'wa-media';
const MAX_FOLDERS = 50;
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
  const last = ref.split('/').filter(Boolean).pop() ?? ref;
  // strip uuid-ish suffixes
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b[0-9a-f]{8}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCarousels(): Promise<SystemACarousel[]> {
  const { data: roots, error } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error || !roots) return [];

  // Folders in supabase storage list come back with id === null
  const folders = roots
    .filter((e: any) => e && e.id === null && e.name)
    .slice(0, MAX_FOLDERS);

  const results = await Promise.all(
    folders.map(async (f: any) => {
      const { data: files } = await supabase.storage.from(BUCKET).list(f.name, {
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
      if (slideEntries.length < 2) return null;
      slideEntries.sort((a, b) => a.idx - b.idx);
      const slides = slideEntries.map((s) => publicUrl(`${f.name}/${s.name}`));
      const createdAt =
        (f.created_at as string | null) ?? slideEntries[0]?.created ?? null;
      const item: SystemACarousel = {
        ref: f.name,
        total: slides.length,
        slides,
        firstSlideUrl: slides[0],
        createdAt,
        productHint: humanize(f.name),
      };
      return item;
    }),
  );

  return (results.filter(Boolean) as SystemACarousel[]).sort((a, b) => {
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
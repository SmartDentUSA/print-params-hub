import { useEffect, useState } from 'react';
import type { MediaAspect } from '@/lib/social/mediaCompat';

/**
 * Carrega dimensões (width/height) de cada URL de imagem.
 * Vídeos são ignorados (mantém-se sem aspect detectado).
 */
export function useMediaAspects(items: Array<{ url?: string; type?: string }>): MediaAspect[] {
  const [aspects, setAspects] = useState<MediaAspect[]>([]);

  useEffect(() => {
    let cancelled = false;
    const imageItems = items.filter(
      (m): m is { url: string; type?: string } =>
        !!m.url && (m.type ?? 'image').startsWith('image'),
    );
    if (imageItems.length === 0) {
      setAspects([]);
      return;
    }
    const load = (url: string, useCors: boolean) =>
      new Promise<MediaAspect | null>((resolve) => {
        const img = new Image();
        if (useCors) img.crossOrigin = 'anonymous';
        img.onload = () =>
          resolve({
            url,
            width: img.naturalWidth,
            height: img.naturalHeight,
            ratio: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0,
          });
        img.onerror = () => resolve(null);
        img.src = url;
      });

    Promise.all(
      // Tenta com CORS e, se falhar (bucket sem header), refaz sem crossOrigin
      imageItems.map((m) => load(m.url, true).then((r) => r ?? load(m.url, false))),
    ).then((arr) => {
      if (!cancelled) setAspects(arr.filter(Boolean) as MediaAspect[]);
    });
    return () => {
      cancelled = true;
    };
  }, [items.map((m) => m.url).join('|')]);

  return aspects;
}
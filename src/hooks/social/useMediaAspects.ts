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
    Promise.all(
      imageItems.map(
        (m) =>
          new Promise<MediaAspect | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () =>
              resolve({
                url: m.url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                ratio: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0,
              });
            img.onerror = () => resolve(null);
            img.src = m.url;
          }),
      ),
    ).then((arr) => {
      if (!cancelled) setAspects(arr.filter(Boolean) as MediaAspect[]);
    });
    return () => {
      cancelled = true;
    };
  }, [items.map((m) => m.url).join('|')]);

  return aspects;
}
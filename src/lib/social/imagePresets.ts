// Presets oficiais de imagem por canal/uso. Fonte única usada por:
// - Editor de eventos (capa hero 16:9)
// - StepMedia (Social Publisher) para gerar/validar imagens por canal
// - Edge functions social-generate-image / event-generate-image

export type ImageAspect = '1:1' | '4:5' | '16:9' | '9:16';

export interface ImagePreset {
  id: string;
  label: string;
  aspect: ImageAspect;
  width: number;
  height: number;
  maxBytes: number; // limite recomendado em bytes
  note?: string;
}

export const IMAGE_PRESETS = {
  ig_fb_feed: {
    id: 'ig_fb_feed',
    label: 'Instagram / Facebook — Feed & Stories',
    aspect: '4:5',
    width: 1080,
    height: 1350,
    maxBytes: 8 * 1024 * 1024,
    note: 'Vertical 1080×1350 (4:5). Padrão de feed e stories.',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    maxBytes: 8 * 1024 * 1024,
    note: 'Quadrado orgânico 1080×1080 (1:1).',
  },
  linkedin_carousel: {
    id: 'linkedin_carousel',
    label: 'LinkedIn — Carrossel (PDF)',
    aspect: '4:5',
    width: 1080,
    height: 1350,
    maxBytes: 8 * 1024 * 1024,
    note: 'Cada página do PDF do carrossel: 1080×1350 (4:5).',
  },
  hero_kb: {
    id: 'hero_kb',
    label: 'Capa Hero — Base de Conhecimento / Evento',
    aspect: '16:9',
    width: 1200,
    height: 675,
    maxBytes: 5 * 1024 * 1024,
    note: 'Horizontal 1200×675 (16:9). Até 5 MB.',
  },
} as const satisfies Record<string, ImagePreset>;

export type ImagePresetId = keyof typeof IMAGE_PRESETS;

/** Retorna o preset recomendado para uma plataforma social. */
export function presetForPlatform(platform?: string | null): ImagePreset {
  const k = (platform || '').toLowerCase();
  if (k === 'reddit') return IMAGE_PRESETS.reddit;
  if (k === 'linkedin') return IMAGE_PRESETS.linkedin_carousel;
  // instagram / facebook (e default) => feed & stories 4:5
  return IMAGE_PRESETS.ig_fb_feed;
}

/** Valida arquivo contra um preset. Retorna mensagem de aviso ou null. */
export function validateAgainstPreset(file: File, preset: ImagePreset): string | null {
  if (file.size > preset.maxBytes) {
    const mb = Math.round(preset.maxBytes / (1024 * 1024));
    return `Arquivo acima de ${mb} MB (preset: ${preset.label}).`;
  }
  return null;
}

/** Hint legível para passar ao gerador de IA. */
export function presetHint(preset: ImagePreset): string {
  return `Formato ${preset.aspect} (${preset.width}×${preset.height}px) — ${preset.label}.`;
}
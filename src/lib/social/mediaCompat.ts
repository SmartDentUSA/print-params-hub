// Aspect ratio compatibility rules per channel format key.
// Limites baseados nas regras da Meta/TikTok/LinkedIn (Zernio replica).
import type { ChannelFormatKey } from '@/components/social/editor/ChannelFormatIcon';

export interface ChannelAspectRule {
  min: number;
  max: number;
  ideal?: string;
  /** sugestão amigável quando a mídia é incompatível */
  fixHint?: string;
}

/**
 * Faixas aceitas (width / height).
 * Feed IG/FB: 0.8 (4:5) — 1.91 (paisagem)
 * Stories/Reels/TikTok/Shorts: 0.5 (1:2) — 1.0 (quadrado); ideal 9:16 (~0.5625)
 * LinkedIn/Twitter Post: 0.4 — 2.4
 */
export const CHANNEL_ASPECT_RULES: Partial<Record<ChannelFormatKey, ChannelAspectRule>> = {
  'instagram-feed':    { min: 0.8,  max: 1.91, ideal: '4:5 a 1.91:1', fixHint: 'recorte a imagem para 4:5 ou use Stories/Reels' },
  'instagram-stories': { min: 0.5,  max: 1.0,  ideal: '9:16',          fixHint: 'use uma imagem vertical (até 1:1)' },
  'instagram-reels':   { min: 0.5,  max: 1.0,  ideal: '9:16',          fixHint: 'use vídeo/imagem vertical' },
  'facebook-feed':     { min: 0.8,  max: 1.91, ideal: '4:5 a 1.91:1',  fixHint: 'recorte para 4:5 ou use Stories/Reels' },
  'facebook-stories':  { min: 0.5,  max: 1.0,  ideal: '9:16',          fixHint: 'use mídia vertical' },
  'facebook-reels':    { min: 0.5,  max: 1.0,  ideal: '9:16',          fixHint: 'use mídia vertical' },
  'youtube-video':     { min: 1.0,  max: 2.0,  ideal: '16:9',          fixHint: 'use vídeo horizontal 16:9' },
  'youtube-shorts':    { min: 0.5,  max: 0.6,  ideal: '9:16',          fixHint: 'use vídeo vertical 9:16' },
  'tiktok-video':      { min: 0.5,  max: 1.0,  ideal: '9:16',          fixHint: 'use vídeo vertical 9:16' },
  'pinterest-pin':     { min: 0.4,  max: 1.0,  ideal: '2:3 a 1:1',     fixHint: 'use imagem vertical (2:3)' },
  'linkedin-post':     { min: 0.4,  max: 2.4,  ideal: '1.91:1 ou 1:1', fixHint: 'use até 1.91:1 horizontal' },
  'twitter-post':      { min: 0.4,  max: 2.4,  ideal: '16:9',          fixHint: 'use imagem 16:9' },
  'gmb-update':        { min: 0.5,  max: 2.0,  ideal: '4:3',           fixHint: 'use imagem mais próxima de 4:3' },
};

export function classifyAspect(ratio: number): 'vertical' | 'square' | 'landscape' {
  if (ratio < 0.95) return 'vertical';
  if (ratio > 1.05) return 'landscape';
  return 'square';
}

export function aspectLabel(width: number, height: number): string {
  const r = width / height;
  if (Math.abs(r - 1) < 0.02) return '1:1';
  if (Math.abs(r - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(r - 4 / 5) < 0.02) return '4:5';
  if (Math.abs(r - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(r - 2 / 3) < 0.02) return '2:3';
  if (Math.abs(r - 1.91) < 0.05) return '1.91:1';
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

export interface MediaAspect {
  url: string;
  width: number;
  height: number;
  ratio: number;
}

export interface ChannelCompatIssue {
  key: ChannelFormatKey;
  label: string;
  media: MediaAspect;
  rule: ChannelAspectRule;
  detected: string;
}

export function findCompatIssues(
  selected: Array<{ key: ChannelFormatKey; label: string }>,
  aspects: MediaAspect[],
): ChannelCompatIssue[] {
  const issues: ChannelCompatIssue[] = [];
  for (const ch of selected) {
    const rule = CHANNEL_ASPECT_RULES[ch.key];
    if (!rule) continue;
    for (const m of aspects) {
      if (!Number.isFinite(m.ratio) || m.ratio <= 0) continue;
      if (m.ratio < rule.min || m.ratio > rule.max) {
        issues.push({
          key: ch.key,
          label: ch.label,
          media: m,
          rule,
          detected: aspectLabel(m.width, m.height),
        });
      }
    }
  }
  return issues;
}
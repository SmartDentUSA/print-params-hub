// Requisitos oficiais por canal+formato exibidos no Social Publisher (Step Canais / Mídia).
import type { ChannelFormatKey } from '@/components/social/editor/ChannelFormatIcon';

export interface ChannelSpec {
  /** Proporção ideal (texto legível) */
  aspect: string;
  /** Resolução recomendada em px */
  size: string;
  /** Máximo de itens de mídia */
  maxMedia: number;
  /** Título obrigatório? */
  titleRequired?: boolean;
  /** Limite de caracteres da legenda/descrição */
  captionLimit?: number;
  /** Observação extra (duração de vídeo, peso, etc.) */
  note?: string;
}

export const CHANNEL_SPECS: Partial<Record<ChannelFormatKey, ChannelSpec>> = {
  'instagram-feed':      { aspect: '4:5 (ou 1:1)', size: '1080×1350', maxMedia: 1, captionLimit: 2200, note: 'Aceita 4:5 até 1.91:1. Vídeo até 60 min.' },
  'instagram-carousel':  { aspect: '4:5 (ou 1:1)', size: '1080×1350', maxMedia: 10, captionLimit: 2200, note: 'Todos os slides devem ter a mesma proporção.' },
  'instagram-stories':   { aspect: '9:16', size: '1080×1920', maxMedia: 1, captionLimit: 2200, note: 'Vídeo até 60s por card.' },
  'instagram-reels':     { aspect: '9:16', size: '1080×1920', maxMedia: 1, captionLimit: 2200, note: 'Vídeo de 3s a 90s.' },
  'facebook-feed':       { aspect: '4:5 a 1.91:1', size: '1200×1500', maxMedia: 1, captionLimit: 5000 },
  'facebook-album':      { aspect: '4:5 a 1.91:1', size: '1200×1500', maxMedia: 10, captionLimit: 5000 },
  'facebook-stories':    { aspect: '9:16', size: '1080×1920', maxMedia: 1, captionLimit: 5000, note: 'Vídeo até 60s.' },
  'facebook-reels':      { aspect: '9:16', size: '1080×1920', maxMedia: 1, captionLimit: 5000, note: 'Vídeo de 3s a 90s.' },
  'twitter-post':        { aspect: '16:9', size: '1600×900', maxMedia: 4, captionLimit: 280, note: 'Vídeo até 2min20s.' },
  'youtube-video':       { aspect: '16:9', size: '1920×1080', maxMedia: 1, titleRequired: true, captionLimit: 5000, note: '1 vídeo horizontal. Título obrigatório (até 100 caracteres).' },
  'youtube-shorts':      { aspect: '9:16', size: '1080×1920', maxMedia: 1, titleRequired: true, captionLimit: 5000, note: '1 vídeo vertical até 60s. Título obrigatório.' },
  'pinterest-pin':       { aspect: '2:3', size: '1000×1500', maxMedia: 1, titleRequired: true, captionLimit: 500, note: 'Título e board obrigatórios.' },
  'pinterest-video-pin': { aspect: '2:3 ou 9:16', size: '1000×1500', maxMedia: 1, titleRequired: true, captionLimit: 500, note: 'Vídeo de 4s a 15min.' },
  'pinterest-idea-pin':  { aspect: '9:16', size: '1080×1920', maxMedia: 20, titleRequired: true, captionLimit: 500 },
  'gmb-update':          { aspect: '4:3', size: '1200×900', maxMedia: 1, captionLimit: 1500, note: 'Imagem mínima 250×250, até 5 MB.' },
  'gallery-media':       { aspect: 'livre', size: 'qualquer', maxMedia: 20, note: 'Apenas armazenamento na galeria.' },
  'tiktok-video':        { aspect: '9:16', size: '1080×1920', maxMedia: 1, captionLimit: 2200, note: '1 vídeo de 3s a 10min.' },
  'tiktok-carousel':     { aspect: '9:16 ou 1:1', size: '1080×1920', maxMedia: 35, captionLimit: 2200 },
  'reddit-text':         { aspect: '—', size: 'sem mídia', maxMedia: 0, titleRequired: true, captionLimit: 40000, note: 'Título e subreddit obrigatórios.' },
  'reddit-link':         { aspect: '—', size: 'sem mídia', maxMedia: 0, titleRequired: true, note: 'Título, subreddit e URL obrigatórios.' },
  'reddit-image':        { aspect: '1:1', size: '1080×1080', maxMedia: 1, titleRequired: true, note: 'Título e subreddit obrigatórios.' },
  'linkedin-post':       { aspect: '1.91:1 ou 1:1', size: '1200×627', maxMedia: 9, captionLimit: 3000, note: 'Carrossel via PDF 1080×1350.' },
};

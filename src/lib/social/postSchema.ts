import { z } from 'zod';
import type { SocialPlatform } from '@/lib/socialChannels';

export const channelSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit']),
  format: z.string().min(1, 'Formato obrigatório'),
  title: z.string().max(120).optional(),
  pinterest_board: z.string().optional(),
  destination_url: z.string().url('URL inválida').optional().or(z.literal('')),
  subreddit: z.string().optional(),
  reddit_kind: z.enum(['self', 'link', 'image']).optional(),
  tiktok_privacy: z.enum(['public', 'friends', 'private']).optional(),
});
export type ChannelInput = z.infer<typeof channelSchema>;

export const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video']),
  path: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  crop: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

export const postSchema = z
  .object({
    caption: z.string().trim().max(2200, 'Máximo 2200 caracteres').optional().default(''),
    hashtags: z.array(z.string().trim().min(1)).max(30).default([]),
    first_comment: z.string().trim().max(2200).optional().default(''),
    product_name: z.string().trim().max(120).optional().default(''),
    product_slug: z.string().trim().max(160).optional().default(''),
    media_items: z.array(mediaItemSchema).default([]),
    per_channel_media: z.record(z.string(), z.array(mediaItemSchema)).default({}),
    channels: z.array(channelSchema).min(1, 'Selecione pelo menos 1 canal'),
    publish_now: z.boolean().default(false),
    scheduled_at: z.string().optional(),
    timezone: z.string().default('America/Sao_Paulo'),
    post_type: z.enum(['feed', 'carousel', 'story', 'reels']).default('feed'),
  })
  .superRefine((data, ctx) => {
    if (!data.publish_now && !data.scheduled_at) {
      ctx.addIssue({ code: 'custom', path: ['scheduled_at'], message: 'Defina data ou marque publicar agora' });
    }
    if (data.scheduled_at && !data.publish_now) {
      const d = new Date(data.scheduled_at);
      if (isNaN(d.getTime()) || d.getTime() < Date.now() - 60_000) {
        ctx.addIssue({ code: 'custom', path: ['scheduled_at'], message: 'Data deve ser futura' });
      }
    }
    const hasVideo = data.media_items.some((m) => m.type === 'video');
    const hasImage = data.media_items.some((m) => m.type === 'image');

    data.channels.forEach((c, i) => {
      const base = ['channels', i] as const;
      if ((c.platform === 'youtube' || c.platform === 'tiktok') && !hasVideo) {
        ctx.addIssue({ code: 'custom', path: [...base, 'format'], message: 'Requer vídeo na mídia' });
      }
      if (c.platform === 'youtube' && !c.title) {
        ctx.addIssue({ code: 'custom', path: [...base, 'title'], message: 'Título obrigatório no YouTube' });
      }
      if (c.platform === 'pinterest') {
        if (!hasImage && !hasVideo) {
          ctx.addIssue({ code: 'custom', path: [...base, 'format'], message: 'Pin precisa de imagem ou vídeo' });
        }
        if (!c.title) ctx.addIssue({ code: 'custom', path: [...base, 'title'], message: 'Título do Pin obrigatório' });
      }
      if (c.platform === 'reddit') {
        if (!c.subreddit) ctx.addIssue({ code: 'custom', path: [...base, 'subreddit'], message: 'Subreddit obrigatório' });
        if (!c.title) ctx.addIssue({ code: 'custom', path: [...base, 'title'], message: 'Título obrigatório' });
        if (c.reddit_kind === 'link' && !c.destination_url) {
          ctx.addIssue({ code: 'custom', path: [...base, 'destination_url'], message: 'URL obrigatória' });
        }
      }
      if (c.platform === 'instagram' && c.format?.toLowerCase().includes('stor') && !hasImage && !hasVideo) {
        ctx.addIssue({ code: 'custom', path: [...base, 'format'], message: 'Stories precisa de mídia' });
      }
    });

    if (!data.caption && data.media_items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['caption'], message: 'Adicione legenda ou mídia' });
    }
  });

export type PostInput = z.infer<typeof postSchema>;

export const defaultPost: PostInput = {
  caption: '',
  hashtags: [],
  first_comment: '',
  product_name: '',
  product_slug: '',
  media_items: [],
  per_channel_media: {},
  channels: [],
  publish_now: false,
  scheduled_at: '',
  timezone: 'America/Sao_Paulo',
  post_type: 'feed',
};

export const defaultChannelFor = (platform: SocialPlatform): ChannelInput => {
  const formatMap: Record<SocialPlatform, string> = {
    instagram: 'Feed',
    facebook: 'Post',
    tiktok: 'Vídeo',
    youtube: 'Shorts',
    pinterest: 'Image Pin',
    reddit: 'Texto',
  };
  return {
    platform,
    format: formatMap[platform],
    ...(platform === 'reddit' ? { reddit_kind: 'self' as const } : {}),
    ...(platform === 'tiktok' ? { tiktok_privacy: 'public' as const } : {}),
  };
};
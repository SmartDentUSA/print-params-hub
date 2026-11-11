// Canais e formatos do Criar Post (ordem do mLabs), usados pela tela e pelo Copilot.
import type { SocialPlatform } from "../socialChannels.ts";

export type ChannelFormatKey =
  | 'instagram-feed'
  | 'instagram-carousel'
  | 'instagram-stories'
  | 'instagram-reels'
  | 'facebook-feed'
  | 'facebook-album'
  | 'facebook-stories'
  | 'facebook-reels'
  | 'twitter-post'
  | 'youtube-video'
  | 'youtube-shorts'
  | 'pinterest-pin'
  | 'pinterest-video-pin'
  | 'pinterest-idea-pin'
  | 'gmb-update'
  | 'gallery-media'
  | 'tiktok-video'
  | 'tiktok-carousel'
  | 'reddit-text'
  | 'reddit-link'
  | 'reddit-image'
  | 'linkedin-post';

export interface ChannelFormatOption {
  key: ChannelFormatKey;
  platform: SocialPlatform;
  format: string;
  label: string;        // tooltip
  brandHex: string;
}

// Lista ordenada exatamente como no mLabs (esquerda → direita).
export const CHANNEL_FORMAT_OPTIONS: ChannelFormatOption[] = [
  { key: 'instagram-feed',    platform: 'instagram', format: 'Feed',    label: 'Instagram Feed',    brandHex: '#E1306C' },
  { key: 'instagram-carousel', platform: 'instagram', format: 'Carrossel', label: 'Instagram Carrossel', brandHex: '#E1306C' },
  { key: 'instagram-stories', platform: 'instagram', format: 'Stories', label: 'Instagram Stories', brandHex: '#E1306C' },
  { key: 'instagram-reels',   platform: 'instagram', format: 'Reels',   label: 'Instagram Reels',   brandHex: '#E1306C' },
  { key: 'facebook-feed',     platform: 'facebook',  format: 'Post',    label: 'Facebook Feed',     brandHex: '#1877F2' },
  { key: 'facebook-album',    platform: 'facebook',  format: 'Álbum',   label: 'Facebook Álbum',    brandHex: '#1877F2' },
  { key: 'facebook-stories',  platform: 'facebook',  format: 'Stories', label: 'Facebook Stories',  brandHex: '#1877F2' },
  { key: 'facebook-reels',    platform: 'facebook',  format: 'Reels',   label: 'Facebook Reels',    brandHex: '#1877F2' },
  { key: 'twitter-post',      platform: 'twitter',   format: 'Post',    label: 'X / Twitter',       brandHex: '#000000' },
  { key: 'youtube-video',     platform: 'youtube',   format: 'Vídeo',   label: 'YouTube Vídeo',     brandHex: '#FF0000' },
  { key: 'youtube-shorts',    platform: 'youtube',   format: 'Shorts',  label: 'YouTube Shorts',    brandHex: '#FF0000' },
  { key: 'pinterest-pin',     platform: 'pinterest', format: 'Image Pin', label: 'Pinterest',       brandHex: '#E60023' },
  { key: 'pinterest-video-pin', platform: 'pinterest', format: 'Video Pin', label: 'Pinterest Video Pin', brandHex: '#E60023' },
  { key: 'pinterest-idea-pin',  platform: 'pinterest', format: 'Idea Pin',  label: 'Pinterest Idea Pin',  brandHex: '#E60023' },
  { key: 'gmb-update',        platform: 'gmb',       format: 'Update',  label: 'Google Meu Negócio', brandHex: '#4285F4' },
  { key: 'gallery-media',     platform: 'gallery',   format: 'Mídia',   label: 'Galeria',           brandHex: '#6B7280' },
  { key: 'tiktok-video',      platform: 'tiktok',    format: 'Vídeo',   label: 'TikTok',            brandHex: '#000000' },
  { key: 'tiktok-carousel',   platform: 'tiktok',    format: 'Carrossel', label: 'TikTok Carrossel', brandHex: '#000000' },
  { key: 'reddit-text',       platform: 'reddit',    format: 'Texto',   label: 'Reddit Texto',      brandHex: '#FF4500' },
  { key: 'reddit-link',       platform: 'reddit',    format: 'Link',    label: 'Reddit Link',       brandHex: '#FF4500' },
  { key: 'reddit-image',      platform: 'reddit',    format: 'Imagem',  label: 'Reddit Imagem',     brandHex: '#FF4500' },
  { key: 'linkedin-post',     platform: 'linkedin',  format: 'Post',    label: 'LinkedIn',          brandHex: '#0A66C2' },
];

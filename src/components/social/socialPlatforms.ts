export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'gmb', label: 'Google Meu Negócio' },
  { value: 'gallery', label: 'Galeria' },
] as const;

export const ALL_PLATFORM_VALUES = SOCIAL_PLATFORMS.map((p) => p.value) as string[];

export function platformLabel(value: string) {
  return SOCIAL_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
] as const;

export const ALL_PLATFORM_VALUES = SOCIAL_PLATFORMS.map((p) => p.value) as string[];

export function platformLabel(value: string) {
  return SOCIAL_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

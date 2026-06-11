export type CategoryColor = {
  color: string;
  bgBadge: string;
  emoji: string;
  gradient: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  A: { color: '#1A73E8', bgBadge: 'rgba(26,115,232,0.10)', emoji: '🎬', gradient: 'linear-gradient(135deg, #1A73E8CC, #1A73E844)' },
  B: { color: '#EA4335', bgBadge: 'rgba(234,67,53,0.10)',  emoji: '🔧', gradient: 'linear-gradient(135deg, #EA4335CC, #EA433544)' },
  C: { color: '#34A853', bgBadge: 'rgba(52,168,83,0.10)',  emoji: '🔬', gradient: 'linear-gradient(135deg, #34A853CC, #34A85344)' },
  D: { color: '#7B61FF', bgBadge: 'rgba(123,97,255,0.10)', emoji: '🦷', gradient: 'linear-gradient(135deg, #7B61FFCC, #7B61FF44)' },
  E: { color: '#FBBC04', bgBadge: 'rgba(251,188,4,0.12)',  emoji: '⭐', gradient: 'linear-gradient(135deg, #FBBC04CC, #FBBC0444)' },
  F: { color: '#FF6D00', bgBadge: 'rgba(255,109,0,0.10)',  emoji: '⚙️', gradient: 'linear-gradient(135deg, #FF6D00CC, #FF6D0044)' },
  G: { color: '#00ACC1', bgBadge: 'rgba(0,172,193,0.10)',  emoji: '📦', gradient: 'linear-gradient(135deg, #00ACC1CC, #00ACC144)' },
};

export const CATEGORY_FALLBACK: CategoryColor = {
  color: '#5F6368', bgBadge: 'rgba(0,0,0,0.06)', emoji: '📄',
  gradient: 'linear-gradient(135deg, #9AA0A6CC, #9AA0A644)',
};

export const CATALOG_COLORS: Record<string, string> = {
  'SCANNERS 3D': '#1A73E8',
  'RESINAS 3D': '#34A853',
  'IMPRESSÃO 3D': '#FF6D00',
  'PÓS-IMPRESSÃO': '#7B61FF',
  'DENTÍSTICA, ESTÉTICA E ORTODONTIA': '#EA4335',
  'CARACTERIZAÇÃO': '#00ACC1',
  'SOFTWARES': '#FBBC04',
};

export function getCategoryColor(letter?: string | null): CategoryColor {
  if (!letter) return CATEGORY_FALLBACK;
  return CATEGORY_COLORS[letter.toUpperCase()] || CATEGORY_FALLBACK;
}
// Canonical category taxonomy shared by Catálogo, Revendas (público) e SmartOps.
export const CAT_ALIASES: Record<string, string> = {
  'SCANNERS 3D': 'SCANNERS 3D',
  'SCANNERS': 'SCANNERS 3D',
  'RESINAS 3D': 'RESINAS 3D',
  'RESINAS': 'RESINAS 3D',
  'IMPRESSÃO 3D': 'IMPRESSÃO 3D',
  'IMPRESSORAS 3D': 'IMPRESSÃO 3D',
  'PÓS-IMPRESSÃO': 'PÓS-IMPRESSÃO',
  'DENTÍSTICA, ESTÉTICA E ORTODONTIA': 'DENTÍSTICA, ESTÉTICA E ORTODONTIA',
  'CARACTERIZAÇÃO': 'CARACTERIZAÇÃO',
  'SOFTWARES': 'SOFTWARES',
  'SOFTWARE': 'SOFTWARES',
};

export const CANONICAL_CATS = Array.from(new Set(Object.values(CAT_ALIASES)));

export const CHIP_KEYS: { key: string; tk: string }[] = [
  { key: 'all', tk: 'kb.chips.all' },
  { key: 'SCANNERS 3D', tk: 'kb.chips.scanners' },
  { key: 'RESINAS 3D', tk: 'kb.chips.resinas' },
  { key: 'IMPRESSÃO 3D', tk: 'kb.chips.impressao' },
  { key: 'PÓS-IMPRESSÃO', tk: 'kb.chips.pos_impressao' },
  { key: 'CARACTERIZAÇÃO', tk: 'kb.chips.caracterizacao' },
  { key: 'DENTÍSTICA, ESTÉTICA E ORTODONTIA', tk: 'kb.chips.dentistica' },
  { key: 'SOFTWARES', tk: 'kb.chips.softwares' },
];

// Categorias que NÃO devem exibir filtro de subcategoria (mostra tudo agregado).
export const CATEGORIES_WITHOUT_SUBFILTER = new Set<string>(['SOFTWARES']);

export function normCat(v: string | null | undefined): string | null {
  if (!v) return null;
  const up = String(v).trim().toUpperCase();
  return CAT_ALIASES[up] ?? null;
}

// Scope autorizado por revenda:
//   { [canonicalCategory]: string[] }   // [] = todas subcategorias daquela categoria
export type AuthorizedScope = Record<string, string[]>;

export function scopeAllowsCategory(scope: AuthorizedScope | null | undefined, category: string): boolean {
  if (!scope) return false;
  return Object.prototype.hasOwnProperty.call(scope, category);
}

export function scopeHasAnything(scope: AuthorizedScope | null | undefined): boolean {
  return !!scope && Object.keys(scope).length > 0;
}

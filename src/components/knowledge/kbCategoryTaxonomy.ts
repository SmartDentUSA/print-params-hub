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

// Mapa canônico: UUID de knowledge_categories → chave i18n para o badge dos cards.
// Cobre as categorias usadas em Vídeos e Artigos da Base de Conhecimento.
export const CATEGORY_ID_TO_TK: Record<string, string> = {
  '45243aad-7143-4bc8-a649-05f741992e07': 'kb.chips.videos_tutoriais',
  '67b81704-64f8-4739-b79f-24f46f70752c': 'kb.chips.casos_clinicos',
  'fc493982-ad8c-417f-9579-82786a97925a': 'kb.chips.ciencia',
  'ff524477-c553-4518-868e-8435e16a5c57': 'kb.chips.depoimentos',
  '6b724172-f7c8-4a4c-bfb1-8c2ee4fc608e': 'kb.chips.catalogo_produtos',
  '83d0b6ea-59d7-4d98-80a1-ac7df83b697a': 'kb.chips.falhas',
  '67f92f1b-ea9e-42b9-94d1-7d685e25629c': 'kb.chips.parametros',
};

export function resolveCategoryTk(id: string | null | undefined): string | null {
  if (!id) return null;
  return CATEGORY_ID_TO_TK[id] ?? null;
}

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

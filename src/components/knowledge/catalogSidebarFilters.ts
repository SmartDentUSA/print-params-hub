import { canonFromCatalogRow } from './kbCategoryTaxonomy';

export type CatalogFilterDef = {
  key: string;
  label: string;
  chip?: string; // canonical category (from canonFromCatalogRow), else undefined = any
  subMatch?: (sub: string) => boolean;
  nameContains?: string; // case/accent-insensitive
};

export const CATALOG_SIDEBAR_FILTERS: CatalogFilterDef[] = [
  { key: 'solucoes',           label: 'Soluções',             chip: 'SOLUÇÕES' },
  { key: 'resinas_3d',         label: 'Resinas 3D',           chip: 'RESINAS 3D' },
  { key: 'scanners',           label: 'Scanners',             chip: 'SCANNERS 3D' },
  { key: 'softwares_cad',      label: 'Softwares',            chip: 'SOFTWARES' },
  { key: 'impressoras_3d',     label: 'Impressoras 3D',       chip: 'IMPRESSÃO 3D', subMatch: (s) => /IMPRESSORA/i.test(s) },
  { key: 'limpeza_acabamento', label: 'Limpeza',              subMatch: (s) => /^4\.2\b|LIMPEZA/i.test(s) },
  { key: 'pos_impressao',      label: 'Pós-impressão',        subMatch: (s) => /^4\.1\b|EQUIPAMENTOS/i.test(s) && /4\./.test(s) },
  { key: 'caracterizacao',     label: 'Finalização',          chip: 'CARACTERIZAÇÃO' },
  { key: 'resinas_diretas',    label: 'Resinas diretas',      subMatch: (s) => /^6\.3\b|RESINAS COMPOSTAS/i.test(s) },
  { key: 'cimentos',           label: 'Cimentos',             subMatch: (s) => /^6\.2\b|CIMENTOS/i.test(s) },
  { key: 'adesivos',           label: 'Adesivos',             nameContains: 'atos smart ortho' },
];

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function rowMatchesCatalogFilter(
  row: { name?: string | null; product_category?: string | null; product_subcategory?: string | null },
  def: CatalogFilterDef,
): boolean {
  if (def.key === 'all') return true;
  const canon = canonFromCatalogRow(row.product_category, row.product_subcategory);
  const sub = (row.product_subcategory || '').trim();
  if (def.chip && canon !== def.chip) return false;
  if (def.subMatch && !def.subMatch(sub)) return false;
  if (def.nameContains && !norm(row.name || '').includes(norm(def.nameContains))) return false;
  return true;
}

export function findCatalogFilter(key: string | null | undefined): CatalogFilterDef {
  return CATALOG_SIDEBAR_FILTERS.find((f) => f.key === key) ?? CATALOG_SIDEBAR_FILTERS[0];
}
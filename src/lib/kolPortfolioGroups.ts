/** Presentation only: catalog identifiers stay unchanged for commission matching. */
export interface KolCatalogCategory { cat: string; subs: string[] }

const STAGES = [
  "1 · Captura Digital", "2 · CAD", "3 · Impressão 3D",
  "4 · Pós-Impressão", "5 · Finalização", "6 · Cursos", "7 · Fresagem",
];

export function kolPortfolioStage(category: string): number | null {
  const name = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/dentistica|estetica|ortodontia|caracteriza|finaliza/.test(name)) return 5;
  if (/curso/.test(name)) return 6;
  if (/fresagem/.test(name)) return 7;
  if (/pos.*impress/.test(name)) return 4;
  if (/impress/.test(name)) return 3;
  if (/\bcad\b/.test(name)) return 2;
  if (/scan|captura/.test(name)) return 1;
  return null;
}

export function groupKolCatalogCategories(categories: KolCatalogCategory[]) {
  const groups = STAGES.map((label, index) => ({
    label,
    categories: categories.filter((category) => kolPortfolioStage(category.cat) === index + 1),
  }));
  const unmapped = categories.filter((category) => kolPortfolioStage(category.cat) === null);
  if (unmapped.length) groups.push({ label: "Outros itens do catálogo", categories: unmapped });
  return groups;
}
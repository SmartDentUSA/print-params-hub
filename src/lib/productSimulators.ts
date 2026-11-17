// Simuladores de WhatsApp por produto nas campanhas comerciais: cada produto ativo do
// catálogo comercial ganha um link do mesmo formulário (mesma origem de conversão) com o
// produto já escolhido (`pid`, validado em lia-capture) e um identificador próprio (`sim`)
// para o comparativo por canal. Nada é gravado: o link é montado a partir do catálogo.
import { buildLiaUrl } from "./attendanceChannel";
import type { ClickOrigin } from "./clickOrigin";
import { isCommercialCatalogItem, type CatalogRow } from "./catalogProductOptions";

const SIM_PREFIX = "p-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identificador do simulador do produto no comparativo por canal. */
export function productSimulatorId(productId: string): string {
  return `${SIM_PREFIX}${productId}`;
}

/** Produto do catálogo de um identificador `p-<id>`; outros simuladores devolvem null. */
export function productIdFromSimulator(simulatorId: string | null | undefined): string | null {
  const s = String(simulatorId ?? "");
  if (!s.startsWith(SIM_PREFIX)) return null;
  const id = s.slice(SIM_PREFIX.length);
  return UUID.test(id) ? id : null;
}

/** Link do simulador do formulário já com o produto escolhido; a origem vai como utm_term. */
export function productSimulatorUrl(opts: { formId: string; productId: string; base: string; origin?: ClickOrigin | null }): string {
  const url = new URL(buildLiaUrl({ formId: opts.formId, productId: opts.productId, simulator: productSimulatorId(opts.productId), base: opts.base }));
  url.searchParams.set("utm_source", "campanha");
  url.searchParams.set("utm_medium", "whatsapp_lia");
  if (opts.origin) url.searchParams.set("utm_term", opts.origin);
  return url.toString();
}

export interface ProductSimulatorGroup {
  category: string;
  items: { id: string; name: string }[];
}

/** Nome da família sem o número ("3. IMPRESSÃO 3D" → "IMPRESSÃO 3D"). */
export function familyLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "").replace(/^\s*\d+\s*[.)-]\s*/, "").trim();
  return s || "Outros";
}

/** Todos os produtos comerciais ativos, agrupados por família na ordem do catálogo, com busca opcional. */
export function groupProductSimulators(rows: CatalogRow[], search = ""): ProductSimulatorGroup[] {
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(search.trim());
  const groups = new Map<string, { order: string; items: { id: string; name: string }[] }>();
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id) || !isCommercialCatalogItem(r)) continue;
    seen.add(r.id);
    const name = r.name!.trim();
    if (q && !norm(name).includes(q)) continue;
    const label = familyLabel(r.product_category);
    const g = groups.get(label) ?? { order: String(r.product_category ?? "zzz"), items: [] };
    g.items.push({ id: r.id, name });
    groups.set(label, g);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order.localeCompare(b[1].order, "pt-BR", { numeric: true }))
    .map(([category, g]) => ({ category, items: g.items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }));
}

const normalizeOrigin = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Mirrors the portal's attribution: generic KOL origins do not identify a professional. */
export function isKolFormDeal(
  deal: { is_deleted?: boolean | null; origin_name?: string | null },
  formNames: readonly string[],
): boolean {
  const origin = normalizeOrigin(deal.origin_name);
  return !deal.is_deleted && !!origin && formNames.some((name) => normalizeOrigin(name) === origin);
}
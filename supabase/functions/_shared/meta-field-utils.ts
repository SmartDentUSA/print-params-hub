// Helpers para ler payloads Meta Lead Ads com chaves acentuadas / snake_case
// misturado. Meta manda `área_de_atuação`, `como_digitaliza_suas_moldagens?`,
// valores com underscore no lugar de espaço (`clínica_ou_consultório`).
// Estas utilidades normalizam ambos.

export function normalizeMetaKey(k: string | null | undefined): string {
  return String(k ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Converte value slugado ("clínica_ou_consultório") em string legível. */
export function unslugValue(v: string | null | undefined): string {
  return String(v ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Retorna o primeiro valor cujo nome de campo, após normalização,
 * contenha algum dos aliases. Aliases também são normalizados.
 */
export function pickMetaField(
  fmap: Record<string, unknown>,
  ...aliases: string[]
): string | null {
  const needles = aliases.map((a) => normalizeMetaKey(a)).filter(Boolean);
  for (const [k, raw] of Object.entries(fmap)) {
    if (raw === null || raw === undefined || raw === "") continue;
    const nk = normalizeMetaKey(k);
    if (!nk) continue;
    for (const n of needles) {
      if (nk === n || nk.includes(n)) {
        return unslugValue(String(raw));
      }
    }
  }
  return null;
}

/** Retorna um Record<string,string> com chaves normalizadas e valores unslugados. */
export function buildMetaFieldMap(
  fieldData: Array<{ name?: string; values?: unknown[] }> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return out;
  for (const f of fieldData) {
    const k = normalizeMetaKey(f?.name);
    if (!k) continue;
    const v = Array.isArray(f?.values) && f.values.length > 0 ? String(f.values[0] ?? "") : "";
    out[k] = unslugValue(v);
  }
  return out;
}
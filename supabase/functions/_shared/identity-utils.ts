/**
 * Identity utilities — detect when a Meta lead form's `nome` field is
 * actually a company / razão social rather than a real person name.
 *
 * Used by smart-ops-lia-assign to flag leads where the contact name will be
 * meaningless on the Person card and needs SDR review at first call.
 */

const COMPANY_KEYWORDS = [
  "clinica", "clínica", "consultorio", "consultório",
  "odonto", "odontologia",
  "estetica", "estética",
  "dental", "dentistry", "dentária", "dentaria",
  "smile", "sorriso",
  "ltda", "eireli", "mei", " me ", " me$", " s\\.?a\\.?",
  "center", "centro", "instituto", "institut",
  "spa\\b", "studio\\b",
];

const COMPANY_REGEX = new RegExp(
  `(?:^|\\s)(?:${COMPANY_KEYWORDS.join("|")})(?:\\s|$|\\.)`,
  "i",
);

/**
 * Returns true when the given name looks like a business / razão social.
 *
 * Heuristics:
 *  1. Matches a known company keyword (clínica, ltda, instituto, etc.)
 *  2. Is fully UPPERCASE with 2+ tokens (e.g. "ESTÉTICA AVANÇADA")
 *  3. Equals the empresa_razao_social or empresa_nome that came in the payload
 */
export function isCompanyLikeName(
  nome: string | null | undefined,
  context: { empresa_razao_social?: string | null; empresa_nome?: string | null } = {},
): boolean {
  if (!nome) return false;
  const trimmed = nome.trim();
  if (trimmed.length < 3) return false;

  // Rule 3: matches company name fields from payload
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const target = norm(trimmed);
  if (context.empresa_razao_social && norm(context.empresa_razao_social) === target) return true;
  if (context.empresa_nome && norm(context.empresa_nome) === target) return true;

  // Rule 1: company keyword
  if (COMPANY_REGEX.test(trimmed)) return true;

  // Rule 2: ALL CAPS with 2+ tokens, ignoring accents
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length >= 2) {
    const allCaps = tokens.every((t) => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t));
    if (allCaps) return true;
  }

  return false;
}

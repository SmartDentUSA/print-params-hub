/**
 * Centralized helpers for rendering lead identity in cards/details.
 * Handles placeholder names/emails/phones produced by sync pipelines
 * (Omie/PipeRun fallbacks) and prefers `omie_razao_social` when the
 * person name is missing or empty.
 */

const PLACEHOLDER_NAME_RE =
  /^(nome\s+n[ãa]o\s+informado|sem[\s-]*nome|n\/a|--+|\?+|null)$/i;

const PLACEHOLDER_EMAIL_RE =
  /^(e[\s-]?mail\s+n[ãa]o\s+informado|sem[\s-]*email|n\/a|null|gmail\.com|hotmail\.com|outlook\.com)$/i;

const PLACEHOLDER_EMAIL_DOMAIN_RE = /@(.+\.)?placeholder$/i;

const PLACEHOLDER_PHONE_RE = /^(\+?55)?0+$|^(n\/?a|null|sem[\s-]*telefone)$/i;

function isPlaceholderName(v: unknown): boolean {
  if (!v) return true;
  const s = String(v).trim();
  if (!s) return true;
  return PLACEHOLDER_NAME_RE.test(s);
}

export function cleanLeadName(v: unknown): string | null {
  if (isPlaceholderName(v)) return null;
  return String(v).trim();
}

export function cleanLeadEmail(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (PLACEHOLDER_EMAIL_RE.test(s)) return null;
  if (PLACEHOLDER_EMAIL_DOMAIN_RE.test(s)) return null;
  // Reject bare domains (no local part).
  if (!s.includes("@") || s.startsWith("@")) return null;
  return s;
}

export function cleanLeadPhone(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (PLACEHOLDER_PHONE_RE.test(s)) return null;
  return s;
}

export interface LeadIdentityFields {
  nome?: string | null;
  omie_razao_social?: string | null;
  empresa_cnpj?: string | null;
  [key: string]: unknown;
}

/**
 * Returns the display title for a lead card.
 * - If `nome` is missing/placeholder and `omie_razao_social` exists → razão social.
 * - If both exist and are different → "Pessoa · Razão Social".
 * - Falls back to CNPJ, then "Sem identificação".
 */
export function resolveLeadDisplayName(lead: LeadIdentityFields): string {
  const nome = cleanLeadName(lead.nome);
  const razao = cleanLeadName(lead.omie_razao_social);
  const cnpj = lead.empresa_cnpj ? String(lead.empresa_cnpj).trim() : null;

  if (nome && razao && nome.toLowerCase() !== razao.toLowerCase()) {
    return `${nome} · ${razao}`;
  }
  if (nome) return nome;
  if (razao) return razao;
  if (cnpj) return `CNPJ ${cnpj}`;
  return "Sem identificação";
}

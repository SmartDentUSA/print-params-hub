/**
 * Email sanitizer — política "sem falhas, sem perder dados".
 *
 * Origens externas (PipeRun, Meta, formulários, planilhas) mandam valores
 * como:
 *   - "a@x.com, b@y.com"        → lista de e-mails num único campo
 *   - "gmail.com" / "live.com"  → só o domínio (truncamento na origem)
 *   - "e-mail não informado"    → placeholder textual
 *
 * Nunca descartamos o valor original: `primary` vai para `email`, os demais
 * para `email_secundarios` e, quando nada é aproveitável, o valor bruto vai
 * para `email_invalido_raw`.
 */

const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /n[aã]o\s*informad/i,
  /not\s*provided/i,
  /sem\s*e-?mail/i,
  /no-?email/i,
  /@example\.com$/i,
  /@test(e)?\.com(\.br)?$/i,
  /@placeholder/i,
  /@unknown/i,
  /@whatsapp\.lead$/i,
  /@lid$/i,
];

const TYPO_MAP: Record<string, string> = {
  "gmail.comm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmail.comm": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.acom": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotnail.com": "hotmail.com",
  "outlook.comm": "outlook.com",
  "outlook.con": "outlook.com",
  "yahoo.comm": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yhaoo.com.br": "yahoo.com.br",
};

export interface SanitizedEmail {
  /** E-mail canônico válido (lowercase) ou null quando nada é aproveitável. */
  primary: string | null;
  /** Outros e-mails válidos encontrados no mesmo campo (sem duplicar primary). */
  extras: string[];
  /** Valor original quando não foi possível extrair nenhum e-mail válido. */
  invalidRaw: string | null;
}

function fixTypos(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).replace(/\.+$/, "");
  return `${local}@${TYPO_MAP[domain] ?? domain}`;
}

/** true quando o valor é claramente um placeholder e não um e-mail real. */
export function isPlaceholderEmail(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const v = String(raw).trim();
  if (!v) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

/** true quando o valor é um e-mail válido e não-placeholder. */
export function isRealEmail(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return EMAIL_REGEX.test(v) && !isPlaceholderEmail(v);
}

/**
 * Extrai e-mails de um campo livre, preservando o que sobrar.
 * Nunca lança exceção.
 */
export function sanitizeEmailField(raw: string | null | undefined): SanitizedEmail {
  const original = raw == null ? "" : String(raw).trim();
  if (!original) return { primary: null, extras: [], invalidRaw: null };

  const tokens = original
    .split(/[,;/|\s]+/)
    .map((t) => t.trim().replace(/^[<("']+|[>)"'.]+$/g, "").toLowerCase())
    .filter(Boolean);

  const valid: string[] = [];
  for (const token of tokens) {
    if (!token.includes("@")) continue; // domínio puro / texto solto
    const fixed = fixTypos(token);
    if (isRealEmail(fixed) && !valid.includes(fixed)) valid.push(fixed);
  }

  if (valid.length === 0) {
    return { primary: null, extras: [], invalidRaw: original };
  }
  return { primary: valid[0], extras: valid.slice(1), invalidRaw: null };
}

/**
 * Atalho compatível com o antigo `normalizeEmail`: devolve só o e-mail
 * canônico (ou null). Use `sanitizeEmailField` quando quiser preservar
 * secundários e valor bruto.
 */
export function normalizeEmailStrict(raw: string | null | undefined): string | null {
  return sanitizeEmailField(raw).primary;
}
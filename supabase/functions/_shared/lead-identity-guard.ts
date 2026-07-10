/**
 * Lead Identity Guard
 * --------------------
 * Centraliza a regra: NUNCA criar lead em `lia_attendances` sem
 * nome real + email real + telefone real.
 *
 * Uso:
 *   const check = validateLeadIdentity({ nome, email, phone, phoneNormalized, rawPhone });
 *   if (!check.ok) {
 *     // não inserir, log + skip
 *   }
 */

const FAKE_EMAIL_DOMAINS = [
  "@whatsapp.lead",
  "@lid",
  "@n",
  "@placeholder",
  "@unknown",
];

const TEST_EMAIL_DOMAINS = [
  "@test.com",
  "@test.com.br",
  "@example.com",
  "@teste.com",
];

const PLACEHOLDER_NAME_PATTERNS: RegExp[] = [
  /^sem\s*nome$/i,
  /^lead\s*piperun$/i,
  /^whatsapp\s*\d{2,6}$/i,
  /^wa[_\s-]?\d+$/i,
  /^cliente\s*\d*$/i,
  /^desconhecido$/i,
  /^n\/?a$/i,
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalize decorative Unicode letters (Mathematical Alphanumeric Symbols
 * U+1D400–U+1D7FF, fullwidth, enclosed) to plain ASCII A–Z/a–z so
 * `𝙕𝙖𝙝𝙣3𝘿 𝘿𝙚𝙣𝙩𝙖𝙡 𝙇𝙖𝙗` becomes `Zahn3D Dental Lab`.
 *
 * Meta Lead Ads often carries names typed with these stylized glyphs
 * (labs use fancy fonts on their Instagram profiles) and the previous
 * regex `/[^A-Za-zÀ-ÿ]/g` treated them as non-letters, blocking the lead
 * from being ingested.
 */
export function normalizeStyledLetters(input: string | null | undefined): string {
  if (!input) return "";
  const s = String(input).normalize("NFKC");
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    // Mathematical Alphanumeric Symbols block: U+1D400..U+1D7FF
    if (cp >= 0x1d400 && cp <= 0x1d7ff) {
      const offset = cp - 0x1d400;
      // The block is arranged in 52-glyph rows (26 upper + 26 lower).
      // Mapping via modulo yields the correct ASCII letter for every style
      // (bold, italic, script, fraktur, double-struck, sans-serif, mono, …).
      const mod = offset % 52;
      if (mod < 26) {
        out += String.fromCharCode(65 + mod); // A-Z
      } else {
        out += String.fromCharCode(97 + (mod - 26)); // a-z
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Public helper: return a display-safe version of a name, converting
 * decorative glyphs and collapsing whitespace. Non-letters (digits,
 * spaces, punctuation) are preserved.
 */
export function sanitizeDisplayName(input: string | null | undefined): string {
  const normalized = normalizeStyledLetters(input);
  return normalized.replace(/\s+/g, " ").trim();
}

export type IdentityCheck = {
  ok: boolean;
  missing: string[];
  reasons: string[];
};

export function isFakeEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const e = email.toLowerCase().trim();
  if (!EMAIL_REGEX.test(e)) return true;
  if (FAKE_EMAIL_DOMAINS.some((d) => e.endsWith(d))) return true;
  if (TEST_EMAIL_DOMAINS.some((d) => e.endsWith(d))) return true;
  if (/^teste?[\-_@]/i.test(e)) return true;
  return false;
}

export function isFakeName(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = normalizeStyledLetters(name).trim();
  if (n.length < 2) return true;
  // precisa ter ao menos 2 letras (alfa)
  const alpha = n.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (alpha.length < 2) return true;
  if (PLACEHOLDER_NAME_PATTERNS.some((re) => re.test(n))) return true;
  return false;
}

export function isFakePhone(opts: {
  phoneNormalized?: string | null;
  rawPhone?: string | null;
}): boolean {
  const raw = (opts.rawPhone || "").toString();
  // Qualquer rastro de LID/JID interno do WhatsApp = fake
  if (/@(lid|s\.whatsapp\.net|c\.us)$/i.test(raw)) {
    // se rawPhone ainda tem o sufixo @lid, não foi resolvido — fake
    if (/@lid$/i.test(raw)) return true;
  }
  const norm = (opts.phoneNormalized || "").replace(/\D/g, "");
  const rawDigits = raw.replace(/\D/g, "");
  const digits = norm || rawDigits;
  if (!digits) return true;
  // LIDs costumam ter > 13 dígitos e não casam com formatos BR/internacionais
  if (digits.length < 10 || digits.length > 15) return true;
  return false;
}

export function validateLeadIdentity(input: {
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNormalized?: string | null;
  rawPhone?: string | null;
}): IdentityCheck {
  const missing: string[] = [];
  const reasons: string[] = [];

  if (isFakeName(input.nome)) {
    missing.push("nome");
    reasons.push(`nome inválido/placeholder: "${input.nome ?? ""}"`);
  }
  if (isFakeEmail(input.email)) {
    missing.push("email");
    reasons.push(`email inválido/placeholder: "${input.email ?? ""}"`);
  }
  if (
    isFakePhone({
      phoneNormalized: input.phoneNormalized,
      rawPhone: input.rawPhone || input.phone,
    })
  ) {
    missing.push("telefone");
    reasons.push(
      `telefone inválido/ausente: raw="${input.rawPhone || input.phone || ""}" normalized="${input.phoneNormalized || ""}"`,
    );
  }

  return { ok: missing.length === 0, missing, reasons };
}

/**
 * Helper: registra rejeição em `system_health_logs` (best-effort, não lança).
 */
export async function logRejectedLead(
  supabase: { from: (t: string) => { insert: (row: unknown) => Promise<unknown> } },
  args: {
    functionName: string;
    source: string;
    check: IdentityCheck;
    email?: string | null;
    raw?: unknown;
  },
): Promise<void> {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: args.functionName,
      severity: "info",
      error_type: "lead_rejected_missing_identity",
      lead_email: args.email || null,
      details: {
        source: args.source,
        missing: args.check.missing,
        reasons: args.check.reasons,
        raw: args.raw ?? null,
      },
    });
  } catch {
    // best-effort
  }
}
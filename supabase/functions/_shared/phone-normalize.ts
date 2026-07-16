/**
 * Canonical phone normalizer.
 *
 * Brazilian mobile rule (ANATEL): cellphones MUST have 9 digits after the
 * 2-digit DDD, and the 9-digit block always starts with `9`. PipeRun, Sellflux
 * and other upstreams sometimes deliver the legacy 8-digit form (e.g.
 * `38 9847-5101`). Storing it raw breaks WhatsApp links, deal notes and
 * Person matching. This helper repairs that.
 *
 * Output: E.164-ish string starting with `+`, or `null` when the number is
 * unrecoverable.
 */
// Whitelist of DDDs that actually exist in Brazil (ANATEL Plano Nacional de
// Numeração, mirror of table `ddd_referencia`). Anything outside this set is
// NOT a Brazilian phone — must not be force-prefixed with `55`, otherwise we
// end up storing garbage like `+555926826813` (DDD 59 doesn't exist; the raw
// input was an international Meta Lead Ads phone that got mis-normalized).
const VALID_BR_DDDS = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

function tryParseBR(digits: string): string | null {
  // digits already starts with "55" and has DDD(2) + subscriber(8|9).
  const ddd = digits.slice(2, 4);
  let subscriber = digits.slice(4);
  if (!VALID_BR_DDDS.has(ddd)) return null;
  // 8-digit subscriber starting with 6/7/8/9 → legacy mobile, prepend the 9.
  if (subscriber.length === 8 && /^[6789]/.test(subscriber)) {
    subscriber = "9" + subscriber;
  }
  const isLandline = subscriber.length === 8 && /^[2-5]/.test(subscriber);
  const isMobile = subscriber.length === 9 && subscriber.startsWith("9");
  if (!isLandline && !isMobile) return null;
  return "+55" + ddd + subscriber;
}

export function normalizeBrazilianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  // Strip leading zeros (operator prefix like 0XX).
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits) return null;

  // Attempt cascade to identify a Brazilian phone. We only force the `55`
  // country prefix when the DDD is real — otherwise we would turn a foreign
  // phone (Uruguay +598, Argentina +54, Colombia +57 …) into a fake BR
  // number with a nonexistent DDD.
  const candidates: string[] = [];
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    candidates.push(digits);
  }
  if (digits.length === 10 || digits.length === 11) {
    candidates.push("55" + digits);
  }
  // Edge case: `55` + 10-digit input (DDI + DDD + 8-digit legacy mobile) →
  // 12 digits already handled above. `55` + 11-digit input → 13 handled.
  // For 11-digit starting with 55, also try treating it as DDI+DDD(1)+... — no,
  // DDD is always 2 digits, so 11-digit "55XXXXXXXXX" is 55+DDD(2)+sub(7),
  // which cannot be a valid BR phone. Skip.

  for (const cand of candidates) {
    const parsed = tryParseBR(cand);
    if (parsed) return parsed;
  }

  // Not a valid Brazilian phone. Preserve as international E.164-ish when the
  // shape is plausible (8–15 digits). Downstream PipeRun accepts these but we
  // stop forcing a fake `+55` prefix.
  if (digits.length >= 8 && digits.length <= 15) return "+" + digits;
  return null;
}

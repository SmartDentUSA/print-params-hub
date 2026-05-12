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
export function normalizeBrazilianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  // Strip leading zeros (operator prefix like 0XX).
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits) return null;

  // Non-BR numbers (already have a country code other than 55): preserve as-is
  // when length is plausibly an international phone (8–15 digits).
  const looksBR =
    digits.startsWith("55") ||
    digits.length === 10 || // DDD + 8
    digits.length === 11;   // DDD + 9

  if (!looksBR) {
    if (digits.length >= 8 && digits.length <= 15) return "+" + digits;
    return null;
  }

  // Ensure 55 country code.
  if (!digits.startsWith("55")) digits = "55" + digits;

  // After "55": expect DDD(2) + subscriber(8 or 9).
  const ddd = digits.slice(2, 4);
  let subscriber = digits.slice(4);

  if (!/^[1-9]\d$/.test(ddd) || Number(ddd) < 11) return null;

  // 8-digit subscriber starting with 6/7/8/9 → legacy mobile, prepend the 9.
  if (subscriber.length === 8 && /^[6789]/.test(subscriber)) {
    subscriber = "9" + subscriber;
  }

  // Validate final shape: 8 (landline) or 9 (mobile starting with 9) digits.
  const isLandline = subscriber.length === 8 && /^[2-5]/.test(subscriber);
  const isMobile = subscriber.length === 9 && subscriber.startsWith("9");
  if (!isLandline && !isMobile) return null;

  return "+55" + ddd + subscriber;
}

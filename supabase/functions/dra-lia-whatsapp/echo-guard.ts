// ── Anti-echo guard: detects whether an inbound WhatsApp message is just
// an echo of one of LIA's own recent outbound messages (SDR re-send,
// Evolution loopback, etc.). Pure logic, no I/O — easy to unit test.

export function normalizeForEcho(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface EchoResult {
  isEcho: boolean;
  matchedIndex?: number;
  reason?: "exact" | "prefix";
}

/**
 * Returns isEcho=true if `incoming` matches any of the (up to) last 5
 * outbound messages in `recentOutbound`. Match rules:
 *   - normalized exact equality, OR
 *   - outbound is "long" (normalized > 40 chars) and inbound contains its
 *     first 60 normalized chars as a substring
 * Outbounds whose normalized form is < 8 chars are ignored as comparison
 * bases (too short → false positives on greetings like "ok", "sim").
 */
export function isEchoOfOutbound(
  incoming: string,
  recentOutbound: string[],
): EchoResult {
  const incomingNorm = normalizeForEcho(incoming);
  if (!incomingNorm) return { isEcho: false };

  for (let i = 0; i < recentOutbound.length; i++) {
    const outNorm = normalizeForEcho(recentOutbound[i]);
    if (!outNorm || outNorm.length < 8) continue;
    if (outNorm === incomingNorm) {
      return { isEcho: true, matchedIndex: i, reason: "exact" };
    }
    if (outNorm.length > 40 && incomingNorm.includes(outNorm.slice(0, 60))) {
      return { isEcho: true, matchedIndex: i, reason: "prefix" };
    }
  }
  return { isEcho: false };
}

// Converte os destinatários de um envio da Zernio no formato gravado por
// fn_wa_official_apply_recipients (status individual do WhatsApp Oficial na timeline do lead).
export type RecipientRow = {
  phone: string; status: string; sent_at: string | null; delivered_at: string | null;
  read_at: string | null; message_id: string | null; error: string | null;
};

const FINAL = new Set(["sent", "delivered", "read", "failed"]);

// deno-lint-ignore no-explicit-any
export function toRecipientRows(recipients: any[]): RecipientRow[] {
  const out: RecipientRow[] = [];
  for (const x of recipients ?? []) {
    const phone = String(x?.platformIdentifier ?? "").replace(/\D/g, "");
    const status = String(x?.status ?? "").toLowerCase();
    if (!phone || !FINAL.has(status)) continue;
    out.push({
      phone, status,
      sent_at: x.sentAt ?? null,
      delivered_at: x.deliveredAt ?? null,
      read_at: x.readAt ?? null,
      message_id: x.messageId ?? null,
      error: status === "failed" ? `${x.errorCode ?? ""} ${x.error ?? "Recusado pela Meta"}`.trim().slice(0, 500) : null,
    });
  }
  return out;
}

/** Envios ainda "vivos": o lote já saiu e faz menos de `days` dias (leituras chegam depois). */
export function dueBroadcasts(
  slots: { at: string | null; broadcast_ids?: string[] }[] | null | undefined,
  allIds: string[],
  now: Date,
  days = 7,
): string[] {
  const minIso = new Date(now.getTime() - days * 86_400_000).toISOString();
  const nowIso = now.toISOString();
  if (!Array.isArray(slots) || !slots.some((s) => s?.at)) return allIds;
  const ids = new Set<string>();
  for (const s of slots) {
    if (!s?.at || s.at > nowIso || s.at < minIso) continue;
    for (const b of s.broadcast_ids ?? []) ids.add(b);
  }
  return [...ids];
}

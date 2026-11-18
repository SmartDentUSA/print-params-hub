// Regras de números do Histórico da Central de Campanhas (WhatsApp Oficial e Grupos de WhatsApp).

export type ZernioSummary = Partial<Record<"pending" | "sent" | "delivered" | "read" | "failed" | "skipped", number>>;

/** Números reais do WhatsApp Oficial a partir do resumo da Zernio (soma de todos os lotes). */
export function waOfficialCounts(summary: ZernioSummary | null | undefined) {
  const n = (k: keyof ZernioSummary) => Number(summary?.[k] ?? 0) || 0;
  return {
    sent: n("sent") + n("delivered") + n("read"), // tudo que a Meta aceitou
    delivered: n("delivered") + n("read"),
    read: n("read"),
    failed: n("failed"),
    queued: n("pending"),
  };
}

/**
 * Um disparo registrado em `campaigns` e também em `campaign_sessions` aparece uma vez só (fica a sessão):
 * WhatsApp Oficial liga pela `results.campaign_id`; SMS cria as duas linhas com o mesmo nome e canal em poucos minutos.
 */
const MIRROR_WINDOW_MS = 10 * 60_000;
export function dropMirroredCampaigns<T extends { id: string; name?: string | null; channel?: string | null; created_at?: string | null }>(
  campaigns: T[], sessions: { name?: string | null; channel?: string | null; created_at?: string | null; results?: any }[],
): T[] {
  const linked = new Set(sessions.map((s) => s.results?.campaign_id).filter(Boolean));
  const time = (v?: string | null) => (v ? new Date(v).getTime() : NaN);
  return campaigns.filter((c) => {
    if (linked.has(c.id)) return false;
    return !sessions.some((s) => s.channel && s.channel === c.channel && (s.name ?? "").trim() === (c.name ?? "").trim()
      && Math.abs(time(s.created_at) - time(c.created_at)) <= MIRROR_WINDOW_MS);
  });
}

export type WaGroupStats = { groups: number; total: number; sent: number; pending: number; failed: number; skipped: number };

/** Status exibido para uma campanha de grupos, conforme a fila real de mensagens. */
export function waGroupStatus(campaignStatus: string | null | undefined, s: WaGroupStats | undefined): string {
  const st = campaignStatus ?? "";
  if (st === "disabled") return "cancelled";
  if (st === "paused") return "paused";
  // Campanha em erro não é mais processada: o que ficou na fila não sai.
  if (st === "error") return s && s.sent > 0 ? "completed_with_errors" : "failed";
  if (s && s.pending > 0) return s.sent > 0 ? "running" : "queued";
  if (st === "active") return "running";
  if (!s || s.sent === 0) return st === "finished" && s && s.total === s.skipped ? "completed" : "failed";
  return s.failed > 0 ? "completed_with_errors" : "completed";
}

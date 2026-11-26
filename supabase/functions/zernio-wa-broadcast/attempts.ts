// Tentativas de disparo do WhatsApp Oficial que falham antes de criar a campanha passam a ficar no
// histórico (campaign_sessions status 'failed' + motivo), para nunca sumirem sem rastro.

export type PendingAttempt = {
  name: string;
  description?: string | null;
  userId: string;
  leadIds: string[];
  accountId: string;
  templateName: string;
  language: string;
  leadFilters?: Record<string, unknown> | null;
  segmentName?: string | null;
  eventId?: string | null;
  /** Linha de campaigns já criada nesta tentativa (falha entre criar a campanha e a sessão). */
  campaignRowId?: string | null;
};

/** 401/403 = sem permissão; 409 = campanha já enviada (não é nova tentativa). */
export function shouldRecordFailure(status: number): boolean {
  return status >= 400 && ![401, 403, 409].includes(status);
}

export function failedAttemptSession(a: PendingAttempt, error: string, now: Date) {
  const ids = a.leadIds.filter((x) => typeof x === 'string');
  return {
    name: a.name.slice(0, 300),
    description: a.description ?? null,
    channel: 'whatsapp_oficial',
    event_id: a.eventId ?? null,
    status: 'failed',
    lead_ids: ids,
    lead_count: ids.length,
    lead_filters: a.leadFilters ?? null,
    sent_count: 0,
    failed_count: 0,
    started_at: now.toISOString(),
    completed_at: now.toISOString(),
    created_by: a.userId,
    results: {
      provider: 'zernio_cloud_api', account_id: a.accountId, template: a.templateName, language: a.language,
      audience_snapshot: a.leadFilters != null, segment_name: a.segmentName ?? null,
      error: (error || 'Erro desconhecido').slice(0, 1000), attempt_failed: true,
      campaign_id: a.campaignRowId ?? null,
    },
  };
}

// deno-lint-ignore no-explicit-any
export async function recordFailedAttempt(admin: any, a: PendingAttempt, error: string, now = new Date()) {
  try {
    const row = failedAttemptSession(a, error, now);
    if (a.campaignRowId) {
      await admin.from('campaigns').update({ status: 'failed', completed_at: row.completed_at }).eq('id', a.campaignRowId);
    }
    const { error: insErr } = await admin.from('campaign_sessions').insert(row);
    if (insErr) console.error('[zernio-wa-broadcast] não registrou a tentativa com erro', insErr);
  } catch (e) {
    console.error('[zernio-wa-broadcast] não registrou a tentativa com erro', e);
  }
}

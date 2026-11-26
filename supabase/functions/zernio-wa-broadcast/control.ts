import { pushIntoWindow } from './plan.ts';

export type ControlAction = 'pause' | 'resume' | 'cancel';
export const CONTROL_STATES = ['paused', 'cancelled', 'pausing', 'resuming', 'cancelling'];
export function allowedControl(status: string, action: ControlAction): boolean {
  if (action === 'resume') return ['paused', 'resuming'].includes(status);
  if (action === 'cancel') return ['queued', 'scheduled', 'running', 'paused', 'pausing', 'resuming', 'cancelling'].includes(status);
  return ['queued', 'scheduled', 'running', 'pausing', 'resuming'].includes(status);
}

/** Fail closed on incomplete provider pages or ambiguous delivery evidence. */
export function pendingContacts(page: any): { contactId: string; phone: string }[] {
  const rows = page?.recipients;
  if (!Array.isArray(rows) || page.pagination?.hasMore || Number(page.pagination?.total ?? rows.length) !== rows.length || rows.length > 200)
    throw new Error('Não foi possível conferir todos os destinatários; retomada bloqueada por segurança.');
  return rows.filter((r: any) => r.status === 'pending' && !r.sentAt && !r.messageId).map((r: any) => {
    if (!r.contactId || !r.platformIdentifier) throw new Error('Destinatário pendente sem identificação segura.');
    return { contactId: String(r.contactId), phone: String(r.platformIdentifier).replace(/\D/g, '') };
  });
}

/** Whole-day shift preserves original hourly/day batches and the São Paulo window. */
export function resumeShift(originalDates: string[], now: Date, lastSent: string | null, dailyCap: boolean): number {
  const dates = originalDates.map((s) => Date.parse(s)).filter(Number.isFinite);
  if (!dates.length) throw new Error('Horários originais não disponíveis; retomada bloqueada.');
  const earliest = Math.min(...dates);
  const minimum = Math.max(now.getTime() + 5 * 60_000, dailyCap && lastSent ? Date.parse(lastSent) + 86_400_000 : 0);
  return Math.max(0, Math.ceil((minimum - earliest) / 86_400_000)) * 86_400_000;
}

type Item = { id: string; broadcast: any; contacts: { contactId: string; phone: string }[]; at: string; replacement?: string; done?: boolean };
type State = { action?: ControlAction; processed?: string[]; items?: Item[]; shift?: number; audit?: { action: string; at: string; user: string }[] };

export async function controlCampaign(db: any, z: (path: string, init?: RequestInit) => Promise<any>, sessionId: string, action: ControlAction, userId: string) {
  const token = crypto.randomUUID();
  const { data: locked, error: lockError } = await db.rpc('fn_claim_wa_campaign_control', { p_session: sessionId, p_token: token });
  if (lockError) throw lockError;
  if (!locked) throw new Error('A campanha está sendo atualizada. Aguarde alguns segundos e tente novamente.');
  try {
    const { data: session, error: sessionError } = await db.from('campaign_sessions').select('id,name,channel,status,results').eq('id', sessionId).single();
    if (sessionError) throw sessionError;
    if (session.channel !== 'whatsapp_oficial' || !allowedControl(session.status, action)) throw new Error('Esta ação não está disponível para o estado atual da campanha.');
    const { data: control } = await db.from('wa_official_campaign_control').select('state').eq('session_id', sessionId).single();
    let state: State = control?.state ?? {};
    const r = session.results ?? {};
    const ids: string[] = r.broadcast_ids ?? (r.broadcast_id ? [r.broadcast_id] : []);
    if (!ids.length) throw new Error('Nenhum disparo vinculado à campanha.');
    const transitional = action === 'pause' ? 'pausing' : action === 'resume' ? 'resuming' : 'cancelling';
    if (state.action !== action || session.status !== transitional) {
      state = { items: action === 'resume' || action === 'cancel' ? state.items ?? [] : [], processed: [], action,
        audit: [...(state.audit ?? []).slice(-49), { action, at: new Date().toISOString(), user: userId }] };
    }
    const save = async () => {
      const { error } = await db.from('wa_official_campaign_control').update({ state }).eq('session_id', sessionId).eq('lock_token', token);
      if (error) throw error;
    };
    const setStatus = async (status: string) => {
      const { error } = await db.from('campaign_sessions').update({ status }).eq('id', sessionId);
      if (error) throw error;
      // Existing campaign constraint uses Portuguese states; explicit control status remains in metadata.
      if (r.campaign_id) {
        const { data: camp } = await db.from('campaigns').select('metadata').eq('id', r.campaign_id).single();
        const { error: mirrorError } = await db.from('campaigns').update({
          status: status === 'cancelled' ? 'cancelada' : status === 'scheduled' ? 'scheduled' : 'agendada',
          metadata: { ...(camp?.metadata ?? {}), control_status: status },
        }).eq('id', r.campaign_id);
        if (mirrorError) throw mirrorError;
      }
    };
    await save();
    await setStatus(transitional);
    if (action !== 'resume') {
      const processed = new Set(state.processed ?? []);
      for (const bid of ids.filter((id) => !processed.has(id)).slice(0, 2)) {
        const details = await z(`/broadcasts/${encodeURIComponent(bid)}`);
        const b = details.broadcast;
        if (!b) throw new Error('A Zernio não confirmou o estado do disparo.');
        if (['scheduled', 'sending'].includes(b.status)) {
          await z(`/broadcasts/${encodeURIComponent(bid)}/cancel`, { method: 'POST', body: '{}' });
          const stopped = (await z(`/broadcasts/${encodeURIComponent(bid)}`)).broadcast;
          if (stopped?.status !== 'cancelled' && stopped?.status !== 'completed') throw new Error('A Zernio ainda não confirmou a interrupção.');
        }
        if (action === 'cancel' && b.status === 'draft') await z(`/broadcasts/${encodeURIComponent(bid)}`, { method: 'DELETE' });
        if (action === 'pause' && !r.retired_broadcast_ids?.includes(bid) && ['draft', 'scheduled', 'sending', 'cancelled'].includes(b.status)) {
          const contacts = pendingContacts(await z(`/broadcasts/${encodeURIComponent(bid)}/recipients?limit=200`));
          if (contacts.length && !(state.items ?? []).some((i) => i.id === bid)) {
            if (!b.template?.name || !b.template?.language) throw new Error('Modelo original não disponível para uma retomada segura.');
            state.items = [...(state.items ?? []), { id: bid, broadcast: b, contacts, at: b.scheduledAt ?? b.startedAt ?? new Date().toISOString() }];
          }
        }
        processed.add(bid); state.processed = [...processed]; await save();
      }
      const done = ids.every((id) => processed.has(id));
      if (done) {
        if (action === 'cancel') {
          const { error } = await db.from('campaign_send_log').update({ status: 'cancelled' }).eq('campaign_id', sessionId).in('status', ['scheduled', 'paused', 'queued']);
          if (error) throw error;
        } else {
          const { error } = await db.from('campaign_send_log').update({ status: 'paused' }).eq('campaign_id', sessionId).eq('status', 'scheduled');
          if (error) throw error;
        }
        await setStatus(action === 'pause' ? 'paused' : 'cancelled');
      }
      return { ok: true, done, status: done ? action === 'pause' ? 'paused' : 'cancelled' : transitional };
    }

    const items = state.items ?? [];
    if (!items.length) throw new Error('Não há destinatários pendentes para retomar; a campanha pode ser cancelada.');
    if (state.shift == null) {
      const { data: last } = await db.from('campaign_send_log').select('sent_at').eq('campaign_id', sessionId).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(1);
      state.shift = resumeShift(items.map((i) => i.at), new Date(), last?.[0]?.sent_at ?? null, !!r.per_day);
      await save();
    }
    for (const item of items.filter((i) => !i.done).slice(0, 1)) {
      const at = pushIntoWindow(new Date(Date.parse(item.at) + (state.shift ?? 0)), '07:30', '19:00').toISOString();
      if (Date.parse(at) <= Date.now() + 60_000) throw new Error('O horário da retomada expirou. Cancele ou tente a retomada novamente mais tarde.');
      if (!item.replacement) {
        const original = (await z(`/broadcasts/${encodeURIComponent(item.id)}`)).broadcast;
        if (!['cancelled', 'draft'].includes(original?.status)) throw new Error('Disparo original ainda pode enviar; retomada bloqueada.');
        const current = pendingContacts(await z(`/broadcasts/${encodeURIComponent(item.id)}/recipients?limit=200`));
        const pending = new Set(current.map((c) => c.contactId));
        item.contacts = item.contacts.filter((c) => pending.has(c.contactId));
        if (!item.contacts.length) { item.done = true; await save(); continue; }
        let profileId = item.broadcast.profileId ?? r.profile_id;
        if (!profileId) {
          const accounts = await z('/accounts');
          const account = (accounts.accounts ?? accounts.data ?? []).find((a: any) => String(a._id ?? a.id) === String(r.account_id));
          const profile = account?.profileId ?? account?.profile;
          profileId = typeof profile === 'object' ? profile?._id ?? profile?.id : profile;
        }
        if (!profileId) throw new Error('Conta original não disponível para retomada.');
        const created = await z('/broadcasts', { method: 'POST', body: JSON.stringify({
          profileId, accountId: r.account_id, platform: 'whatsapp', name: `${session.name} · retomada`, template: item.broadcast.template,
        }) });
        const replacement = created?.broadcast?.id;
        if (!replacement) throw new Error('A Zernio não confirmou o novo lote.');
        item.replacement = String(replacement); await save(); // Persist draft before any schedule; timeout retries cannot resend.
      }
      const bid = item.replacement;
      if (!bid) throw new Error('Lote de retomada ausente.');
      const b = (await z(`/broadcasts/${encodeURIComponent(bid)}`)).broadcast;
      if (b?.status === 'draft') {
        if (r.header_media_url) {
          const echoed = JSON.stringify(b.template ?? {});
          if (!echoed.includes(r.header_media_url)) throw new Error('A Zernio não preservou a imagem original; retomada bloqueada.');
        }
        const existing = await z(`/broadcasts/${encodeURIComponent(bid)}/recipients?limit=200`);
        if (!existing.recipients?.length) await z(`/broadcasts/${encodeURIComponent(bid)}/recipients`, { method: 'POST', body: JSON.stringify({ contactIds: item.contacts.map((c) => c.contactId) }) });
        const checked = pendingContacts(await z(`/broadcasts/${encodeURIComponent(bid)}/recipients?limit=200`));
        const wanted = new Set(item.contacts.map((c) => c.contactId));
        if (checked.length !== wanted.size || checked.some((c) => !wanted.has(c.contactId))) throw new Error('O público do lote não corresponde aos pendentes originais.');
      } else if (!['scheduled', 'sending', 'completed'].includes(b?.status)) throw new Error('Estado inesperado no lote de retomada.');

      // Attach replacement before scheduling, including automatic button attribution and historical logs.
      const { data: fresh } = await db.from('campaign_sessions').select('results').eq('id', sessionId).single();
      const results = fresh?.results ?? r;
      const allIds = [...new Set([...(results.broadcast_ids ?? ids), bid])];
      const retired = [...new Set([...(results.retired_broadcast_ids ?? []), item.id])];
      const slots = [...(results.slots ?? []).filter((sl: any) => !sl.broadcast_ids?.includes(bid)), { at, broadcast_ids: [bid], leads: item.contacts.length }];
      const { error: resultsError } = await db.from('campaign_sessions').update({ results: { ...results, broadcast_ids: allIds, retired_broadcast_ids: retired, slots } }).eq('id', sessionId);
      if (resultsError) throw resultsError;
      const { error: logError } = await db.from('campaign_send_log').update({ provider_message_id: bid, scheduled_at: at, status: 'scheduled' })
        .eq('campaign_id', sessionId).eq('provider_message_id', item.id).in('status', ['paused', 'scheduled']).in('telefone', item.contacts.map((c) => c.phone));
      if (logError) throw logError;
      const { error: rulesError } = await db.from('wa_button_reply_rules').update({ broadcast_ids: allIds }).eq('session_id', sessionId);
      if (rulesError) throw rulesError;
      if (b.status === 'draft') await z(`/broadcasts/${encodeURIComponent(bid)}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt: at }) });
      item.done = true; await save();
    }
    const done = items.every((i) => i.done);
    if (done) await setStatus('scheduled');
    return { ok: true, done, status: done ? 'scheduled' : 'resuming' };
  } finally {
    await db.from('wa_official_campaign_control').update({ lock_token: null, lock_until: null }).eq('session_id', sessionId).eq('lock_token', token);
  }
}
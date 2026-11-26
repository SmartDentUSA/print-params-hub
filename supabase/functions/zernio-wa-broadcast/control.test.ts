import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedControl, controlCampaign, pendingContacts, resumeShift } from './control.ts';

test('pausar só campanhas ativas; retomar só pausadas; canceladas não retomam', () => {
  assert.equal(allowedControl('running', 'pause'), true);
  assert.equal(allowedControl('paused', 'resume'), true);
  assert.equal(allowedControl('completed', 'pause'), false);
  assert.equal(allowedControl('cancelled', 'resume'), false);
});
test('cancelamento é permitido nas campanhas ativas e pausadas, não nas concluídas', () => {
  assert.equal(allowedControl('scheduled', 'cancel'), true);
  assert.equal(allowedControl('paused', 'cancel'), true);
  assert.equal(allowedControl('completed', 'cancel'), false);
});
test('retomada exclui enviados, entregues, lidos, falhas e pendentes com evidência de envio', () => {
  const recipients = [
    { contactId: '1', platformIdentifier: '+5516999990001', status: 'pending' },
    ...['sent', 'delivered', 'read', 'failed'].map((status) => ({ contactId: status, platformIdentifier: '+5516999990002', status })),
    { contactId: 'ambiguous', platformIdentifier: '+5516999990003', status: 'pending', messageId: 'wamid.test' },
  ];
  assert.deepEqual(pendingContacts({ recipients, pagination: { total: 6, hasMore: false } }), [{ contactId: '1', phone: '5516999990001' }]);
});
test('retomada bloqueia páginas incompletas e contatos sem identidade', () => {
  assert.throws(() => pendingContacts({ recipients: [], pagination: { total: 200, hasMore: true } }));
  assert.throws(() => pendingContacts({ recipients: [{ status: 'pending' }] }));
});
test('retomada mantém os horários dos lotes e espera 24h do último envio quando há limite diário', () => {
  const original = ['2026-11-26T13:52:00Z', '2026-11-27T13:52:00Z'];
  const shift = resumeShift(original, new Date('2026-11-26T22:00:00Z'), '2026-11-26T13:52:24Z', true);
  assert.equal(shift, 2 * 86_400_000);
  assert.equal(new Date(Date.parse(original[0]) + shift).toISOString(), '2026-11-28T13:52:00.000Z');
  assert.equal(Date.parse(original[1]) - Date.parse(original[0]), 86_400_000);
});

function fixture() {
  const sessionId = 'test-session';
  const tables: Record<string, any[]> = {
    campaign_sessions: [{ id: sessionId, name: 'Teste', channel: 'whatsapp_oficial', status: 'scheduled', results: { broadcast_ids: ['original'], campaign_id: 'campaign', account_id: 'account', profile_id: 'profile', per_day: 200, slots: [] } }],
    campaigns: [{ id: 'campaign', metadata: {} }],
    wa_official_campaign_control: [{ session_id: sessionId, state: {} }],
    campaign_send_log: [{ campaign_id: sessionId, provider_message_id: 'original', telefone: '5516999990001', status: 'scheduled' }, { campaign_id: sessionId, provider_message_id: 'original', telefone: '5516999990002', status: 'sent', sent_at: new Date().toISOString() }],
    wa_button_reply_rules: [{ session_id: sessionId, broadcast_ids: ['original'] }],
  };
  let locked = false;
  const db = {
    async rpc() { if (locked) return { data: false }; locked = true; return { data: true }; },
    from(table: string) {
      const filters: ((r: any) => boolean)[] = [];
      let update: any = null;
      const result = () => {
        const rows = tables[table].filter((r) => filters.every((f) => f(r)));
        if (update) for (const r of rows) Object.assign(r, structuredClone(update));
        if (table === 'wa_official_campaign_control' && update?.lock_token === null) locked = false;
        return { data: rows };
      };
      const q: any = {
        select: () => q, update: (u: any) => { update = u; return q; },
        eq: (k: string, v: any) => { filters.push((r) => r[k] === v || k === 'lock_token'); return q; },
        in: (k: string, values: any[]) => { filters.push((r) => values.includes(r[k])); return q; },
        not: (k: string) => { filters.push((r) => r[k] != null); return q; },
        order: () => q, limit: () => q,
        single: async () => ({ data: result().data[0] }),
        then: (resolve: any) => Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  };
  const broadcasts: Record<string, any> = { original: { id: 'original', status: 'scheduled', template: { name: 'test', language: 'pt_BR' }, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() } };
  const recipients: Record<string, any[]> = { original: [{ contactId: 'pending', platformIdentifier: '+5516999990001', status: 'pending' }, { contactId: 'sent', platformIdentifier: '+5516999990002', status: 'sent', messageId: 'wamid.sent' }] };
  const calls: string[] = [];
  const z = async (path: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/broadcasts') { broadcasts.replacement = { id: 'replacement', status: 'draft', template: JSON.parse(String(init?.body)).template }; recipients.replacement = []; return { broadcast: broadcasts.replacement }; }
    const [, , id, endpoint] = path.split('/');
    if (endpoint === 'cancel') { broadcasts[id].status = 'cancelled'; return { success: true }; }
    if (endpoint === 'schedule') { broadcasts[id].status = 'scheduled'; return { success: true }; }
    if (endpoint?.startsWith('recipients')) {
      if (init?.method === 'POST') recipients[id] = JSON.parse(String(init.body)).contactIds.map((contactId: string) => ({ contactId, platformIdentifier: '+5516999990001', status: 'pending' }));
      return { recipients: recipients[id], pagination: { total: recipients[id].length, hasMore: false } };
    }
    return { broadcast: broadcasts[id] };
  };
  return { sessionId, tables, db, z, calls, recipients };
}

test('fluxo completo: pausa no provedor, retoma só o pendente, mantém enviado e vincula botões', async () => {
  const f = fixture();
  const pause = await controlCampaign(f.db, f.z, f.sessionId, 'pause', 'admin');
  assert.equal(pause.status, 'paused');
  assert.ok(f.calls.includes('POST /broadcasts/original/cancel'));
  assert.equal(f.tables.campaign_send_log[0].status, 'paused');
  assert.equal(f.tables.campaign_send_log[1].status, 'sent');
  const resume = await controlCampaign(f.db, f.z, f.sessionId, 'resume', 'admin');
  assert.equal(resume.status, 'scheduled');
  assert.deepEqual(f.recipients.replacement.map((r) => r.contactId), ['pending']);
  assert.equal(f.tables.campaign_send_log[0].provider_message_id, 'replacement');
  assert.equal(f.tables.campaign_send_log[1].provider_message_id, 'original');
  assert.ok(f.tables.wa_button_reply_rules[0].broadcast_ids.includes('replacement'));
  assert.equal(f.calls.filter((c) => c === 'POST /broadcasts/replacement/schedule').length, 1);
  await assert.rejects(() => controlCampaign(f.db, f.z, f.sessionId, 'resume', 'admin'));
});

test('cancelamento definitivo preserva os envios anteriores e impede retomar', async () => {
  const f = fixture();
  const cancelled = await controlCampaign(f.db, f.z, f.sessionId, 'cancel', 'admin');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(f.tables.campaign_send_log[0].status, 'cancelled');
  assert.equal(f.tables.campaign_send_log[1].status, 'sent');
  await assert.rejects(() => controlCampaign(f.db, f.z, f.sessionId, 'resume', 'admin'));
});
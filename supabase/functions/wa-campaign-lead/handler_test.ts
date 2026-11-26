import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processCampaignReply } from './handler.ts';

const JOB = '11111111-1111-1111-1111-111111111111';
const PHONE = '5516998765432';

function fakeDb() {
  const tables: Record<string, any[]> = {
    whatsapp_inbox: [{ id: 'original', phone: PHONE, direction: 'inbound', instance_name: 'zernio:account', is_group: false,
      message_text: 'Falar com consultor', created_at: new Date().toISOString(), raw_payload: { conversation: { id: 'conversation' }, metadata: { buttonPayload: 'Falar com consultor' } } }],
    campaign_send_log: [{ campaign_id: 'session', source_campaign_id: 'campaign', lead_id: 'lead', nome: 'Cliente Real', telefone: PHONE,
      provider: 'zernio_cloud_api', status: 'sent', sent_at: '2026-01-01T00:00:00Z' }],
    campaign_sessions: [{ id: 'session', results: { account_id: 'account' } }],
    campaigns: [{ id: 'campaign', nome: 'BlackFriday 2026', metadata: {} }],
    lia_attendances: [{ id: 'lead', nome: 'Cliente Real', email: 'cliente@dominio.com', telefone_normalized: `+${PHONE}`, merged_into: null }],
    smartops_forms: [{ id: 'standard', name: '# - [CHATSITE] - Oportunidade', active: true, capture_buttons: [
      { label: 'Resinas' }, { label: 'Scanner intraoral', product_name: 'Scanner intraoral INO200', product_catalog_id: 'catalog-scanner' },
    ] }],
    wa_campaign_lead_jobs: [], lead_activity_log: [],
  };
  const db = {
    tables,
    from(table: string) {
      const filters: ((r: any) => boolean)[] = [];
      let update: any = null, upsert: any = null, insert: any = null, max = Infinity, single = false;
      const q: any = {
        select: () => q,
        eq: (key: string, value: any) => { filters.push((r) => r[key] === value); return q; },
        is: (key: string, value: any) => { filters.push((r) => (r[key] ?? null) === value); return q; },
        in: (key: string, values: any[]) => { filters.push((r) => values.includes(r[key])); return q; },
        lte: (key: string, value: any) => { filters.push((r) => r[key] <= value); return q; },
        gte: (key: string, value: any) => { filters.push((r) => r[key] >= value); return q; },
        order: () => q,
        limit: (n: number) => { max = n; return q; },
        update: (v: any) => { update = v; return q; },
        upsert: (v: any) => { upsert = v; return q; },
        insert: (v: any) => { insert = v; return q; },
        maybeSingle: () => { single = true; return q; },
        single: () => { single = true; return q; },
        then(resolve: any, reject: any) {
          if (upsert && !tables[table].some((r) => r.slug === upsert.slug)) tables[table].push({ id: 'system-form', ...upsert });
          if (insert) tables[table].push({ id: 'activity', ...insert });
          const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, max);
          if (update) rows.forEach((r) => Object.assign(r, update));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
    rpc(name: string, args: any) {
      if (name === 'fn_team_member_by_phone') return Promise.resolve({ data: null, error: null });
      if (name === 'fn_claim_wa_campaign_lead') {
        if (tables.wa_campaign_lead_jobs.length) return Promise.resolve({ data: [], error: null });
        const job = { id: JOB, status: 'menu_sending', claim_token: 'claim', campaign_id: args.p_campaign_id, phone: args.p_phone, inbox_id: args.p_inbox_id, form_id: args.p_form_id };
        tables.wa_campaign_lead_jobs.push(job);
        return Promise.resolve({ data: [job], error: null });
      }
      if (name === 'fn_claim_wa_category') {
        const job = tables.wa_campaign_lead_jobs.find((j) => j.id === args.p_job_id && j.status === 'awaiting_category');
        if (!job) return Promise.resolve({ data: [], error: null });
        Object.assign(job, { status: 'processing', selected_category: job.categories[args.p_category_index], selection_inbox_id: args.p_inbox_id });
        return Promise.resolve({ data: [job], error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  return db;
}

Deno.test('WhatsApp: clique abre categorias sem criar lead; escolha envia produto e texto à ingestão oficial', async () => {
  const db = fakeDb();
  const payloads: Record<string, any>[] = [], menus: any[] = [];
  const ingest = async (p: any) => { payloads.push(p); return { lead_id: 'lead' }; };
  const send = async (_conv: string, _account: string, menu: any) => { menus.push(menu); return 'wamid-menu'; };
  const first = await processCampaignReply(db, 'original', false, ingest, send);
  assert('awaiting_category' in first && first.awaiting_category);
  assertEquals(payloads.length, 0);
  assertEquals(menus.length, 1);
  assertEquals(db.tables.wa_campaign_lead_jobs[0].status, 'awaiting_category');
  // A repeated original click must not send a second menu or create a deal.
  await processCampaignReply(db, 'original', false, ingest, send);
  assertEquals(menus.length, 1);
  assertEquals(payloads.length, 0);

  db.tables.whatsapp_inbox.push({ id: 'selection', phone: PHONE, direction: 'inbound', instance_name: 'zernio:account', created_at: new Date().toISOString(),
    message_text: 'Scanner intraoral', raw_payload: { metadata: { interactiveId: `wa-interest:${JOB}:1` }, conversation: { id: 'conversation' } } });
  const selected = await processCampaignReply(db, 'selection', false, ingest, send);
  assert('ingested' in selected && selected.ingested);
  assertEquals(payloads.length, 1);
  assertEquals(payloads[0].produto_interesse, 'Scanner intraoral INO200');
  assertEquals(payloads[0].product_catalog_id, 'catalog-scanner');
  assertEquals(payloads[0].phone, `+${PHONE}`);
  assertEquals(payloads[0].form_name, '[WHTASATIVO] - BlackFriday 2026');
  assertEquals(payloads[0].form_responses.find((r: any) => r.label === 'Mensagem recebida (WhatsApp Oficial)').value, 'Falar com consultor');
  assertEquals(payloads[0].force_new_deal, undefined);
  assertEquals(payloads[0].event_consultant_team_member_id, undefined);
  assertEquals(db.tables.wa_campaign_lead_jobs[0].status, 'ingested');
  await processCampaignReply(db, 'selection', false, ingest, send);
  assertEquals(payloads.length, 1);
});

Deno.test('WhatsApp: conversão histórica já persistida recupera confirmação sem repetir ingestão', async () => {
  const db = fakeDb();
  db.tables.whatsapp_inbox[0].created_at = '2026-01-01T00:01:00Z';
  await processCampaignReply(db, 'original', false, async () => ({}), async () => null);
  const job = db.tables.wa_campaign_lead_jobs[0];
  Object.assign(job, { status: 'failed' });
  Object.assign(job.context, { historical_authorized: true, historical_until: new Date().toISOString() });
  db.tables.lia_attendances[0].raw_payload = { form_submissions: [{
    form_name: '[WHTASATIVO] - BlackFriday 2026',
    conversion_key: `form:[WHTASATIVO] - BlackFriday 2026:${job.context.submission_id}`,
  }] };
  let calls = 0;
  const result = await processCampaignReply(db, 'original', false, async () => { calls++; return { lead_id: 'lead' }; }, async () => null);
  assert('ingested' in result && result.ingested);
  assertEquals(calls, 0);
  assertEquals(job.lead_id, 'lead');
  assertEquals(job.status, 'ingested');
  assertEquals(db.tables.lead_activity_log[0].event_data.produto_interesse, 'Identificar produto de interesse');
});

Deno.test('WhatsApp: outra conversão no histórico não impede cadastrar o interesse autorizado', async () => {
  const db = fakeDb();
  db.tables.whatsapp_inbox[0].created_at = '2026-01-01T00:01:00Z';
  await processCampaignReply(db, 'original', false, async () => ({}), async () => null);
  const job = db.tables.wa_campaign_lead_jobs[0];
  Object.assign(job.context, { historical_authorized: true, historical_until: new Date().toISOString() });
  db.tables.lia_attendances[0].raw_payload = { form_submissions: [{
    form_name: '[WHTASATIVO] - BlackFriday 2026', conversion_key: 'outra-conversao',
  }] };
  let calls = 0;
  await processCampaignReply(db, 'original', false, async () => { calls++; return { lead_id: 'lead' }; }, async () => null);
  assertEquals(calls, 1);
});

Deno.test('WhatsApp: histórico fora da janela fica aguardando, sem menu e sem CRM', async () => {
  const db = fakeDb();
  db.tables.whatsapp_inbox[0].created_at = '2026-01-01T00:01:00Z';
  let calls = 0;
  const result = await processCampaignReply(db, 'original', false, async () => { calls++; return {}; }, async () => { calls++; return null; });
  assert('waiting_window' in result && result.waiting_window);
  assertEquals(calls, 0);
  assertEquals(db.tables.wa_campaign_lead_jobs[0].status, 'waiting_window');
});

Deno.test('WhatsApp: formulário vinculado fornece categorias sem substituir origem da campanha', async () => {
  const db = fakeDb();
  db.tables.campaigns[0].metadata = { button_replies: [{ label: 'Falar com consultor', form_id: 'linked' }] };
  db.tables.smartops_forms.push({ id: 'linked', name: 'Origem do formulário', form_purpose: 'sdr_captacao', capture_buttons: [{ label: 'Resinas' }] });
  const result = await processCampaignReply(db, 'original', true, async () => ({}), async () => null);
  assert('origin' in result);
  assertEquals(result.origin, '[WHTASATIVO] - BlackFriday 2026');
});

Deno.test('WhatsApp: histórico autorizado entra sem categoria, preservando nota e Regra de Ouro, uma única vez', async () => {
  const db = fakeDb();
  const payloads: any[] = [];
  db.tables.whatsapp_inbox[0].created_at = '2026-01-01T00:01:00Z';
  await processCampaignReply(db, 'original', false, async () => ({}), async () => { throw new Error('não deve enviar menu'); });
  Object.assign(db.tables.wa_campaign_lead_jobs[0].context, { historical_authorized: true, historical_until: new Date().toISOString() });
  const ingest = async (p: any) => { payloads.push(p); return { lead_id: 'lead' }; };
  await processCampaignReply(db, 'original', false, ingest, async () => { throw new Error('não deve enviar menu'); });
  assertEquals(payloads.length, 1);
  assertEquals(payloads[0].produto_interesse, 'Identificar produto de interesse');
  assertEquals(payloads[0].form_name, '[WHTASATIVO] - BlackFriday 2026');
  assertEquals(payloads[0].form_responses.find((r: any) => r.label === 'Mensagem recebida (WhatsApp Oficial)').value, 'Falar com consultor');
  assertEquals(payloads[0].force_new_deal, undefined);
  assertEquals(payloads[0].event_consultant_team_member_id, undefined);
  assertEquals(payloads[0].raw_payload.whatsapp_campaign_response.selected_at, null);
  await processCampaignReply(db, 'original', false, ingest, async () => null);
  assertEquals(payloads.length, 1);
});
// zernio-whatsapp-inbox — recebe mensagens WhatsApp (Cloud API via Zernio) e grava em whatsapp_inbox.
// POST webhook (assinado) | POST {action:"register"} (admin) cria o endpoint na Zernio | {action:"status"} lista endpoints.
// Não envia nada e não dispara automações: apenas ingestão. Evolution/WaLeads continuam intocados.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ZERNIO_BASE = 'https://zernio.com/api/v1';
const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zernio-whatsapp-inbox`;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function hmacHex(body: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await req.text();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const secret = Deno.env.get('ZERNIO_WA_WEBHOOK_SECRET');
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }

  // ── Ações administrativas ──
  if (payload?.action === 'register' || payload?.action === 'status') {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin').maybeSingle();
    if (!role) return json({ error: 'forbidden' }, 403);
    const apiKey = Deno.env.get('ZERNIO_API_KEY');
    if (!apiKey || !secret) return json({ error: 'missing ZERNIO_API_KEY or ZERNIO_WA_WEBHOOK_SECRET' }, 500);
    const h = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const list = await fetch(`${ZERNIO_BASE}/webhooks/settings`, { headers: h });
    const listBody = await list.text();
    if (payload.action === 'status') return json({ status: list.status, body: listBody });
    if (listBody.includes(FN_URL)) return json({ ok: true, already_registered: true });
    const r = await fetch(`${ZERNIO_BASE}/webhooks/settings`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ name: 'Sistema B — WhatsApp inbox', url: FN_URL, secret, events: ['message.received', 'message.sent'] }),
    });
    return json({ status: r.status, body: await r.text() }, r.ok ? 200 : 502);
  }

  // ── Webhook ──
  if (!secret) return json({ error: 'secret not configured' }, 500);
  const sigHeader = req.headers.get('x-zernio-signature') ?? '';
  const expected = await hmacHex(raw, secret);
  if (sigHeader.replace(/^sha256=/, '') !== expected) return json({ error: 'invalid signature' }, 401);

  const event = String(payload?.event ?? '');
  const msg = payload?.message ?? {};
  const account = payload?.account ?? {};
  const platform = String(msg.platform ?? account.platform ?? '').toLowerCase();
  if (!['message.received', 'message.sent'].includes(event) || platform !== 'whatsapp' || payload?.test) {
    return json({ ok: true, ignored: event || 'unknown' });
  }

  const accountId = String(account.accountId ?? account.id ?? '');
  const inbound = event === 'message.received';
  const conv = payload?.conversation ?? {};
  const contactPhone = digits(inbound ? (msg.sender?.phoneNumber ?? msg.sender?.id) : (conv.participantId ?? ''));
  if (!contactPhone) return json({ ok: true, ignored: 'no_phone' });
  const wamid = String(msg.platformMessageId ?? msg.id ?? payload.id);

  const { data: dup } = await supabase.from('whatsapp_inbox').select('id').eq('wa_message_id', wamid).maybeSingle();
  if (dup) return json({ ok: true, duplicate: true });

  // Membro da equipe dono do número (pelo telefone da conta Zernio)
  const accountPhone = digits(account.username ?? account.displayName ?? '');
  let teamMemberId: string | null = null;
  if (accountPhone.length >= 10) {
    const { data: tm } = await supabase.from('team_members').select('id').ilike('whatsapp_number', `%${accountPhone.slice(-10)}`).limit(1).maybeSingle();
    teamMemberId = tm?.id ?? null;
  }
  if (!teamMemberId) {
    const { data: tm } = await supabase.from('team_members').select('id').eq('id', 'a4b1f379-dba6-4fe6-b3f9-b52e13918335').maybeSingle();
    if (accountId === '6ad02193fb6593ea61a867f2') teamMemberId = tm?.id ?? null;
  }

  const phoneNorm = `+${contactPhone}`;
  const { data: lead } = await supabase.from('lia_attendances').select('id')
    .eq('telefone_normalized', phoneNorm).is('merged_into', null).order('created_at', { ascending: true }).limit(1).maybeSingle();

  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
  const { error } = await supabase.from('whatsapp_inbox').insert({
    created_at: msg.sentAt ?? payload.timestamp ?? new Date().toISOString(),
    phone: contactPhone,
    phone_normalized: phoneNorm,
    message_text: msg.text ?? null,
    media_url: att?.url ?? null,
    media_type: att?.type ?? null,
    direction: inbound ? 'inbound' : 'outbound',
    lead_id: lead?.id ?? null,
    matched_by: lead ? 'phone' : null,
    raw_payload: payload,
    instance_name: `zernio:${accountId}`,
    team_member_id: teamMemberId,
    wa_message_id: wamid,
    is_group: false,
    sender_name: inbound ? (msg.sender?.name ?? conv.participantName ?? null) : null,
    remote_jid: `${contactPhone}@s.whatsapp.net`,
  });
  if (error) { console.error('insert failed', error); return json({ error: error.message }, 500); }
  console.log(JSON.stringify({ event: 'zernio.wa.ingested', type: event, account: accountId, lead: lead?.id ?? null }));
  return json({ ok: true });
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { categoryMenu, campaignPhone, serviceWindowOpen } from '../_shared/wa-campaign-intent.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!url || !serviceKey || !apiKey) return json({ error: 'service not configured' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(url, serviceKey);
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json({ error: 'unauthorized' }, 401);
  const { data: admin, error: roleError } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (roleError || !admin) return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => null);
  const identity = campaignPhone(String(body?.phone ?? ''));
  if (!identity) return json({ error: 'invalid_phone' }, 400);

  const { data: messages, error: messagesError } = await db.from('whatsapp_inbox')
    .select('instance_name,raw_payload,direction,created_at')
    .in('phone', identity.variants)
    .order('created_at', { ascending: false }).limit(100);
  if (messagesError) return json({ error: messagesError.message }, 500);
  const latest = (messages ?? []).find((m: any) => String(m.instance_name).startsWith('zernio:')
    && (m.raw_payload?.conversation?.id || m.raw_payload?.message?.conversationId));
  if (!latest) return json({ error: 'official_conversation_not_found' }, 404);
  const lastInbound = (messages ?? []).find((m: any) => m.direction === 'inbound'
    && m.instance_name === latest.instance_name);
  if (!lastInbound || !serviceWindowOpen(lastInbound.created_at)) {
    return json({ error: 'service_window_closed', last_inbound_at: lastInbound?.created_at ?? null }, 409);
  }

  const { data: form, error: formError } = await db.from('smartops_forms').select('capture_buttons')
    .eq('name', '# - [CHATSITE] - Oportunidade').eq('active', true).maybeSingle();
  if (formError) return json({ error: formError.message }, 500);
  const categories = (Array.isArray(form?.capture_buttons) ? form.capture_buttons : [])
    .filter((c: any) => typeof c?.label === 'string' && c.label.trim());
  if (!categories.length) return json({ error: 'categories_unavailable' }, 500);

  const accountId = String(latest.instance_name).slice('zernio:'.length);
  const conversationId = String(latest.raw_payload?.conversation?.id ?? latest.raw_payload?.message?.conversationId);
  const response = await fetch(`https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, interactive: categoryMenu(crypto.randomUUID(), categories) }),
    signal: AbortSignal.timeout(30_000),
  });
  const responseBody = await response.text();
  if (!response.ok) return json({ error: 'provider_send_failed', status: response.status, details: responseBody.slice(0, 1000) }, response.status);
  let provider: any = null;
  try { provider = JSON.parse(responseBody); } catch { provider = { raw: responseBody.slice(0, 1000) }; }
  if (provider?.success === false) return json({ error: 'provider_send_failed', details: provider }, 502);
  return json({ ok: true, phone: identity.phone, message_id: provider?.data?.messageId ?? provider?.messageId ?? null });
});

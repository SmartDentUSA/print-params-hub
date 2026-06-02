// zernio-broadcast-dispatch — dispara broadcasts de Instagram Direct via Zernio API
// Fluxo: cria broadcast (draft) → adiciona recipients (contactIds) → POST /send
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';

function template(str: string, ctx: Record<string, any>): string {
  return (str ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => String(ctx?.[k] ?? ''));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ZERNIO_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  if (body?.broadcast_id) {
    return await dispatch(supabase, apiKey, body.broadcast_id);
  }

  // Cron mode: scheduled broadcasts
  const { data: scheduled } = await supabase
    .from('social_broadcasts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(5);

  const results: any[] = [];
  for (const b of scheduled ?? []) {
    const r = await dispatch(supabase, apiKey, b.id);
    results.push(await r.json().catch(() => ({})));
  }
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function dispatch(supabase: any, apiKey: string, broadcastId: string): Promise<Response> {
  const { data: b, error: bErr } = await supabase
    .from('social_broadcasts').select('*').eq('id', broadcastId).single();
  if (bErr || !b) {
    return new Response(JSON.stringify({ error: 'broadcast_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const seg: any = b.segment ?? {};
  const message: string = seg.message ?? '';
  const zernioAccountUuid: string | undefined = seg.zernio_account_id;
  if (!zernioAccountUuid) {
    await supabase.from('social_broadcasts').update({
      status: 'failed', segment: { ...seg, error: 'missing_zernio_account' },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'missing_zernio_account' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve a conta Zernio (UUID interno → IDs externos)
  const { data: acc } = await supabase
    .from('social_zernio_accounts')
    .select('zernio_account_id, zernio_profile_id, platform, handle')
    .eq('id', zernioAccountUuid).single();
  if (!acc) {
    await supabase.from('social_broadcasts').update({
      status: 'failed', segment: { ...seg, error: 'zernio_account_not_synced' },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'zernio_account_not_synced' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Defensive: legacy rows may have stored profile/account as JSON objects instead of ID strings.
  const extractId = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') {
      // Sometimes stored as a JSON-encoded object string
      const t = v.trim();
      if (t.startsWith('{')) {
        try { const p = JSON.parse(t); return p?._id ?? p?.id ?? ''; } catch { return v; }
      }
      return v;
    }
    if (typeof v === 'object') return v._id ?? v.id ?? '';
    return String(v);
  };
  const profileIdStr = extractId(acc.zernio_profile_id);
  const accountIdStr = extractId(acc.zernio_account_id);

  await supabase.from('social_broadcasts').update({ status: 'dispatching' }).eq('id', broadcastId);

  // Audiência: social_contacts filtrado por canal + tags + flags
  let q = supabase.from('social_contacts').select('ig_user_id, ig_username, tags, is_follower, subscribed')
    .eq('channel', acc.platform).limit(2000);
  if (seg.subscribed) q = q.eq('subscribed', true);
  if (seg.is_follower) q = q.eq('is_follower', true);
  if (Array.isArray(seg.tags) && seg.tags.length > 0) q = q.overlaps('tags', seg.tags);

  const { data: contacts, error: cErr } = await q;
  if (cErr) {
    await supabase.from('social_broadcasts').update({
      status: 'failed', segment: { ...seg, error: cErr.message },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: cErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const contactIds = (contacts ?? []).map((c: any) => c.ig_user_id).filter(Boolean);
  if (contactIds.length === 0) {
    await supabase.from('social_broadcasts').update({
      status: 'failed', total_sent: 0,
      segment: { ...seg, error: 'no_recipients', total_targets: 0 },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'no_recipients' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Aplica template ({{name}}, {{first_name}}) — Zernio não substitui, então enviamos texto cru
  // (templates por contato exigiriam DMs individuais; usamos o nome do primeiro como amostra).
  const sample = contacts![0];
  const firstName = (sample?.ig_username ?? '').split(' ')[0] ?? '';
  const finalText = template(message, { first_name: firstName, name: sample?.ig_username ?? '' });

  // 1) Cria draft
  const createRes = await fetch(`${ZERNIO_BASE}/broadcasts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId: acc.zernio_profile_id,
      accountId: acc.zernio_account_id,
      platform: acc.platform,
      name: b.name?.slice(0, 80) || `Broadcast ${broadcastId.slice(0, 6)}`,
      message: { text: finalText },
    }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createJson?.broadcast?.id) {
    await supabase.from('social_broadcasts').update({
      status: 'failed',
      segment: { ...seg, error: `zernio_create_failed: ${JSON.stringify(createJson)}` },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'zernio_create_failed', details: createJson }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const zernioId = createJson.broadcast.id as string;

  // 2) Recipients (em lotes de 500)
  let added = 0;
  for (let i = 0; i < contactIds.length; i += 500) {
    const chunk = contactIds.slice(i, i + 500);
    const r = await fetch(`${ZERNIO_BASE}/broadcasts/${zernioId}/recipients`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: chunk }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) added += Number(j.added ?? chunk.length);
    else console.error('[zernio-broadcast] recipients error', r.status, j);
  }

  // 3) Send
  const sendRes = await fetch(`${ZERNIO_BASE}/broadcasts/${zernioId}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const sendJson = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    await supabase.from('social_broadcasts').update({
      status: 'failed',
      segment: { ...seg, error: `zernio_send_failed: ${JSON.stringify(sendJson)}`, zernio_broadcast_id: zernioId, total_targets: contactIds.length, recipients_added: added },
    }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'zernio_send_failed', details: sendJson }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase.from('social_broadcasts').update({
    status: 'sent',
    total_sent: added,
    segment: { ...seg, zernio_broadcast_id: zernioId, total_targets: contactIds.length, recipients_added: added },
  }).eq('id', broadcastId);

  console.log(JSON.stringify({ event: 'zernio_broadcast.done', id: broadcastId, zernio: zernioId, added }));
  return new Response(JSON.stringify({ broadcast_id: broadcastId, zernio_broadcast_id: zernioId, sent: added, total_targets: contactIds.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
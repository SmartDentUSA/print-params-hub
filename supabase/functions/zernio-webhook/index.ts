// zernio-webhook — recebe eventos Zernio (comment.created, dm.received, etc) e dispara flows
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zernio-signature',
};

async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === signature.replace(/^sha256=/, '');
}

function normalize(text: string) {
  return (text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  const secret = Deno.env.get('ZERNIO_WEBHOOK_SECRET');
  if (secret) {
    const ok = await verifySignature(rawBody, req.headers.get('x-zernio-signature'), secret);
    if (!ok) return new Response('invalid signature', { status: 401, headers: corsHeaders });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return new Response('bad json', { status: 400, headers: corsHeaders }); }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const event = payload?.event ?? payload?.type ?? 'unknown';
  const data = payload?.data ?? payload;
  const channel = (data?.platform ?? 'instagram').toLowerCase();
  const igUserId = data?.from?.id ?? data?.user?.id ?? data?.sender_id ?? null;
  const igUsername = data?.from?.username ?? data?.user?.username ?? null;
  const text: string = data?.text ?? data?.message ?? data?.comment_text ?? '';
  const postId: string | null = data?.post?.id ?? data?.post_id ?? null;

  console.log(JSON.stringify({ event: 'zernio.webhook', type: event, ig_user_id: igUserId, post_id: postId }));

  // Upsert contato
  if (igUserId) {
    await supabase.from('social_contacts').upsert({
      ig_user_id: igUserId,
      ig_username: igUsername,
      channel,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'ig_user_id' });
  }

  // Match triggers
  const wantsTriggerType =
    event.includes('comment') ? 'comment_keyword' :
    event.includes('dm') ? 'dm_keyword' :
    event.includes('story') ? 'story_reply' :
    event.includes('mention') ? 'mention' : null;

  if (!wantsTriggerType) {
    return new Response(JSON.stringify({ ok: true, matched: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: triggers } = await supabase
    .from('social_triggers')
    .select('*, social_flows!inner(id, is_active, nodes, edges, channel)')
    .eq('trigger_type', wantsTriggerType)
    .order('priority', { ascending: false });

  const norm = normalize(text);
  const matches = (triggers ?? []).filter((t: any) => {
    if (!t.social_flows?.is_active) return false;
    if (t.social_flows.channel && t.social_flows.channel !== channel) return false;
    if (postId && Array.isArray(t.post_ids) && t.post_ids.length > 0 && !t.post_ids.includes(postId)) return false;
    const keywords: string[] = t.keywords ?? [];
    if (keywords.length === 0) return true;
    if (t.is_regex) return keywords.some((k) => { try { return new RegExp(k, 'i').test(text); } catch { return false; } });
    return keywords.some((k) => norm.includes(normalize(k)));
  });

  if (matches.length === 0) {
    return new Response(JSON.stringify({ ok: true, matched: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const firstMatch = matches[0];
  const flow = firstMatch.social_flows;

  // Cria sessão e invoca executor
  const initialNode = (flow.nodes as any[])?.find((n: any) => {
    const incoming = (flow.edges as any[])?.some((e: any) => e.target === n.id);
    return !incoming;
  });
  if (!initialNode) {
    return new Response(JSON.stringify({ ok: true, matched: matches.length, error: 'no_start_node' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: session } = await supabase.from('social_sessions').insert({
    ig_user_id: igUserId,
    ig_username: igUsername,
    channel,
    flow_id: flow.id,
    current_node_id: initialNode.id,
    state: { trigger_text: text, post_id: postId, event },
    status: 'active',
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  }).select('id').single();

  await supabase.from('social_flows').update({ total_triggered: (flow as any).total_triggered ? undefined : 1 }).eq('id', flow.id);

  // Invoca o flow-executor para essa sessão (fire-and-forget)
  try {
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/flow-executor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ session_id: session?.id }),
    });
  } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({ ok: true, matched: matches.length, session_id: session?.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
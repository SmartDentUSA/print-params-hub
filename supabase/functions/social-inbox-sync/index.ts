// social-inbox-sync — puxa conversas/mensagens da Unified Inbox do Zernio,
// identifica o lead e grava as DMs na timeline (lead_activity_log).
// Roda por cron; também aceita chamada manual.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('ZERNIO_API_KEY');
  if (!key) return json({ error: 'ZERNIO_API_KEY não configurada' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, svcKey);

  let body: Record<string, any> = {};
  try { body = req.method === 'POST' ? await req.json() : {}; } catch { /* ignore */ }

  const maxConversations = Math.min(Number(body.limit ?? 40) || 40, 100);
  const messagesPerConv = Math.min(Number(body.messages ?? 30) || 30, 100);
  const sinceHours = Math.min(Number(body.sinceHours ?? 72) || 72, 24 * 30);
  const cutoff = Date.now() - sinceHours * 3600_000;

  const zfetch = async (path: string) => {
    const res = await fetch(`${ZERNIO_BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`zernio ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    try { return JSON.parse(text); } catch { return {}; }
  };

  const asArray = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    for (const k of ['data', 'conversations', 'messages', 'items', 'results']) {
      if (Array.isArray(payload?.[k])) return payload[k];
      if (Array.isArray(payload?.data?.[k])) return payload.data[k];
    }
    return [];
  };

  const linkUrl = `${supabaseUrl}/functions/v1/social-inbox-lead-link`;
  const callLink = async (payload: Record<string, unknown>) => {
    const res = await fetch(linkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${svcKey}`,
        apikey: svcKey,
      },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({}));
  };

  const debug = body.debug === true;
  const stats = { conversations: 0, linked: 0, unmatched: 0, inserted: 0, errors: [] as string[] };
  const samples: any[] = [];

  try {
    const convPayload = await zfetch(`/inbox/conversations?limit=${maxConversations}&sortOrder=desc`);
    const conversations = asArray(convPayload);

    for (const c of conversations) {
      const convId = String(c.id ?? c.conversationId ?? '');
      if (!convId) continue;

      const lastTs = Date.parse(c.lastMessageAt ?? c.updatedAt ?? c.createdAt ?? '') || Date.now();
      if (lastTs < cutoff) continue;

      stats.conversations++;
      const accountId = String(
        c.accountId ?? c.account?.id ?? c.socialAccountId ?? c.account_id ?? c.pageId ?? '',
      );
      try {
        const qs = new URLSearchParams({ limit: String(messagesPerConv) });
        if (accountId) qs.set('accountId', accountId);
        const msgPayload = await zfetch(
          `/inbox/conversations/${encodeURIComponent(convId)}/messages?${qs}`,
        );
        const messages = asArray(msgPayload);
        if (messages.length === 0) continue;

        const result = await callLink({
          action: 'log_timeline',
          conversationId: convId,
          platform: c.platform ?? c.channel ?? 'instagram',
          participantName: c.participantName ?? c.participant?.name ?? null,
          participantUsername: c.participantUsername ?? c.participant?.username ?? null,
          lastMessage: c.lastMessage ?? null,
          messages,
        });

        if (debug && samples.length < 2) {
          samples.push({ conversation: c, firstMessages: messages.slice(0, 3), result });
        }

        if (result?.linked) {
          stats.linked++;
          stats.inserted += Number(result.inserted ?? 0);
        } else {
          stats.unmatched++;
        }
      } catch (e: any) {
        stats.errors.push(`${convId}: ${String(e?.message ?? e).slice(0, 200)}`);
      }
    }

    await supabase.from('system_health_logs').insert({
      function_name: 'social-inbox-sync',
      severity: stats.errors.length > 0 ? 'warning' : 'info',
      error_type: stats.errors.length > 0 ? 'zernio_partial_failure' : 'sync_summary',
      details: stats as any,
    } as any);

    return json({ ok: true, ...stats, ...(debug ? { samples } : {}) });
  } catch (e: any) {
    console.error('[social-inbox-sync] fatal', e);
    return json({ error: String(e?.message ?? e), ...stats }, 500);
  }
});

// social-inbox — proxy da Unified Inbox do Zernio (conversas, mensagens, envio)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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

  let payload: Record<string, any> = {};
  try { payload = req.method === 'POST' ? await req.json() : {}; } catch { /* ignore */ }

  const url = new URL(req.url);
  const action = String(payload.action ?? url.searchParams.get('action') ?? 'conversations');

  const zfetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${ZERNIO_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[social-inbox] zernio ${path} -> ${res.status}: ${text}`);
      return json({ error: 'Zernio request failed', status: res.status, details: text }, res.status);
    }
    return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  };

  try {
    if (action === 'conversations') {
      const qs = new URLSearchParams();
      qs.set('limit', String(Math.min(Number(payload.limit ?? 50) || 50, 100)));
      qs.set('sortOrder', String(payload.sortOrder ?? 'desc'));
      if (payload.platform) qs.set('platform', String(payload.platform));
      if (payload.status) qs.set('status', String(payload.status));
      if (payload.accountId) qs.set('accountId', String(payload.accountId));
      if (payload.cursor) qs.set('cursor', String(payload.cursor));
      return await zfetch(`/inbox/conversations?${qs}`);
    }

    if (action === 'messages') {
      const id = String(payload.conversationId ?? '');
      if (!id) return json({ error: 'conversationId obrigatório' }, 400);
      const qs = new URLSearchParams();
      if (payload.accountId) qs.set('accountId', String(payload.accountId));
      qs.set('limit', String(Math.min(Number(payload.limit ?? 50) || 50, 100)));
      if (payload.cursor) qs.set('cursor', String(payload.cursor));
      return await zfetch(`/inbox/conversations/${encodeURIComponent(id)}/messages?${qs}`);
    }

    if (action === 'send') {
      const id = String(payload.conversationId ?? '');
      const message = String(payload.message ?? '').trim();
      if (!id || !message) return json({ error: 'conversationId e message obrigatórios' }, 400);
      return await zfetch(`/inbox/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message, ...(payload.accountId ? { accountId: payload.accountId } : {}) }),
      });
    }

    if (action === 'mark_read') {
      const id = String(payload.conversationId ?? '');
      if (!id) return json({ error: 'conversationId obrigatório' }, 400);
      return await zfetch(`/inbox/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error('[social-inbox] fail', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

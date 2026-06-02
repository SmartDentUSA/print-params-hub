// zernio-contacts-sync — espelha contatos de TODAS as plataformas (Zernio) em social_contacts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';
const PAGE = 200;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('ZERNIO_API_KEY');
    if (!apiKey) throw new Error('ZERNIO_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Optional body: { platform?: string, accountId?: string, maxPages?: number }
    let body: any = {};
    try { body = await req.json(); } catch {}
    const maxPages = Number(body.maxPages ?? 50);

    const params = new URLSearchParams();
    params.set('limit', String(PAGE));
    if (body.platform) params.set('platform', body.platform);
    if (body.accountId) params.set('accountId', body.accountId);

    let skip = 0;
    let totalUpserted = 0;
    let pages = 0;
    const perPlatform: Record<string, number> = {};

    while (pages < maxPages) {
      params.set('skip', String(skip));
      const res = await fetch(`${ZERNIO_BASE}/contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Zernio /contacts ${res.status}: ${t.slice(0, 300)}`);
      }
      const json = await res.json();
      const contacts: any[] = json.contacts ?? json.data ?? [];
      if (contacts.length === 0) break;

      const rows = contacts.map((c) => {
        const platform = String(c.platform ?? 'instagram');
        perPlatform[platform] = (perPlatform[platform] ?? 0) + 1;
        const cf = { ...(c.customFields ?? {}) };
        // preservar manychat_id se vier do payload (legacy/integração)
        if (c.manychatId && !cf.manychat_id) cf.manychat_id = c.manychatId;
        return {
          // PK ig_user_id é reaproveitado como external_id global (id do contato Zernio)
          ig_user_id: String(c.id ?? c._id),
          ig_username: c.name ?? c.displayIdentifier ?? null,
          channel: platform,
          is_follower: c.isFollower ?? null,
          subscribed: c.isSubscribed ?? true,
          tags: Array.isArray(c.tags) ? c.tags.map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean) : [],
          custom_fields: { ...cf, platformIdentifier: c.platformIdentifier ?? null, zernio_contact_id: c.id ?? c._id },
          last_seen_at: c.lastMessageReceivedAt ?? c.updatedAt ?? null,
          first_seen_at: c.createdAt ?? null,
        };
      }).filter((r) => r.ig_user_id);

      if (rows.length > 0) {
        const { error } = await supabase
          .from('social_contacts')
          .upsert(rows, { onConflict: 'ig_user_id' });
        if (error) throw error;
        totalUpserted += rows.length;
      }

      pages++;
      const hasMore = json.pagination?.hasMore ?? (contacts.length === PAGE);
      if (!hasMore) break;
      skip += contacts.length;
    }

    console.log(JSON.stringify({ event: 'zernio_contacts_sync.done', synced: totalUpserted, pages, perPlatform }));
    return new Response(
      JSON.stringify({ synced: totalUpserted, pages, perPlatform }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[zernio-contacts-sync]', err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
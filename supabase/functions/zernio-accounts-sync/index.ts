// zernio-accounts-sync — espelha contas conectadas no Zernio em social_zernio_accounts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('ZERNIO_API_KEY');
    if (!apiKey) throw new Error('ZERNIO_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const res = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zernio ${res.status}: ${text}`);
    }
    const body = await res.json();
    const accounts: any[] = body.accounts || body.data || [];

    const extractId = (v: any): string => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object') return v._id ?? v.id ?? '';
      return String(v);
    };
    const rows = accounts.map((a) => ({
      zernio_account_id: extractId(a._id ?? a.id),
      zernio_profile_id: extractId(a.profileId ?? a.profile_id ?? a.profile),
      platform: a.platform,
      handle: a.handle ?? a.username ?? a.name ?? null,
      display_name: a.displayName ?? a.name ?? null,
      avatar_url: a.avatarUrl ?? a.avatar ?? null,
      active: a.active ?? a.status !== 'disconnected',
      raw: a,
      last_synced_at: new Date().toISOString(),
    })).filter((r) => r.zernio_account_id && r.platform);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('social_zernio_accounts')
        .upsert(rows, { onConflict: 'zernio_account_id' });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ synced: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[zernio-accounts-sync]', err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
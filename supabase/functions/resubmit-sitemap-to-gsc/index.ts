// Resubmits the project sitemap to Google Search Console for every verified site.
// Triggered by pg_cron when sitemap_resubmit_state.needs_resubmit = true.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';

// Verified GSC properties + the sitemap URL each one should receive.
const SITEMAP_URL = 'https://www.smartdent.com.br/sitemap-index.xml';
const PUBLIC_SITE = 'https://www.smartdent.com.br/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), { status: 500, headers: corsHeaders });
  if (!GSC_KEY) return new Response(JSON.stringify({ error: 'GOOGLE_SEARCH_CONSOLE_API_KEY missing' }), { status: 500, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let force = false;
  try {
    const body = await req.json().catch(() => ({}));
    force = !!body?.force;
  } catch (_) { /* no body */ }

  const { data: state } = await supabase
    .from('sitemap_resubmit_state')
    .select('id, needs_resubmit, last_submitted_at, last_marked_at')
    .eq('id', 1)
    .maybeSingle();

  if (!force && state && !state.needs_resubmit) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_changes' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Discover an actually verified URL-prefix or domain property before submitting.
  const authHeaders = { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': GSC_KEY };
  let site: string;
  try {
    const propertiesResponse = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: authHeaders });
    if (!propertiesResponse.ok) throw new Error('GSC properties request failed: ' + propertiesResponse.status);
    const properties = await propertiesResponse.json();
    const permitted = (properties.siteEntry || []).filter((p: {permissionLevel: string}) => ['siteOwner','siteFullUser'].includes(p.permissionLevel));
    site = permitted.find((p: {siteUrl: string}) => p.siteUrl === PUBLIC_SITE)?.siteUrl
      || permitted.find((p: {siteUrl: string}) => p.siteUrl === 'sc-domain:smartdent.com.br')?.siteUrl;
    if (!site) return new Response(JSON.stringify({ submitted:false, error:'Public domain not verified in connected Search Console account', sitemap:SITEMAP_URL }), { status:409, headers:{...corsHeaders,'Content-Type':'application/json'} });
  } catch(e) {
    return new Response(JSON.stringify({submitted:false,error:String(e)}), {status:502,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
  const TARGETS = [{ site, sitemap: SITEMAP_URL }];
  const results: Array<{ site: string; sitemap: string; status: number; ok: boolean; body?: string }> = [];
  for (const t of TARGETS) {
    const url = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(t.site)}/sitemaps/${encodeURIComponent(t.sitemap)}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GSC_KEY,
        },
      });
      const txt = res.ok ? '' : await res.text();
      results.push({ site: t.site, sitemap: t.sitemap, status: res.status, ok: res.ok, body: txt || undefined });
    } catch (e) {
      results.push({ site: t.site, sitemap: t.sitemap, status: 0, ok: false, body: String(e) });
    }
  }

  const anyOk = results.length > 0 && results.every(r => r.ok);
  if (anyOk) {
    await supabase
      .from('sitemap_resubmit_state')
      .upsert({ id: 1, needs_resubmit: false, last_submitted_at: new Date().toISOString() });
  }

  return new Response(JSON.stringify({ submitted: anyOk, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: anyOk ? 200 : 502,
  });
});

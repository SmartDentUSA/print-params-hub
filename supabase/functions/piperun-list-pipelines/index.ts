import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PIPERUN_API_BASE = "https://api.pipe.run/v1";

async function piperunGet(token: string, path: string, params: Record<string, string | number> = {}) {
  const sp = new URLSearchParams({ token, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${PIPERUN_API_BASE}/${path}?${sp.toString()}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('PIPERUN_API_KEY');
  if (!token) {
    return new Response(JSON.stringify({ error: 'PIPERUN_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    let resource = url.searchParams.get('resource') || 'pipelines';
    let pipelineId = url.searchParams.get('pipeline_id');
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.resource) resource = String(body.resource);
        if (body?.pipeline_id) pipelineId = String(body.pipeline_id);
      } catch { /* ignore */ }
    }

    let path = 'pipelines';
    const params: Record<string, string | number> = { show: 200 };

    if (resource === 'stages') {
      path = 'stages';
      if (pipelineId) params.pipeline_id = pipelineId;
    } else if (resource === 'loss_reasons') {
      path = 'reasonsForLosing';
    }

    // Aggregate pagination up to a safe cap
    const items: any[] = [];
    let page = 1;
    while (page <= 10) {
      const { ok, data } = await piperunGet(token, path, { ...params, page });
      if (!ok) break;
      const pageItems = (data as any)?.data ?? [];
      items.push(...pageItems);
      const meta = (data as any)?.meta?.pagination;
      if (!meta || page >= (meta.total_pages ?? 1)) break;
      page++;
    }

    return new Response(JSON.stringify({
      resource,
      count: items.length,
      items: items.map((it: any) => ({
        id: String(it.id),
        name: it.name ?? it.title ?? String(it.id),
        pipeline_id: it.pipeline_id ? String(it.pipeline_id) : undefined,
        raw: it,
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('piperun-list-pipelines error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
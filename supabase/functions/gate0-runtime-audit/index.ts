// Ephemeral Gate 0 audit function. Deployed only to compute runtime bundle hashes.
// Deleted immediately after Gate 0 completes. PAT is never logged or echoed.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const PROJECT_REF = 'okeogjgqijbfkudfjadz';
const MGMT_API = 'https://api.supabase.com';

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const pat = Deno.env.get('SB_MGMT_PAT') ?? Deno.env.get('SB_MANAGEMENT_PAT');
  if (!pat) {
    return new Response(JSON.stringify({ error: 'SB_MGMT_PAT/SB_MANAGEMENT_PAT missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = { Authorization: `Bearer ${pat}` };

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = parseInt(url.searchParams.get('limit') ?? '25', 10);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. List all deployed functions
  const listRes = await fetch(`${MGMT_API}/v1/projects/${PROJECT_REF}/functions`, { headers: auth });
  if (!listRes.ok) {
    return new Response(JSON.stringify({ error: 'list_failed', status: listRes.status }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const functions = await listRes.json() as Array<{
    slug: string;
    version: number;
    status: string;
    verify_jwt: boolean;
    created_at: number;
    updated_at: number;
  }>;

  const total = functions.length;
  const slice = functions.slice(offset, offset + limit);

  // 2. For each function in slice, fetch body and hash it
  const CONCURRENCY = 6;
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const batch = slice.slice(i, i + CONCURRENCY);
    const chunk = await Promise.all(batch.map(async (fn) => {
      try {
        const bodyRes = await fetch(
          `${MGMT_API}/v1/projects/${PROJECT_REF}/functions/${fn.slug}/body`,
          { headers: auth },
        );
        if (!bodyRes.ok) {
          return {
            slug: fn.slug,
            version: fn.version,
            verify_jwt: fn.verify_jwt,
            status: fn.status,
            updated_at: fn.updated_at,
            runtime_sha256: null,
            body_size: null,
            fetch_status: bodyRes.status,
          };
        }
        const buf = new Uint8Array(await bodyRes.arrayBuffer());
        const hash = await sha256Hex(buf);
        return {
          slug: fn.slug,
          version: fn.version,
          verify_jwt: fn.verify_jwt,
          status: fn.status,
          updated_at: fn.updated_at,
          runtime_sha256: hash,
          body_size: buf.byteLength,
          fetch_status: 200,
        };
      } catch (e) {
        return {
          slug: fn.slug,
          version: fn.version,
          verify_jwt: fn.verify_jwt,
          status: fn.status,
          updated_at: fn.updated_at,
          runtime_sha256: null,
          body_size: null,
          fetch_status: -1,
          error: String(e).slice(0, 200),
        };
      }
    }));
    results.push(...chunk);
  }

  if (results.length > 0) {
    const { error } = await sb.from('_gate0_runtime_audit').upsert(results, { onConflict: 'slug' });
    if (error) {
      return new Response(
        JSON.stringify({ error: 'upsert_failed', details: error.message, total, offset, processed: results.length }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  return new Response(
    JSON.stringify({
      project_ref: PROJECT_REF,
      total_functions: total,
      offset,
      limit,
      processed: results.length,
      next_offset: offset + results.length < total ? offset + results.length : null,
      generated_at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
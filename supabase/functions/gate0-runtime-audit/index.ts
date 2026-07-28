// Ephemeral Gate 0 audit function. Deployed only to compute runtime bundle hashes.
// Deleted immediately after Gate 0 completes. PAT is never logged or echoed.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PROJECT_REF = 'okeogjgqijbfkudfjadz';
const MGMT_API = 'https://api.supabase.com';

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const pat = Deno.env.get('SB_MGMT_PAT');
  if (!pat) {
    return new Response(JSON.stringify({ error: 'SB_MGMT_PAT missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = { Authorization: `Bearer ${pat}` };

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

  // 2. For each function, fetch body and hash it
  const results: Array<Record<string, unknown>> = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < functions.length; i += CONCURRENCY) {
    const batch = functions.slice(i, i + CONCURRENCY);
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

  return new Response(
    JSON.stringify({
      project_ref: PROJECT_REF,
      total: results.length,
      generated_at: new Date().toISOString(),
      functions: results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
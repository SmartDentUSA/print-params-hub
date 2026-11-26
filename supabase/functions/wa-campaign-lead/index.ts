import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { processCampaignReply } from './handler.ts';
import { syncFormNote } from '../_shared/form-note-sync.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ inbox_id: z.string().uuid().optional(), inbox_ids: z.array(z.string().uuid()).min(1).max(10).optional(), dry_run: z.boolean().default(true), dispatch_token: z.string().uuid().optional() })
  .refine((v) => !!v.inbox_id !== !!v.inbox_ids, 'Informe inbox_id ou inbox_ids');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anon) return json({ error: 'service not configured' }, 500);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(url, serviceKey);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  let scopedDispatch = false;
  if (token === anon && parsed.data.inbox_id && parsed.data.dispatch_token && !parsed.data.inbox_ids) {
    // An anon JWT alone is NOT authorization. Only a one-message capability
    // generated in the service-only dispatch queue can process that inbox ID.
    const { data: authorized, error } = await db.from('wa_campaign_reply_dispatch')
      .update({ status: 'processing' }).eq('inbox_id', parsed.data.inbox_id).eq('dispatch_token', parsed.data.dispatch_token)
      .in('status', ['pending', 'failed']).select('inbox_id');
    if (error || !authorized?.length) return json({ error: 'unauthorized' }, 401);
    scopedDispatch = true;
  } else if (token !== serviceKey) {
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return json({ error: 'unauthorized' }, 401);
    const { data: admin, error: roleError } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (roleError || !admin) return json({ error: 'forbidden' }, 403);
  }
  const ids = parsed.data.inbox_ids ?? (parsed.data.inbox_id ? [parsed.data.inbox_id] : []);
  const results: unknown[] = [];
  let failed = false;
  for (const id of ids) {
    try {
      const result = await processCampaignReply(db, id, parsed.data.dry_run, async (payload) => {
        const response = await fetch(`${url}/functions/v1/smart-ops-ingest-lead`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(50_000),
        });
        const out = await response.json();
        if (!response.ok || !out?.lead_id) throw new Error(`ingestion failed (${response.status}): ${JSON.stringify(out).slice(0, 500)}`);
        return out;
      }, async (conversationId, accountId, interactive) => {
        const apiKey = Deno.env.get('ZERNIO_API_KEY');
        if (!apiKey) throw new Error('Zernio credentials unavailable');
        const response = await fetch(`https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, interactive }), signal: AbortSignal.timeout(30_000),
        });
        const out = await response.json();
        if (!response.ok || out?.success === false) throw new Error(`category menu failed (${response.status}): ${JSON.stringify(out).slice(0, 500)}`);
        return out?.data?.messageId ?? out?.messageId ?? null;
      });
      results.push(result);
      let noteLeadId: string | null = 'ingested' in result && result.ingested ? String(result.lead_id) : null;
      let noteJobId: string | null = 'ingested' in result && result.ingested ? String(result.job_id) : null;
      if (!parsed.data.dry_run && !noteLeadId) {
        // Re-dispatching an accepted original message retries only its note.
        const { data: completed, error } = await db.from('wa_campaign_lead_jobs')
          .select('id,lead_id,note_status').eq('inbox_id', id).eq('status', 'ingested').maybeSingle();
        if (error) throw error;
        if (completed?.lead_id && completed.note_status !== 'sent') {
          noteLeadId = completed.lead_id;
          noteJobId = completed.id;
        }
      }
      if (!parsed.data.dry_run && noteLeadId && noteJobId) {
        const leadId = noteLeadId, jobId = noteJobId;
        EdgeRuntime.waitUntil(syncFormNote(db, leadId).then(async () => {
          const { error } = await db.from('wa_campaign_lead_jobs').update({ note_status: 'sent' }).eq('id', jobId);
          if (error) throw error;
        }).catch(async (error) => {
          console.error('wa-campaign-lead note failed', jobId, String(error));
          await db.from('wa_campaign_lead_jobs').update({ note_status: 'failed', last_error: String(error).slice(0, 1000) }).eq('id', jobId);
        }));
      }
    } catch (error) {
      failed = true;
      console.error('wa-campaign-lead failed', id, String(error));
      results.push({ inbox_id: id, error: String(error) });
    }
  }
  if (scopedDispatch && parsed.data.inbox_id) {
    await db.from('wa_campaign_reply_dispatch').update({ status: failed ? 'failed' : 'done' }).eq('inbox_id', parsed.data.inbox_id);
    // Capability callbacks never expose lead identities or other internal data.
    return json({ ok: !failed }, failed ? 502 : 200);
  }
  return json({ ok: !failed, dry_run: parsed.data.dry_run, results }, failed ? 502 : 200);
});
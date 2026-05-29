// supabase/functions/wa-group-blast/index.ts
// Envio pontual a múltiplos grupos. Cria 1 wa_campaigns + N linhas em wa_campaign_groups + N msgs em wa_message_queue.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface BlastBody {
  group_jids:    string[]
  message_type:  'msg' | 'image' | 'video' | 'audio' | 'document' | 'link' | 'ai'
  content:       Record<string, unknown>
  scheduled_at?: string
  campaign_name?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  let body: BlastBody
  try { body = await req.json() } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders })
  }

  if (!Array.isArray(body.group_jids) || body.group_jids.length === 0) {
    return Response.json({ ok: false, error: 'group_jids obrigatório' }, { status: 400, headers: corsHeaders })
  }
  if (!body.message_type || !body.content) {
    return Response.json({ ok: false, error: 'message_type e content obrigatórios' }, { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Resolve groups + ensure admin + enabled
  const { data: groups, error: ge } = await supabase
    .from('wa_groups')
    .select('id, group_jid, name, is_admin, enabled, instance_name')
    .in('group_jid', body.group_jids)

  if (ge) return Response.json({ ok: false, error: ge.message }, { status: 500, headers: corsHeaders })

  const eligible = (groups ?? []).filter(g => g.is_admin && g.enabled)
  if (eligible.length === 0) {
    return Response.json({ ok: false, error: 'Nenhum grupo elegível (admin + enabled)' }, { status: 400, headers: corsHeaders })
  }

  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : new Date(Date.now() + 30_000)
  if (Number.isNaN(scheduledAt.getTime())) {
    return Response.json({ ok: false, error: 'scheduled_at inválido' }, { status: 400, headers: corsHeaders })
  }

  // Single-node flow stored on campaign for traceability
  const flowNode = { id: crypto.randomUUID(), type: body.message_type, ...body.content }

  const { data: camp, error: ce } = await supabase
    .from('wa_campaigns')
    .insert({
      group_id: null,
      name: body.campaign_name ?? `Blast ${new Date().toLocaleDateString('pt-BR')}`,
      flow_json: [flowNode],
      status: 'active',
      campaign_type: 'blast',
      current_node_index: 0,
      next_send_at: scheduledAt.toISOString(),
      started_at: new Date().toISOString(),
      delay_seconds: 30,
      daily_limit: 9999,
    })
    .select('id')
    .single()

  if (ce || !camp) {
    return Response.json({ ok: false, error: ce?.message ?? 'falha ao criar campanha' }, { status: 500, headers: corsHeaders })
  }

  const cid = camp.id

  // Junction rows
  const links = eligible.map(g => ({ campaign_id: cid, group_id: g.id }))
  const { error: le } = await supabase.from('wa_campaign_groups').insert(links)
  if (le) {
    await supabase.from('wa_campaigns').delete().eq('id', cid)
    return Response.json({ ok: false, error: le.message }, { status: 500, headers: corsHeaders })
  }

  // Queue rows
  const queueRows = eligible.map(g => ({
    campaign_id:  cid,
    group_jid:    g.group_jid,
    node_index:   0,
    node_type:    body.message_type,
    content_json: body.content,
    scheduled_at: scheduledAt.toISOString(),
    status:       'pending',
  }))

  const { error: qe } = await supabase.from('wa_message_queue').insert(queueRows)
  if (qe) {
    await supabase.from('wa_campaigns').delete().eq('id', cid)
    return Response.json({ ok: false, error: qe.message }, { status: 500, headers: corsHeaders })
  }

  // Mark active_campaign_id only on free groups
  for (const g of eligible) {
    await supabase.from('wa_groups')
      .update({ active_campaign_id: cid })
      .eq('id', g.id)
      .is('active_campaign_id', null)
  }

  console.log(`[wa-group-blast] campaign ${cid}: ${eligible.length} grupos, agendado para ${scheduledAt.toISOString()}`)

  return Response.json({
    ok:          true,
    campaign_id: cid,
    groups:      eligible.length,
    queued:      queueRows.length,
    first_send:  scheduledAt.toISOString(),
  }, { headers: corsHeaders })
})
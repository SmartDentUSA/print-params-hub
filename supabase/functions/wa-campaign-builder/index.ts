// supabase/functions/wa-campaign-builder/index.ts
// Ativa uma campanha: lê flow_json e popula wa_message_queue.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/evolution.ts'
import { spDateTimeToUtc, spWeekday, addDaysSp } from '../_shared/timezone.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const { campaign_id } = await req.json()
  if (!campaign_id) {
    return Response.json({ ok: false, error: 'campaign_id obrigatório' }, { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: camp, error } = await supabase
    .from('wa_campaigns')
    .select('*, wa_groups!wa_campaigns_group_id_fkey(group_jid, name, member_count)')
    .eq('id', campaign_id)
    .single()

  if (error || !camp) {
    console.error('[wa-campaign-builder] fetch campaign failed', { campaign_id, error })
    return Response.json({ ok: false, error: `Campanha não encontrada: ${error?.message ?? 'unknown'}` }, { status: 404, headers: corsHeaders })
  }
  if (!['draft', 'paused', 'active', 'finished'].includes(camp.status)) {
    return Response.json({ ok: false, error: `Campanha está ${camp.status} — não pode ser (re)ativada` }, { status: 400, headers: corsHeaders })
  }

  const flow: Array<Record<string, unknown>> = camp.flow_json ?? []
  if (flow.length === 0) {
    return Response.json({ ok: false, error: 'flow_json vazio' }, { status: 400, headers: corsHeaders })
  }

  // Resolve target groups: single (camp.group_id) OR multi (wa_campaign_groups)
  type Tgt = { id: string; group_jid: string }
  let targets: Tgt[] = []

  if (camp.group_id && camp.wa_groups?.group_jid) {
    targets = [{ id: camp.group_id, group_jid: camp.wa_groups.group_jid }]
  } else {
    const { data: linked } = await supabase
      .from('wa_campaign_groups')
      .select('group_id, wa_groups!inner(id, group_jid, enabled, is_admin)')
      .eq('campaign_id', campaign_id)
    targets = (linked ?? [])
      .map((r: any) => ({ id: r.wa_groups.id, group_jid: r.wa_groups.group_jid }))
      .filter((t: Tgt) => !!t.group_jid)
  }

  if (targets.length === 0) {
    return Response.json({ ok: false, error: 'Campanha sem grupos vinculados' }, { status: 400, headers: corsHeaders })
  }

  // Clean previous pending for this campaign across all groups
  await supabase.from('wa_message_queue')
    .delete().eq('campaign_id', campaign_id).eq('status', 'pending')

  const startTs = camp.started_at ? new Date(camp.started_at).getTime() : Date.now() + 15_000
  const queueRows: Array<Record<string, unknown>> = []

  for (const tgt of targets) {
    let accMs = 0
    let lastWait: Record<string, unknown> | null = null
    for (let i = 0; i < flow.length; i++) {
      const node = flow[i]
      if (node.type === 'wait') {
        accMs += ((node.days as number) ?? 1) * 86_400_000
        lastWait = node
        continue
      }
      let ts: Date
      if (lastWait) {
        // Após um nó wait: usa o horário SP configurado no wait (timezone-aware).
        const time = (lastWait.time as string) ?? '09:00'
        const [hh, mm] = time.split(':').map(Number)
        ts = spDateTimeToUtc(new Date(startTs + accMs), hh, mm)
        if (lastWait.weekdays_only) {
          const d = spWeekday(ts)
          if (d === 0) ts = addDaysSp(ts, 1)
          else if (d === 6) ts = addDaysSp(ts, 2)
        }
      } else {
        // Primeiro nó de conteúdo: respeita exatamente o started_at escolhido na UI
        ts = new Date(startTs)
      }
      queueRows.push({
        campaign_id,
        group_jid: tgt.group_jid,
        node_index: i,
        node_type: node.type,
        content_json: buildContent(node),
        scheduled_at: ts.toISOString(),
        status: 'pending',
      })
    }
  }

  if (queueRows.length === 0) {
    return Response.json({ ok: false, error: 'Nenhum nó de conteúdo no fluxo' }, { status: 400, headers: corsHeaders })
  }

  const { error: insertErr } = await supabase.from('wa_message_queue').insert(queueRows)
  if (insertErr) throw insertErr

  const firstSend = queueRows.map(r => r.scheduled_at as string).sort()[0]

  await supabase.from('wa_campaigns').update({
    status: 'active',
    started_at: camp.started_at ?? new Date().toISOString(),
    current_node_index: 0,
    next_send_at: firstSend,
  }).eq('id', campaign_id)

  // Mark active_campaign_id on every target group (only if free or already this campaign)
  for (const tgt of targets) {
    await supabase.from('wa_groups')
      .update({ active_campaign_id: campaign_id })
      .eq('id', tgt.id)
  }

  console.log(`[wa-campaign-builder] Campanha ${campaign_id} ativada: ${queueRows.length} msgs em ${targets.length} grupos`)

  return Response.json({
    ok: true, campaign: campaign_id,
    groups: targets.length,
    group_jids: targets.map(t => t.group_jid),
    queued: queueRows.length,
    first_send: firstSend,
  }, { headers: corsHeaders })
})

function buildContent(node: Record<string, unknown>): Record<string, unknown> {
  switch (node.type) {
    case 'msg':   return { text: node.text ?? node.content, mentions_everyone: node.mention_all ?? node.mentions_everyone ?? false }
    case 'ai':    return { ai_source_type: node.ai_source_type ?? 'article', ai_source_id: node.ai_source_id, ai_source_title: node.ai_source_title, ai_prompt_override: node.ai_prompt_override ?? null }
    case 'image':
    case 'video':
    case 'audio':
    case 'document': return { media_url: node.media_url, caption: node.caption ?? '', file_name: node.file_name ?? null, mime_type: node.mime_type ?? null }
    case 'link':  return { title: node.title, description: node.description, url: node.url }
    default:      return { raw: node }
  }
}
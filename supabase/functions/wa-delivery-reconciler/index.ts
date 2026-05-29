// wa-delivery-reconciler — confere o estado real de cada mensagem enviada,
// marca como delivered/read, e re-agenda como pending as que ficaram travadas
// (>15 min em PENDING) para o dispatcher tentar de novo.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findMessageStatus, mapBaileysStatus, corsHeaders } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_PER_RUN      = 50
const STUCK_MINUTES    = 15

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()

  // Pega itens enviados, ainda não confirmados como entregues/lidos
  const { data: items, error } = await supabase
    .from('wa_message_queue')
    .select('id, campaign_id, group_jid, evo_message_id, sent_at, delivery_status, delivery_attempts')
    .eq('status', 'sent')
    .not('evo_message_id', 'is', null)
    .gte('sent_at', since24h)
    .or('delivery_status.is.null,delivery_status.in.(unknown,sent_to_server)')
    .order('sent_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
  if (!items?.length) {
    return Response.json({ ok: true, checked: 0 }, { headers: corsHeaders })
  }

  // Resolve instance + apikey por grupo
  const jids = Array.from(new Set(items.map(i => i.group_jid)))
  const { data: groups } = await supabase
    .from('wa_groups')
    .select('group_jid, instance_name')
    .in('group_jid', jids)
  const instanceByJid = new Map<string, string>((groups ?? []).map((g: any) => [g.group_jid, g.instance_name]))

  const instanceNames = Array.from(new Set((groups ?? []).map((g: any) => g.instance_name).filter(Boolean))) as string[]
  const apikeyByInstance = new Map<string, string>()
  if (instanceNames.length) {
    const { data: tms } = await supabase
      .from('team_members')
      .select('evolution_instance_name, evolution_api_key')
      .in('evolution_instance_name', instanceNames)
    for (const tm of tms ?? []) {
      if (tm.evolution_instance_name && tm.evolution_api_key) {
        apikeyByInstance.set(tm.evolution_instance_name, tm.evolution_api_key)
      }
    }
  }

  const summary = { checked: 0, delivered: 0, read: 0, stuck_requeued: 0, still_pending: 0 }
  const nowIso = new Date().toISOString()

  for (const it of items) {
    summary.checked++
    const instance = instanceByJid.get(it.group_jid)
    const apikey   = instance ? apikeyByInstance.get(instance) : undefined
    if (!instance) continue

    const raw     = await findMessageStatus(it.group_jid, it.evo_message_id!, instance, apikey)
    const mapped  = mapBaileysStatus(raw)
    const ageMin  = it.sent_at ? (Date.now() - new Date(it.sent_at).getTime()) / 60_000 : 0
    const attempts = (it.delivery_attempts ?? 0) + 1

    if (mapped === 'read') {
      summary.read++
      await supabase.from('wa_message_queue').update({
        delivery_status: 'read',
        delivery_checked_at: nowIso,
        delivery_attempts: attempts,
      }).eq('id', it.id)
    } else if (mapped === 'delivered') {
      summary.delivered++
      await supabase.from('wa_message_queue').update({
        delivery_status: 'delivered',
        delivery_checked_at: nowIso,
        delivery_attempts: attempts,
      }).eq('id', it.id)
    } else if (ageMin > STUCK_MINUTES) {
      // Travada → re-agenda pro dispatcher (mantém evo_message_id pra detectar dupe)
      summary.stuck_requeued++
      await supabase.from('wa_message_queue').update({
        delivery_status: 'failed_undelivered',
        delivery_checked_at: nowIso,
        delivery_attempts: attempts,
        status: 'pending',
        retry_count: 0,
        scheduled_at: nowIso,
        error_message: `Não entregue após ${Math.floor(ageMin)}min (Baileys=${raw ?? 'not_found'})`,
      }).eq('id', it.id)
    } else {
      summary.still_pending++
      await supabase.from('wa_message_queue').update({
        delivery_status: mapped,
        delivery_checked_at: nowIso,
        delivery_attempts: attempts,
      }).eq('id', it.id)
    }
  }

  console.log('[wa-delivery-reconciler]', summary)
  return Response.json({ ok: true, ...summary }, { headers: corsHeaders })
})
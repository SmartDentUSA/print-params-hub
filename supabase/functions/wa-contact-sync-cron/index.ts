// wa-contact-sync-cron — drena wa_contact_sync_queue e propaga contatos
// para TODAS as instâncias Evolution ativas (anti-ban).
// Roda via pg_cron a cada 1 min.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, upsertContact } from '../_shared/evolution.ts'

const BATCH_SIZE = 40 // leads por execução
const MAX_ATTEMPTS = 4

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1) Carrega instâncias DISTINTAS ativas (1 row por instance_name)
  const { data: members, error: memErr } = await supabase
    .from('team_members')
    .select('evolution_instance_name, evolution_api_key')
    .eq('ativo', true)
    .not('evolution_instance_name', 'is', null)

  if (memErr) {
    return new Response(JSON.stringify({ error: memErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const instanceByName = new Map<string, { instance_name: string; api_key: string | null }>()
  for (const m of (members ?? [])) {
    const name = m.evolution_instance_name as string
    if (!name) continue
    if (!instanceByName.has(name)) {
      instanceByName.set(name, { instance_name: name, api_key: m.evolution_api_key as string | null })
    } else if (m.evolution_api_key && !instanceByName.get(name)!.api_key) {
      instanceByName.get(name)!.api_key = m.evolution_api_key as string
    }
  }
  const instances = Array.from(instanceByName.values())

  if (instances.length === 0) {
    return new Response(JSON.stringify({ processed: 0, instances: 0, reason: 'no_active_instances' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2) Pega lote pendente (e retries com backoff)
  const { data: rows, error: rowsErr } = await supabase
    .from('wa_contact_sync_queue')
    .select('id, lead_id, phone_e164, contact_name, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (rowsErr) {
    return new Response(JSON.stringify({ error: rowsErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, instances: instances.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ids = rows.map(r => r.id)
  await supabase.from('wa_contact_sync_queue').update({ status: 'processing' }).in('id', ids)

  const results: Array<{ id: string; ok: boolean }> = []

  // Sequencial por lead, paralelo entre instâncias (limitado)
  for (const row of rows) {
    const perInstance: Record<string, { ok: boolean; method?: string; exists?: boolean; error?: string }> = {}
    let anyOk = false

    const settled = await Promise.allSettled(
      instances.map(inst =>
        upsertContact(row.phone_e164, row.contact_name, inst.instance_name, inst.api_key ?? undefined)
          .then(r => ({ inst, r })),
      ),
    )

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { inst, r } = s.value
        perInstance[inst.instance_name] = { ok: r.ok, method: r.method, exists: r.exists, error: r.error }
        if (r.ok) anyOk = true
      } else {
        // erro inesperado — não temos o instance_name aqui, ignora
      }
    }

    const nextAttempts = (row.attempts ?? 0) + 1
    const finalStatus = anyOk
      ? 'done'
      : (nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending')

    await supabase.from('wa_contact_sync_queue').update({
      status: finalStatus,
      attempts: nextAttempts,
      per_instance: perInstance,
      last_error: anyOk ? null : (Object.values(perInstance).find(p => p.error)?.error ?? 'all_instances_failed'),
      processed_at: anyOk ? new Date().toISOString() : null,
    }).eq('id', row.id)

    results.push({ id: row.id, ok: anyOk })
  }

  return new Response(JSON.stringify({
    processed: results.length,
    ok: results.filter(r => r.ok).length,
    instances: instances.length,
    instance_names: instances.map(i => i.instance_name),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
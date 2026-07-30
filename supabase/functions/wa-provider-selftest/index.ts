// wa-provider-selftest — teste operacional da REGRA GLOBAL DOS PROVEDORES WHATSAPP.
//
// Para cada instância de team_members:
//  1. sonda Evolution API (:8080) e EvolutionGO (:8081) e persiste *_status / *_last_check_at;
//  2. roda o router para direct_message e group_message;
//  3. (opcional) envia texto real de teste — individual pela Evolution, grupo pelo EvolutionGO.
//
// Nunca faz fallback entre provedores e nunca loga credenciais.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  WA_PROVIDER_COLUMNS,
  resolveProvider,
  describeProvider,
  WaProviderBlockedError,
  isDualMode,
  DEFAULT_EVOLUTION_BASE_URL,
  DEFAULT_EVO_GO_BASE_URL,
  type WaTeamMember,
} from '../_shared/wa-provider-router.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const strip = (u?: string | null) => (u ?? '').trim().replace(/\/+$/, '')

async function probeEvolution(tm: WaTeamMember) {
  const base = strip(tm.evolution_base_url) || DEFAULT_EVOLUTION_BASE_URL
  const inst = (tm.evolution_instance_name ?? '').trim()
  const key = (tm.evolution_api_key ?? '').trim()
  if (!inst || !key) return { state: 'unconfigured', http: 0, detail: 'sem instância ou apikey' }
  try {
    const r = await fetch(`${base}/instance/connectionState/${encodeURIComponent(inst)}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    })
    const txt = await r.text().catch(() => '')
    let state = 'close'
    try {
      const j = JSON.parse(txt)
      state = j?.instance?.state ?? j?.state ?? 'close'
    } catch { /* ignore */ }
    return { state: r.ok ? state : 'error', http: r.status, detail: r.ok ? null : txt.slice(0, 160) }
  } catch (e) {
    return { state: 'error', http: 0, detail: String((e as Error).message) }
  }
}

async function probeEvoGo(tm: WaTeamMember) {
  const base = strip(tm.evo_go_base_url) || DEFAULT_EVO_GO_BASE_URL
  const token = (tm.evo_go_instance_token ?? '').trim()
  if (!token) return { state: 'unconfigured', http: 0, detail: 'sem token' }
  try {
    const r = await fetch(`${base}/instance/status`, { headers: { apikey: token }, signal: AbortSignal.timeout(8000) })
    const txt = await r.text().catch(() => '')
    let state = 'close'
    try {
      const j = JSON.parse(txt)
      if (j?.data?.Connected === true && j?.data?.LoggedIn === true) state = 'open'
      else if (j?.data?.Connected === true) state = 'connecting'
    } catch { /* ignore */ }
    return { state: r.ok ? state : 'error', http: r.status, detail: r.ok ? null : txt.slice(0, 160) }
  } catch (e) {
    return { state: 'error', http: 0, detail: String((e as Error).message) }
  }
}

async function sendEvolutionText(base: string, instance: string, key: string, number: string, text: string) {
  const r = await fetch(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ number, text }),
    signal: AbortSignal.timeout(45_000),
  })
  const txt = await r.text().catch(() => '')
  return { ok: r.ok, http: r.status, body: txt.slice(0, 240) }
}

async function sendEvoGoText(base: string, token: string, jid: string, text: string) {
  const r = await fetch(`${base}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: token },
    body: JSON.stringify({ number: jid, text }),
    signal: AbortSignal.timeout(45_000),
  })
  const txt = await r.text().catch(() => '')
  return { ok: r.ok, http: r.status, body: txt.slice(0, 240) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({} as any))

  const send: boolean = body.send === true                 // false = só diagnóstico
  const directTo: string | null = body.direct_to ?? null   // número individual de teste
  const groupJids: Record<string, string> = body.group_jids ?? {} // { instancia: jid }
  const onlyInstance: string | null = body.instance_name ?? null
  const text: string = body.text ?? `🧪 Teste SmartOps de roteamento WhatsApp — ${new Date().toISOString()}`

  const { data: rows, error } = await supabase
    .from('team_members')
    .select(`${WA_PROVIDER_COLUMNS}, ativo, role`)
    .not('evolution_instance_name', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1 teste por instância (o membro com mais credenciais representa a instância)
  const byInstance = new Map<string, any>()
  for (const tm of (rows ?? []) as any[]) {
    const inst = (tm.evolution_instance_name ?? '').trim()
    if (!inst) continue
    if (onlyInstance && inst !== onlyInstance) continue
    const score = (tm.evolution_api_key ? 2 : 0) + (tm.evo_go_instance_token ? 2 : 0) + (tm.ativo ? 1 : 0)
    const cur = byInstance.get(inst)
    if (!cur || score > cur.__score) byInstance.set(inst, { ...tm, __score: score })
  }

  const results: any[] = []

  for (const tm of byInstance.values()) {
    const instance = tm.evolution_instance_name as string
    const [evo, go] = await Promise.all([probeEvolution(tm), probeEvoGo(tm)])
    const nowIso = new Date().toISOString()

    const evoStatus = evo.state === 'open' ? 'connected' : evo.state
    const goStatus = go.state === 'open' ? 'connected' : go.state

    await supabase.from('team_members').update({
      evolution_status: evoStatus,
      evolution_last_check_at: nowIso,
      evo_go_status: goStatus,
      evo_go_last_check_at: nowIso,
    }).eq('evolution_instance_name', instance)

    // reflete o status recém-medido antes de rodar o router
    const fresh: WaTeamMember = { ...tm, evolution_status: evoStatus, evo_go_status: goStatus }

    const entry: any = {
      instance,
      owner: tm.nome_completo,
      ativo: tm.ativo,
      evolution: { enabled: tm.evolution_enabled === true, ...evo },
      evolution_go: { enabled: tm.evo_go_enabled === true, ...go },
      dual_mode: isDualMode(fresh),
      routing: {},
      sends: {},
    }

    for (const op of ['direct_message', 'group_message'] as const) {
      try {
        const r = resolveProvider(fresh, op)
        entry.routing[op] = describeProvider(r)
      } catch (e) {
        entry.routing[op] = e instanceof WaProviderBlockedError
          ? { blocked_provider: e.blockedProvider, reason: e.reason }
          : { error: String((e as Error).message) }
      }
    }

    if (send && directTo) {
      try {
        const r = resolveProvider(fresh, 'direct_message')
        const number = directTo.replace(/\D/g, '')
        const res = r.provider === 'evolution'
          ? await sendEvolutionText(r.baseUrl, r.instance, r.credential, number, `${text}\n(individual • ${instance})`)
          : await sendEvoGoText(r.baseUrl, r.credential, `${number}@s.whatsapp.net`, `${text}\n(individual • ${instance})`)
        entry.sends.direct = { provider: r.provider, ...res }
      } catch (e) {
        entry.sends.direct = { blocked: String((e as Error).message) }
      }
    }

    const jid = groupJids[instance]
    if (send && jid) {
      try {
        const r = resolveProvider(fresh, 'group_message')
        const res = r.provider === 'evolution_go'
          ? await sendEvoGoText(r.baseUrl, r.credential, jid, `${text}\n(grupo • ${instance})`)
          : await sendEvolutionText(r.baseUrl, r.instance, r.credential, jid, `${text}\n(grupo • ${instance})`)
        entry.sends.group = { provider: r.provider, jid, ...res }
      } catch (e) {
        entry.sends.group = { jid, blocked: String((e as Error).message) }
      }
    }

    console.log(`[wa-selftest] ${JSON.stringify({ instance, evo: evoStatus, go: goStatus, dual: entry.dual_mode })}`)
    results.push(entry)
  }

  return new Response(JSON.stringify({ ok: true, send, instances: results.length, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
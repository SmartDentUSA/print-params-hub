// supabase/functions/wa-sync-groups/index.ts
// Sync manual de grupos WhatsApp via Evolution API.
// Body opcional: { instance_name?: string }
//   - sem body → lista todas as instâncias conectadas e sincroniza cada uma
//   - com instance_name → sincroniza só aquela

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchAdminGroups, fetchInstances, EVO_INST, corsHeaders, WaInstanceInfo, OwnerHints } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    let body: { instance_name?: string; list_only?: boolean } = {}
    if (req.method === 'POST') {
      try { body = await req.json() } catch { body = {} }
    }

    // Discover instances
    let instances: WaInstanceInfo[]
    try {
      instances = await fetchInstances()
    } catch (e) {
      // Fallback to single legacy instance if discovery fails
      console.warn('[wa-sync-groups] fetchInstances failed, falling back to EVO_INST', e)
      instances = [{ instanceName: EVO_INST, connectionStatus: 'open' }]
    }

    const connected = instances.filter(i => i.connectionStatus === 'open')

    // Merge instâncias cadastradas em team_members (fonte da verdade interna).
    // Cada instância pode ter sua própria apikey (token) — o servidor Evolution
    // não usa uma única "global key": cada instância tem token próprio.
    const { data: tmAll } = await supabase
      .from('team_members')
      .select('evolution_instance_name, evolution_phone, evolution_api_key, nome_completo, ativo')
      .eq('ativo', true)
      .not('evolution_instance_name', 'is', null)
    const tmInstances: WaInstanceInfo[] = []
    const tmPhones = new Map<string, string>()
    const apikeyByInstance = new Map<string, string>()
    for (const r of (tmAll ?? []) as any[]) {
      const name = String(r.evolution_instance_name ?? '').trim()
      const phone = String(r.evolution_phone ?? '').replace(/\D/g, '')
      const apikey = String(r.evolution_api_key ?? '').trim()
      if (!name) continue
      if (phone && !tmPhones.has(name)) tmPhones.set(name, phone)
      if (apikey && !apikeyByInstance.has(name)) apikeyByInstance.set(name, apikey)
      if (!instances.some(i => i.instanceName === name)) {
        tmInstances.push({
          instanceName: name,
          connectionStatus: 'unknown',
          owner: phone ? `${phone}@s.whatsapp.net` : undefined,
          profileName: r.nome_completo ?? undefined,
        })
      }
    }

    // Descobre status real de cada instância usando o apikey próprio dela
    // (apenas Dra. Lia aparece em fetchInstances com a key global).
    for (const [name, apikey] of apikeyByInstance) {
      if (instances.some(i => i.instanceName === name && i.connectionStatus === 'open')) continue
      try {
        const live = await fetchInstances(apikey)
        const found = live.find(i => i.instanceName === name)
        if (!found) continue
        const idx = tmInstances.findIndex(i => i.instanceName === name)
        if (idx >= 0) {
          tmInstances[idx] = { ...tmInstances[idx], ...found }
        } else {
          const evoIdx = instances.findIndex(i => i.instanceName === name)
          if (evoIdx >= 0) instances[evoIdx] = { ...instances[evoIdx], ...found }
          else instances.push(found)
        }
      } catch (e) {
        console.warn(`[wa-sync-groups] fetchInstances(${name}) com apikey própria falhou:`, e instanceof Error ? e.message : String(e))
      }
    }

    // Lista combinada exposta na resposta (UI)
    const combinedInstances = [...instances, ...tmInstances]

    // list_only: apenas devolve as instâncias descobertas (sem sincronizar grupos)
    if (body.list_only) {
      return Response.json({
        ok: true, synced: 0, instances: combinedInstances, per_instance: {},
      }, { headers: corsHeaders })
    }

    // Filter to target instance if requested.
    // Se a instância pedida não estiver em "connected", tenta usá-la mesmo assim
    // contanto que conste em team_members ou venha do próprio Evolution.
    let targets: WaInstanceInfo[]
    if (body.instance_name) {
      const fromEvo = instances.find(i => i.instanceName === body.instance_name)
      const fromTm  = tmInstances.find(i => i.instanceName === body.instance_name)
      const picked = fromEvo ?? fromTm
      targets = picked ? [picked] : []
    } else {
      targets = connected
    }

    if (targets.length === 0) {
      return Response.json({
        ok: true, synced: 0, instances: combinedInstances,
        warning: body.instance_name
          ? `Instância "${body.instance_name}" não encontrada (Evolution + team_members).`
          : 'Nenhuma instância conectada.',
      }, { headers: corsHeaders })
    }

    const per_instance: Record<string, { synced: number; groups: string[]; error?: string }> = {}
    let totalSynced = 0
    // Fallback de telefone vem do tmPhones acima
    const phoneByInstance = tmPhones

    for (const inst of targets) {
      try {
        const tmPhone = phoneByInstance.get(inst.instanceName)
        const ownerJid = inst.owner ?? (tmPhone ? `${tmPhone}@s.whatsapp.net` : undefined)
        const ownerDigits = (inst.owner ?? '').replace(/\D/g, '')
        const phone = ownerDigits || tmPhone || undefined
        const hints: OwnerHints = { jid: ownerJid, phone }
        const apikey = apikeyByInstance.get(inst.instanceName)
        console.log(`[wa-sync-groups] ${inst.instanceName}: hints jid=${ownerJid ?? '-'} phone=${phone ?? '-'} apikey=${apikey ? 'own' : 'global'}`)
        const groups = await fetchAdminGroups(inst.instanceName, hints, apikey)
        console.log(`[wa-sync-groups] ${inst.instanceName}: ${groups.length} grupos admin`)

        if (groups.length > 0) {
          const rows = groups.map(g => ({
            group_jid:     g.id,
            name:          g.subject,
            description:   g.desc ?? null,
            member_count:  g.size ?? g.participants?.length ?? 0,
            instance_name: inst.instanceName,
            is_admin:      true,
            synced_at:     new Date().toISOString(),
          }))
          const { error } = await supabase.from('wa_groups').upsert(rows, { onConflict: 'group_jid' })
          if (error) throw error

          const jids = groups.map(g => g.id)
          await supabase.from('wa_groups')
            .update({ is_admin: false, synced_at: new Date().toISOString() })
            .eq('instance_name', inst.instanceName)
            .not('group_jid', 'in', `(${jids.map(j => `"${j}"`).join(',')})`)
        }

        per_instance[inst.instanceName] = { synced: groups.length, groups: groups.map(g => g.subject) }
        totalSynced += groups.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[wa-sync-groups] ${inst.instanceName} falhou:`, msg)
        per_instance[inst.instanceName] = { synced: 0, groups: [], error: msg }
      }
    }

    return Response.json({
      ok:        true,
      synced:    totalSynced,
      instances: combinedInstances,
      per_instance,
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('[wa-sync-groups] ERRO:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    )
  }
})
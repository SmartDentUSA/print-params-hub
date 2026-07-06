// supabase/functions/wa-sync-groups/index.ts
// Sync manual de grupos WhatsApp via Evolution API.
// Body opcional: { instance_name?: string }
//   - sem body → lista todas as instâncias conectadas e sincroniza cada uma
//   - com instance_name → sincroniza só aquela

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchGroupsWithAdminFlag,
  fetchGroupsWithAdminFlagFor,
  fetchInstances,
  fetchInstancesFor,
  EVO_BASE,
  EVO_KEY,
  EVO_INST,
  corsHeaders,
  WaInstanceInfo,
  OwnerHints,
  EvoTarget,
} from '../_shared/evolution.ts'

const EVOGO_DEFAULT_BASE = 'http://82.25.75.61:8081'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type GroupWithAdminFlag = Awaited<ReturnType<typeof fetchGroupsWithAdminFlag>>[number]

const digitsOf = (s?: string) => (s ?? '').replace(/\D/g, '')

function normalizeLid(value: unknown): string | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (raw.endsWith('@lid')) return raw
  const digits = digitsOf(raw)
  return digits ? `${digits}@lid` : undefined
}

function isAdminValue(value: unknown): boolean {
  return value === 'admin' || value === 'superadmin' || value === true
}

function recalculateAdminFlag(groups: GroupWithAdminFlag[], hints: OwnerHints): GroupWithAdminFlag[] {
  const lid = normalizeLid(hints.lid)
  const jid = hints.jid
  const phoneDigits = digitsOf(hints.phone)

  return groups.map(g => {
    let isAdmin = false
    if (jid && (g.owner === jid || g.subjectOwner === jid)) isAdmin = true
    if (!isAdmin && lid && (g.owner === lid || g.subjectOwner === lid)) isAdmin = true
    if (!isAdmin && phoneDigits) {
      const ownerDigits = digitsOf(g.owner || g.subjectOwner)
      if (ownerDigits && ownerDigits.startsWith(phoneDigits)) isAdmin = true
    }
    if (!isAdmin) {
      isAdmin = g.participants?.some(p => {
        if (!isAdminValue((p as any).admin)) return false
        if (lid && p.id === lid) return true
        if (jid && p.id === jid) return true
        if (phoneDigits) {
          const participantDigits = digitsOf(p.id)
          if (participantDigits && participantDigits.startsWith(phoneDigits)) return true
        }
        return false
      }) ?? false
    }
    return { ...g, isAdmin }
  })
}

function discoverLikelyAdminLid(groups: GroupWithAdminFlag[]): { lid: string; count: number; confidence: number } | null {
  const counts = new Map<string, number>()
  for (const g of groups) {
    const lidsInGroup = new Set<string>()
    for (const ownerLike of [g.owner, g.subjectOwner]) {
      const lid = normalizeLid(ownerLike)
      if (lid && String(ownerLike).endsWith('@lid')) lidsInGroup.add(lid)
    }
    for (const p of g.participants ?? []) {
      if (!isAdminValue((p as any).admin)) continue
      const lid = normalizeLid(p.id)
      if (lid && p.id.endsWith('@lid')) lidsInGroup.add(lid)
    }
    for (const lid of lidsInGroup) counts.set(lid, (counts.get(lid) ?? 0) + 1)
  }

  let best: { lid: string; count: number } | null = null
  for (const [lid, count] of counts) {
    if (!best || count > best.count) best = { lid, count }
  }
  if (!best) return null

  const confidence = groups.length > 0 ? best.count / groups.length : 0
  const minimum = Math.max(3, Math.ceil(groups.length * 0.05))
  return best.count >= minimum ? { ...best, confidence } : null
}

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
      .select('evolution_instance_name, evolution_phone, evolution_api_key, evolution_lid, nome_completo, ativo, messaging_provider, evo_go_base_url, evo_go_instance_id, evo_go_instance_token')
      .eq('ativo', true)
      .not('evolution_instance_name', 'is', null)
    const tmInstances: WaInstanceInfo[] = []
    const tmPhones = new Map<string, string>()
    const tmLids = new Map<string, string>()
    const apikeyByInstance = new Map<string, string>()
    // Roteamento per-membro: cada instância aponta pro servidor certo (Evolution ou EvoGo)
    const targetByInstance = new Map<string, EvoTarget>()
    const providerByInstance = new Map<string, string>()
    for (const r of (tmAll ?? []) as any[]) {
      const name = String(r.evolution_instance_name ?? '').trim()
      const phone = String(r.evolution_phone ?? '').replace(/\D/g, '')
      const lid = normalizeLid(r.evolution_lid)
      const apikey = String(r.evolution_api_key ?? '').trim()
      if (!name) continue
      if (phone && !tmPhones.has(name)) tmPhones.set(name, phone)
      if (lid && !tmLids.has(name)) tmLids.set(name, lid)
      if (apikey && !apikeyByInstance.has(name)) apikeyByInstance.set(name, apikey)

      // Decide o target por linha. Regra de prioridade quando várias linhas
      // compartilham o mesmo evolution_instance_name (caso Danilo-Henrique):
      //   1) linha com messaging_provider='evolution_go' + creds EvoGo → SEMPRE vence
      //   2) linhas 'evolution' só ganham se ainda não houver target
      const provider = String(r.messaging_provider ?? '').trim()
      const evoGoInstance = String(r.evo_go_instance_id ?? '').trim()
      const evoGoToken = String(r.evo_go_instance_token ?? '').trim()
      const evoGoBase = String(r.evo_go_base_url ?? '').trim() || EVOGO_DEFAULT_BASE
      const isEvoGoRow = provider === 'evolution_go' && !!evoGoInstance && !!evoGoToken
      const currentProvider = providerByInstance.get(name)
      if (provider === 'evolution_go' && evoGoInstance && evoGoToken) {
        // EvoGo sobrescreve qualquer target Evolution registrado antes
        targetByInstance.set(name, { baseUrl: evoGoBase, instance: evoGoInstance, apikey: evoGoToken })
        providerByInstance.set(name, 'evolution_go')
        if (apikey) apikeyByInstance.set(name, evoGoToken)
        else apikeyByInstance.set(name, evoGoToken)
        console.log(`[wa-sync-groups] target ${name}: EvoGo winner (row=${r.nome_completo ?? '-'})`)
      } else if (currentProvider !== 'evolution_go') {
        // Só grava Evolution se nenhuma linha EvoGo tiver vencido antes
        targetByInstance.set(name, { baseUrl: EVO_BASE, instance: name, apikey: apikey || EVO_KEY })
        providerByInstance.set(name, 'evolution')
      }
      void isEvoGoRow

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
    for (const [name, target] of targetByInstance) {
      if (instances.some(i => i.instanceName === name && i.connectionStatus === 'open')) continue
      try {
        const live = await fetchInstancesFor(target)
        // No EvoGo o "instanceName" retornado pode ser o UUID (target.instance); casamos por qualquer um.
        const found = live.find(i => i.instanceName === name || i.instanceName === target.instance)
        if (!found) continue
        // Preserva o nome canônico (evolution_instance_name) para a UI/DB
        const normalized: WaInstanceInfo = { ...found, instanceName: name }
        const idx = tmInstances.findIndex(i => i.instanceName === name)
        if (idx >= 0) {
          tmInstances[idx] = { ...tmInstances[idx], ...normalized }
        } else {
          const evoIdx = instances.findIndex(i => i.instanceName === name)
          if (evoIdx >= 0) instances[evoIdx] = { ...instances[evoIdx], ...normalized }
          else instances.push(normalized)
        }
      } catch (e) {
        console.warn(`[wa-sync-groups] fetchInstancesFor(${name}) provider=${providerByInstance.get(name)} base=${target.baseUrl} falhou:`, e instanceof Error ? e.message : String(e))
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

    const per_instance: Record<string, { synced: number; raw: number; admin: number; groups: string[]; error?: string; warning?: string; lid?: string; lid_confidence?: number }> = {}
    let totalSynced = 0
    // Fallback de telefone vem do tmPhones acima
    const phoneByInstance = tmPhones
    const lidByInstance = tmLids

    const processInstance = async (inst: WaInstanceInfo) => {
      try {
        const tmPhone = phoneByInstance.get(inst.instanceName)
        const ownerJid = inst.owner ?? (tmPhone ? `${tmPhone}@s.whatsapp.net` : undefined)
        const ownerDigits = (inst.owner ?? '').replace(/\D/g, '')
        const phone = ownerDigits || tmPhone || undefined
        const storedLid = lidByInstance.get(inst.instanceName)
        const hints: OwnerHints = { jid: ownerJid, phone, lid: storedLid }
        const target = targetByInstance.get(inst.instanceName) ?? {
          baseUrl: EVO_BASE,
          instance: inst.instanceName,
          apikey: apikeyByInstance.get(inst.instanceName) || EVO_KEY,
        }
        const provider = providerByInstance.get(inst.instanceName) ?? 'evolution'
        console.log(`[wa-sync-groups] ${inst.instanceName}: provider=${provider} base=${target.baseUrl} instance_path=${target.instance} hints jid=${ownerJid ?? '-'} phone=${phone ?? '-'} lid=${storedLid ?? '-'}`)
        let all = await fetchGroupsWithAdminFlagFor(target, hints)
        let activeLid = storedLid
        let lidConfidence = storedLid ? 1 : 0
        let discoveredLid: string | undefined
        if (!activeLid && all.length > 0) {
          const discovery = discoverLikelyAdminLid(all)
          discoveredLid = discovery?.lid
          lidConfidence = discovery?.confidence ?? 0
          if (discovery) {
            console.log(`[wa-sync-groups] ${inst.instanceName}: LID candidato ${discovery.lid} em ${discovery.count}/${all.length} grupos (${Math.round(discovery.confidence * 100)}%)`)
          } else {
            console.warn(`[wa-sync-groups] ${inst.instanceName}: nenhum LID admin confiável encontrado`)
          }
          activeLid = discoveredLid
        }
        if (activeLid) {
          all = recalculateAdminFlag(all, { ...hints, lid: activeLid })
        }
        const adminCount = all.filter(g => g.isAdmin).length
        if (discoveredLid && phone) {
          const { error: lidUpdateError } = await supabase
            .from('team_members')
            .update({ evolution_lid: discoveredLid })
            .eq('evolution_instance_name', inst.instanceName)
            .eq('evolution_phone', phone)
          if (lidUpdateError) {
            console.warn(`[wa-sync-groups] ${inst.instanceName}: falha ao persistir evolution_lid ${discoveredLid}:`, lidUpdateError.message)
          } else {
            lidByInstance.set(inst.instanceName, discoveredLid)
            console.log(`[wa-sync-groups] ${inst.instanceName}: evolution_lid persistido (${discoveredLid})`)
          }
        }
        const isExplicitInstance = !!body.instance_name && body.instance_name === inst.instanceName
        // Quando o usuário seleciona explicitamente uma instância, sincronizamos
        // TODOS os grupos retornados pelo Evolution (o endpoint já está escopado
        // a essa instância) — o flag `is_admin` reflete a melhor detecção.
        // No modo automático (sem instance_name) mantemos o comportamento legado:
        // só persistimos onde detectamos admin para evitar lixo na tabela.
        const groupsToSync = isExplicitInstance ? all : all.filter(g => g.isAdmin)
        let warning: string | undefined
        if (isExplicitInstance && adminCount === 0 && all.length > 0) {
          warning = `Nenhum grupo foi detectado como admin (owner/LID/phone não bateram). Sincronizando ${all.length} grupos com is_admin=false. Verifique se o número ${phone ?? '-'} é admin nos grupos.`
          console.warn(`[wa-sync-groups] ${inst.instanceName}: ${warning}`)
        }
        console.log(`[wa-sync-groups] ${inst.instanceName}: ${all.length} grupos brutos, ${adminCount} admin, ${groupsToSync.length} a sincronizar`)

        if (groupsToSync.length > 0) {
          const syncedAt = new Date().toISOString()
          const rows = groupsToSync.map(g => ({
            group_jid:     g.id,
            name:          g.subject,
            description:   g.desc ?? null,
            member_count:  g.size ?? g.participants?.length ?? 0,
            instance_name: inst.instanceName,
            is_admin:      g.isAdmin,
            synced_at:     syncedAt,
          }))
          // Batch upserts para não estourar payload/CPU em instâncias grandes (400+ grupos).
          const BATCH = 100
          for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH)
            const { error } = await supabase
              .from('wa_groups')
              .upsert(chunk, { onConflict: 'group_jid' })
            if (error) throw error
          }

          // Marca grupos órfãos (não retornados nesta sync) como não-admin,
          // usando cutoff de synced_at para evitar query NOT IN gigante.
          await supabase.from('wa_groups')
            .update({ is_admin: false })
            .eq('instance_name', inst.instanceName)
            .lt('synced_at', syncedAt)
            .eq('is_admin', true)
        }

        per_instance[inst.instanceName] = {
          synced: groupsToSync.length,
          raw:    all.length,
          admin:  adminCount,
          ...(activeLid ? { lid: activeLid, lid_confidence: lidConfidence } : {}),
          groups: groupsToSync.map(g => g.subject),
          ...(warning ? { warning } : {}),
        }
        totalSynced += groupsToSync.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[wa-sync-groups] ${inst.instanceName} falhou:`, msg)
        per_instance[inst.instanceName] = { synced: 0, raw: 0, admin: 0, groups: [], error: msg }
      }
    }

    const job = (async () => {
      for (const inst of targets) {
        await processInstance(inst)
      }
    })()

    // Continua processando em background — Evolution pode demorar minutos.
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(job) } catch (_) { /* noop */ }

    return Response.json({
      ok:        true,
      started:   true,
      synced:    0,
      instances: combinedInstances,
      targets:   targets.map(t => t.instanceName),
      per_instance,
      message:   `Sincronização iniciada em background para ${targets.length} instância(s). A lista atualizará automaticamente.`,
    }, { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('[wa-sync-groups] ERRO:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    )
  }
})
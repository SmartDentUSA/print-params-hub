// supabase/functions/wa-sync-groups/index.ts
// Sync manual de grupos WhatsApp via Evolution API.
// Body opcional: { instance_name?: string }
//   - sem body → lista todas as instâncias conectadas e sincroniza cada uma
//   - com instance_name → sincroniza só aquela

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchAdminGroups, fetchInstances, EVO_INST, corsHeaders, WaInstanceInfo } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    let body: { instance_name?: string } = {}
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

    // Filter to target instance if requested
    const targets = body.instance_name
      ? connected.filter(i => i.instanceName === body.instance_name)
      : connected

    if (targets.length === 0) {
      return Response.json({
        ok: true, synced: 0, instances,
        warning: body.instance_name
          ? `Instância "${body.instance_name}" não está conectada.`
          : 'Nenhuma instância conectada.',
      }, { headers: corsHeaders })
    }

    const per_instance: Record<string, { synced: number; groups: string[]; error?: string }> = {}
    let totalSynced = 0

    for (const inst of targets) {
      try {
        const groups = await fetchAdminGroups(inst.instanceName)
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
      instances,
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
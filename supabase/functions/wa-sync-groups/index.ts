// supabase/functions/wa-sync-groups/index.ts
// Sync manual de grupos WhatsApp via Evolution API.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchAdminGroups, EVO_INST, corsHeaders } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    console.log('[wa-sync-groups] Iniciando sync manual...')
    const groups = await fetchAdminGroups()
    console.log(`[wa-sync-groups] ${groups.length} grupos admin encontrados`)

    if (groups.length === 0) {
      return Response.json({
        ok: true, synced: 0,
        warning: `Nenhum grupo onde ${EVO_INST} (5516981158403) é admin. Verifique se a instância está conectada.`,
      }, { headers: corsHeaders })
    }

    const rows = groups.map(g => ({
      group_jid:     g.id,
      name:          g.subject,
      description:   g.desc ?? null,
      member_count:  g.size ?? g.participants?.length ?? 0,
      instance_name: EVO_INST,
      is_admin:      true,
      synced_at:     new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('wa_groups')
      .upsert(rows, { onConflict: 'group_jid' })

    if (error) throw error

    const jids = groups.map(g => g.id)
    if (jids.length > 0) {
      await supabase
        .from('wa_groups')
        .update({ is_admin: false, synced_at: new Date().toISOString() })
        .eq('instance_name', EVO_INST)
        .not('group_jid', 'in', `(${jids.map(j => `"${j}"`).join(',')})`)
    }

    return Response.json({
      ok:     true,
      synced: groups.length,
      groups: groups.map(g => ({
        jid:     g.id,
        name:    g.subject,
        members: g.size ?? g.participants?.length ?? 0,
      })),
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('[wa-sync-groups] ERRO:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    )
  }
})
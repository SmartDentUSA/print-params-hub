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
  allow_duplicate?: boolean
  dedupe_window_days?: number
}

function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}'
}

async function md5Hex(s: string): Promise<string> {
  // Web Crypto não tem MD5; usa SHA-256 e pega primeiros 32 chars (compatível com nosso uso de hash)
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
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

  // ===== DEDUPE GLOBAL POR (group_jid + content_hash) =====
  const contentHash = await md5Hex(`${body.message_type}|${canonicalJson(body.content)}`)
  const windowDays = Math.max(1, body.dedupe_window_days ?? 30)
  const skippedDuplicates: { group_jid: string; name: string; last_sent_at: string | null }[] = []
  let dedupedEligible = eligible

  if (!body.allow_duplicate) {
    const jids = eligible.map(g => g.group_jid)
    const { data: fps } = await supabase
      .from('wa_group_sent_fingerprints')
      .select('group_jid, last_sent_at')
      .eq('content_hash', contentHash)
      .in('group_jid', jids)
      .gt('last_sent_at', new Date(Date.now() - windowDays * 86_400_000).toISOString())
    const blocked = new Map<string, string>((fps ?? []).map((r: any) => [r.group_jid, r.last_sent_at]))
    if (blocked.size > 0) {
      for (const g of eligible) {
        if (blocked.has(g.group_jid)) {
          skippedDuplicates.push({ group_jid: g.group_jid, name: g.name, last_sent_at: blocked.get(g.group_jid) ?? null })
        }
      }
      dedupedEligible = eligible.filter(g => !blocked.has(g.group_jid))
    }
  }

  if (dedupedEligible.length === 0) {
    return Response.json({
      ok: false,
      error: 'duplicate_blocked',
      message: 'Todos os grupos selecionados já receberam esta mensagem dentro da janela de dedupe.',
      skipped_duplicates: skippedDuplicates,
      content_hash: contentHash,
      dedupe_window_days: windowDays,
    }, { status: 409, headers: corsHeaders })
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
      dedupe_window_days: windowDays,
    })
    .select('id')
    .single()

  if (ce || !camp) {
    return Response.json({ ok: false, error: ce?.message ?? 'falha ao criar campanha' }, { status: 500, headers: corsHeaders })
  }

  const cid = camp.id

  // Junction rows
  const links = dedupedEligible.map(g => ({ campaign_id: cid, group_id: g.id }))
  const { error: le } = await supabase.from('wa_campaign_groups').insert(links)
  if (le) {
    await supabase.from('wa_campaigns').delete().eq('id', cid)
    return Response.json({ ok: false, error: le.message }, { status: 500, headers: corsHeaders })
  }

  // Queue rows
  const queueRows = dedupedEligible.map(g => ({
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
  for (const g of dedupedEligible) {
    await supabase.from('wa_groups')
      .update({ active_campaign_id: cid })
      .eq('id', g.id)
      .is('active_campaign_id', null)
  }

  console.log(`[wa-group-blast] campaign ${cid}: ${dedupedEligible.length} grupos enfileirados, ${skippedDuplicates.length} bloqueados por dedupe (hash=${contentHash}, janela=${windowDays}d)`)

  return Response.json({
    ok:          true,
    campaign_id: cid,
    groups:      dedupedEligible.length,
    queued:      queueRows.length,
    first_send:  scheduledAt.toISOString(),
    content_hash:       contentHash,
    dedupe_window_days: windowDays,
    skipped_duplicates: skippedDuplicates,
    forced_duplicate:   !!body.allow_duplicate,
  }, { headers: corsHeaders })
})
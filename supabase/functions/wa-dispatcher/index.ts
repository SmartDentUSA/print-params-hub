// wa-dispatcher v66-evogo — EvoGo suporte completo (button/list/carousel/media)
// ATENCAO: este arquivo e gerenciado manualmente, nao sobrescrever via Lovable auto-deploy
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendText, sendMedia, sleep, corsHeaders, findMessageStatus, mapBaileysStatus, warmupGroup, resolveApiKey, GLOBAL_EVOLUTION_KEY } from '../_shared/evolution.ts'
import { spDateTimeToUtc, spWeekday, spStartOfDay, addDaysSp } from '../_shared/timezone.ts'
import { resolveAiContent } from '../_shared/wa-ai-content.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_PER_RUN      = 5

async function evoGoPost(path: string, body: Record<string, unknown>, baseUrl: string, token: string, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: token }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) { const t = await res.text(); if (res.status === 404) throw new Error(`ENDPOINT_NOT_FOUND:${path}`); throw new Error(`${path} ${res.status}: ${t}`) }
  return await res.json()
}
function evoGoId(d: Record<string, unknown>): string | null { return (d as any)?.data?.Info?.ID ?? (d as any)?.key?.id ?? null }
async function sendTextEvoGo(jid: string, text: string, base: string, token: string): Promise<string | null> { return evoGoId(await evoGoPost('/send/text', { number: jid, text }, base, token)) }
async function sendMediaEvoGo(jid: string, type: 'image'|'video'|'audio'|'document', url: string, caption: string, fileName: string | null, base: string, token: string): Promise<string | null> {
  const body: Record<string, unknown> = { number: jid, type, url, caption: caption ?? '' }
  if (fileName) body.filename = fileName
  return evoGoId(await evoGoPost('/send/media', body, base, token, 60_000))
}
async function sendButtonEvoGo(jid: string, cfg: Record<string, unknown>, base: string, token: string): Promise<string | null> {
  const f = (cfg.footer as string)?.trim() || 'Smart Dent'
  return evoGoId(await evoGoPost('/send/button', { number: jid, title: cfg.title ?? '', footer: f, buttons: cfg.buttons ?? [] }, base, token))
}
async function sendListEvoGo(jid: string, cfg: Record<string, unknown>, base: string, token: string): Promise<string | null> {
  const f = (cfg.footer as string)?.trim() || 'Smart Dent'
  let ri = 0
  const sections = ((cfg.sections ?? []) as any[]).map((s: any) => ({ title: (s.title ?? '').substring(0, 24), rows: (s.rows ?? []).map((row: any) => ({ rowId: `row${ri++}`, title: (row.title ?? '').substring(0, 24), description: (row.description ?? '').substring(0, 72) })) }))
  return evoGoId(await evoGoPost('/send/list', { number: jid, title: (cfg.title as string)?.substring(0, 60) ?? '', description: cfg.description ?? '', footer: f, buttonText: (cfg.buttonText as string)?.substring(0, 20) ?? 'Ver opcoes', sections, listType: 'SINGLE_SELECT' }, base, token))
}
async function sendCarouselEvoGo(jid: string, cfg: Record<string, unknown>, base: string, token: string): Promise<string | null> {
  const cards = ((cfg.cards ?? []) as any[]).map((card: any) => ({ body: typeof card.body === 'string' ? { text: card.body } : (card.body ?? { text: '' }), header: card.image ? { imageUrl: card.image } : (card.header ?? undefined), footer: card.footer ? (typeof card.footer === 'string' ? { text: card.footer } : card.footer) : undefined, buttons: (card.buttons ?? []).map((btn: any) => ({ id: btn.id ?? String(Math.random()), type: btn.type ?? 'reply', title: btn.title ?? '' })) }))
  return evoGoId(await evoGoPost('/send/carousel', { number: jid, cards }, base, token))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const results: { id: string; status: string; error?: string }[] = []
  let processedCount = 0

  try {
    const { data: pending, error } = await supabase.from('wa_message_queue')
      .select(`id, campaign_id, group_jid, node_index, node_type, content_json, retry_count, evo_message_id, delivery_status, wa_campaigns!inner(delay_seconds, daily_limit, status)`)
      .eq('status', 'pending').lte('scheduled_at', new Date().toISOString()).eq('wa_campaigns.status', 'active')
      .order('scheduled_at', { ascending: true }).limit(MAX_PER_RUN)
    if (error) throw error
    if (!pending?.length) return Response.json({ ok: true, processed: 0 }, { headers: corsHeaders })

    const jids = Array.from(new Set(pending.map((p: any) => p.group_jid)))
    const { data: groupRows } = await supabase.from('wa_groups').select('group_jid, instance_name, session_health').in('group_jid', jids)
    const instanceByJid    = new Map<string, string>((groupRows ?? []).map((g: any) => [g.group_jid, g.instance_name]))
    const groupHealthByJid = new Map<string, string>((groupRows ?? []).map((g: any) => [g.group_jid, g.session_health ?? 'ok']))
    const instanceNames = Array.from(new Set((groupRows ?? []).map((g: any) => g.instance_name).filter(Boolean))) as string[]

    type TMCreds = { id: string; evolution_api_key: string|null; evolution_group_key_broken_at: string|null; evo_go_instance_token: string|null; evo_go_base_url: string|null }
    const tmByInstance = new Map<string, TMCreds>()
    if (instanceNames.length) {
      const { data: tmRows } = await supabase.from('team_members').select('id, evolution_instance_name, evolution_api_key, evolution_group_key_broken_at, evo_go_instance_token, evo_go_base_url').in('evolution_instance_name', instanceNames)
      for (const tm of tmRows ?? []) {
        if (tm.evolution_instance_name) tmByInstance.set(tm.evolution_instance_name, { id: tm.id, evolution_api_key: tm.evolution_api_key ?? null, evolution_group_key_broken_at: tm.evolution_group_key_broken_at ?? null, evo_go_instance_token: tm.evo_go_instance_token ?? null, evo_go_base_url: tm.evo_go_base_url ?? 'http://82.25.75.61:8081' })
      }
    }

    for (const item of pending) {
      const camp    = item.wa_campaigns as { delay_seconds: number; daily_limit: number }
      const delayMs = Math.max((camp.delay_seconds ?? 15) * 1000, 10_000)
      const jitter  = Math.floor(Math.random() * 5000)
      const instance   = instanceByJid.get(item.group_jid) ?? undefined
      const tm          = instance ? tmByInstance.get(instance) : undefined
      const isGroup     = item.group_jid?.endsWith('@g.us') ?? false
      const apikey      = resolveApiKey({ teamMember: tm, isGroup })
      const evoGoToken  = tm?.evo_go_instance_token ?? null
      const evoGoBase   = tm?.evo_go_base_url ?? 'http://82.25.75.61:8081'
      const useEvoGo    = !!evoGoToken

      if (isGroup && groupHealthByJid.get(item.group_jid) === 'session_broken') {
        await supabase.from('wa_message_queue').update({ status: 'blocked_session', error_message: 'Grupo bloqueado.' }).eq('id', item.id)
        results.push({ id: item.id, status: 'blocked_session' }); continue
      }
      await supabase.from('wa_message_queue').update({ status: 'sending' }).eq('id', item.id)

      try {
        if (item.evo_message_id && instance && !useEvoGo) {
          const raw = await findMessageStatus(item.group_jid, item.evo_message_id, instance, apikey)
          const mapped = mapBaileysStatus(raw)
          if (['delivered','read','sent_to_server'].includes(mapped)) {
            const now = new Date().toISOString()
            await supabase.from('wa_message_queue').update({ status: 'sent', sent_at: now, delivery_status: mapped, delivery_checked_at: now }).eq('id', item.id)
            results.push({ id: item.id, status: 'sent_dedup' }); continue
          }
        }
        if (!(await checkDailyLimit(supabase, item.campaign_id, camp.daily_limit))) { await setStatus(supabase, item.id, 'skipped', 'Limite diario'); results.push({ id: item.id, status: 'skipped' }); continue }
        const { data: cooldown } = await supabase.rpc('fn_check_group_send_cooldown', { p_group_jid: item.group_jid, p_node_index: item.node_index, p_campaign_id: item.campaign_id })
        if (cooldown === false) { await setStatus(supabase, item.id, 'skipped', 'Cooldown'); results.push({ id: item.id, status: 'skipped' }); continue }

        let evoId: string | null = null
        const c = item.content_json ?? {}

        const send = async (fnEvoGo: (() => Promise<string|null>) | null, fnApi: ((k: string) => Promise<string|null>) | null): Promise<string|null> => {
          if (useEvoGo && fnEvoGo) {
            try { return await fnEvoGo() } catch (e) { const m = e instanceof Error ? e.message : String(e); if (m.startsWith('ENDPOINT_NOT_FOUND')) throw new Error(`Tipo '${item.node_type}' nao suportado`); throw e }
          }
          if (!fnApi) throw new Error('Sem handler')
          try { return await fnApi(apikey) } catch (e) {
            const m = e instanceof Error ? e.message : String(e)
            if (/SessionError|No sessions|timed out|aborted/i.test(m) && instance) {
              await warmupGroup(item.group_jid, instance, apikey); await sleep(3000)
              try { return await fnApi(apikey) } catch (e2) {
                const m2 = e2 instanceof Error ? e2.message : String(e2)
                if (/SessionError|No sessions|timed out|aborted/i.test(m2) && isGroup && apikey !== GLOBAL_EVOLUTION_KEY && tm) {
                  try { const r = await fnApi(GLOBAL_EVOLUTION_KEY); if (!tm.evolution_group_key_broken_at) { await supabase.from('team_members').update({ evolution_group_key_broken_at: new Date().toISOString() }).eq('id', tm.id).is('evolution_group_key_broken_at', null); tm.evolution_group_key_broken_at = new Date().toISOString() }; return r } catch (e3) { throw e3 }
                }
                throw e2
              }
            }
            throw e
          }
        }

        switch (item.node_type) {
          case 'msg': {
            const txt = (c.text ?? '') as string
            if (!txt) throw new Error('Texto vazio')
            evoId = await send(useEvoGo ? () => sendTextEvoGo(item.group_jid, txt, evoGoBase, evoGoToken!) : null, (k) => sendText(item.group_jid, txt, instance, k))
            break
          }
          case 'image': case 'video': case 'audio': case 'document': {
            const mtype = item.node_type as 'image'|'video'|'audio'|'document'
            const mediaUrl = (c.media_url ?? '') as string; const caption = (c.caption ?? '') as string; const fileName = (c.file_name ?? null) as string|null
            if (!mediaUrl) throw new Error('media_url vazio')
            evoId = await send(useEvoGo ? () => sendMediaEvoGo(item.group_jid, mtype, mediaUrl, caption, fileName, evoGoBase, evoGoToken!) : null, (k) => sendMedia(item.group_jid, mtype, mediaUrl, caption, instance, k))
            break
          }
          case 'link': {
            const txt = [c.title ? `*${c.title}*` : '', c.description ? String(c.description) : '', c.url ? String(c.url) : ''].filter(Boolean).join('\n\n')
            evoId = await send(useEvoGo ? () => sendTextEvoGo(item.group_jid, txt, evoGoBase, evoGoToken!) : null, (k) => sendText(item.group_jid, txt, instance, k))
            break
          }
          case 'post_ig': case 'post_yt': {
            const cap = (c.caption ?? '') as string
            const url = (c.post_url ?? '') as string
            if (!url) throw new Error('post_url vazio')
            const txt = [cap, url].filter(Boolean).join('\n\n')
            evoId = await send(useEvoGo ? () => sendTextEvoGo(item.group_jid, txt, evoGoBase, evoGoToken!) : null, (k) => sendText(item.group_jid, txt, instance, k))
            break
          }
          case 'link_ig': case 'link_yt': {
            const cap = (c.caption ?? '') as string
            const url = (c.url ?? '') as string
            if (!url) throw new Error('url vazio')
            const txt = [cap, url].filter(Boolean).join('\n\n')
            evoId = await send(useEvoGo ? () => sendTextEvoGo(item.group_jid, txt, evoGoBase, evoGoToken!) : null, (k) => sendText(item.group_jid, txt, instance, k))
            break
          }
          case 'ai': {
            const { text: txt } = await resolveAiContent(supabase, c as any)
            evoId = await send(useEvoGo ? () => sendTextEvoGo(item.group_jid, txt, evoGoBase, evoGoToken!) : null, (k) => sendText(item.group_jid, txt, instance, k))
            await supabase.from('wa_message_queue').update({ content_json: { ...c, _resolved_text: txt } }).eq('id', item.id)
            break
          }
          case 'button': {
            if (!useEvoGo) throw new Error('button requer EvoGo')
            evoId = await sendButtonEvoGo(item.group_jid, { ...c, title: c.body ?? c.title ?? '' }, evoGoBase, evoGoToken!)
            break
          }
          case 'list': {
            if (!useEvoGo) throw new Error('list requer EvoGo')
            evoId = await sendListEvoGo(item.group_jid, { title: c.title ?? c.buttonText ?? 'Lista', description: c.body ?? c.description ?? '', footer: (c.footer as string)?.trim() || 'Smart Dent', buttonText: c.buttonText, sections: c.sections }, evoGoBase, evoGoToken!)
            break
          }
          case 'carousel': {
            if (!useEvoGo) throw new Error('carousel requer EvoGo')
            evoId = await sendCarouselEvoGo(item.group_jid, c, evoGoBase, evoGoToken!)
            break
          }
          default:
            throw new Error(`Tipo desconhecido: ${item.node_type}`)
        }

        const now = new Date().toISOString()
        await supabase.from('wa_message_queue').update({ status: 'sent', sent_at: now, evo_message_id: evoId, delivery_status: 'sent_to_server', delivery_checked_at: now }).eq('id', item.id)
        await supabase.from('wa_send_log').insert({ queue_id: item.id, campaign_id: item.campaign_id, group_jid: item.group_jid, instance_name: instance ?? 'unknown', node_type: item.node_type, success: true, http_status: 200, evo_message_id: evoId, sent_at: now })
        if (isGroup) await supabase.from('wa_groups').update({ session_health: 'ok', consecutive_send_errors: 0, last_send_error: null, last_send_error_at: null }).eq('group_jid', item.group_jid).gt('consecutive_send_errors', 0)
        await advanceCampaign(supabase, item.campaign_id, item.node_index)
        results.push({ id: item.id, status: 'sent' })
        processedCount++
        console.log(`[v66eg] OK [${item.node_type}] via ${useEvoGo ? 'EvoGo' : 'Baileys'}`)

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const retries = (item.retry_count ?? 0) + 1
        const isFinal = retries >= 3
        const isSessionError = /SessionError|No sessions/i.test(msg)
        let blockedBySession = false
        if (isGroup && isSessionError) {
          const { data: g } = await supabase.from('wa_groups').select('consecutive_send_errors').eq('group_jid', item.group_jid).maybeSingle()
          const nextCount = (g?.consecutive_send_errors ?? 0) + 1; const shouldBlock = nextCount >= 2
          await supabase.from('wa_groups').update({ consecutive_send_errors: nextCount, last_send_error: msg.slice(0, 500), last_send_error_at: new Date().toISOString(), ...(shouldBlock ? { session_health: 'session_broken' } : {}) }).eq('group_jid', item.group_jid)
          if (shouldBlock) { blockedBySession = true; await supabase.from('wa_message_queue').update({ status: 'blocked_session', error_message: 'Sessao quebrada.' }).eq('group_jid', item.group_jid).eq('status', 'pending') }
        }
        await supabase.from('wa_message_queue').update({ status: blockedBySession ? 'blocked_session' : (isFinal ? 'failed' : 'pending'), error_message: msg.slice(0, 500), retry_count: retries, ...(isFinal || blockedBySession ? {} : { scheduled_at: new Date(Date.now() + 30 * 60_000).toISOString() }) }).eq('id', item.id)
        await supabase.from('wa_send_log').insert({ queue_id: item.id, campaign_id: item.campaign_id, group_jid: item.group_jid, instance_name: instance ?? 'unknown', node_type: item.node_type, success: false, http_status: 500, error_message: msg.slice(0, 500) })
        if (isFinal) await supabase.from('wa_campaigns').update({ status: 'error' }).eq('id', item.campaign_id)
        results.push({ id: item.id, status: isFinal ? 'failed' : 'retrying', error: msg })
        console.error(`[v66eg] ERRO [${item.node_type}]: ${msg}`)
      }
      if (pending.indexOf(item) < pending.length - 1) await sleep(delayMs + jitter)
    }
    return Response.json({ ok: true, processed: results.length, results }, { headers: corsHeaders })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders })
  }
})

async function checkDailyLimit(sb: SupabaseClient, cid: string, limit: number) { return sb.from('wa_message_queue').select('id', { count: 'exact', head: true }).eq('campaign_id', cid).eq('status', 'sent').gte('sent_at', spStartOfDay().toISOString()).then(({ count }) => (count ?? 0) < limit) }
async function setStatus(sb: SupabaseClient, id: string, status: string, msg?: string) { await sb.from('wa_message_queue').update({ status, ...(msg ? { error_message: msg } : {}) }).eq('id', id) }
async function advanceCampaign(sb: SupabaseClient, cid: string, sentIdx: number) {
  const { data: c } = await sb.from('wa_campaigns').select('flow_json').eq('id', cid).single()
  if (!c) return
  const flow: Record<string, unknown>[] = c.flow_json ?? []
  const next = sentIdx + 1
  if (next >= flow.length) { await sb.from('wa_campaigns').update({ status: 'finished', finished_at: new Date().toISOString(), current_node_index: next }).eq('id', cid); return }
  const nxt = flow[next]
  if (nxt.type === 'wait') {
    const days = (nxt.days as number) ?? 1; const [hh, mm] = ((nxt.time as string) ?? '09:00').split(':').map(Number)
    let at = spDateTimeToUtc(addDaysSp(new Date(), days), hh, mm)
    if (nxt.weekdays_only) { const d = spWeekday(at); if (d === 0) at = addDaysSp(at, 1); else if (d === 6) at = addDaysSp(at, 2) }
    await sb.from('wa_campaigns').update({ current_node_index: next, next_send_at: at.toISOString() }).eq('id', cid)
    const ci = flow.findIndex((n, i) => i > next && n.type !== 'wait')
    if (ci !== -1) await sb.from('wa_message_queue').update({ scheduled_at: at.toISOString() }).eq('campaign_id', cid).eq('node_index', ci).eq('status', 'pending')
  } else { await sb.from('wa_campaigns').update({ current_node_index: next }).eq('id', cid) }
}
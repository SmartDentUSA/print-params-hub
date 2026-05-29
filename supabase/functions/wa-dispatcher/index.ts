// wa-dispatcher/index.ts — v4 FINAL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendText, sendMedia, sleep, corsHeaders, findMessageStatus, mapBaileysStatus, warmupGroup } from '../_shared/evolution.ts'
import { spDateTimeToUtc, spWeekday, spStartOfDay, addDaysSp } from '../_shared/timezone.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DEEPSEEK_KEY     = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const GEMINI_KEY       = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_AI_KEY') ?? ''
const MAX_PER_RUN      = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const startTime = Date.now()
  const results: { id: string; status: string; error?: string }[] = []
  let processedCount = 0

  try {
    const { data: pending, error } = await supabase
      .from('wa_message_queue')
      .select(`
        id, campaign_id, group_jid, node_index, node_type, content_json, retry_count, evo_message_id, delivery_status,
        wa_campaigns!inner(delay_seconds, daily_limit, status)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .eq('wa_campaigns.status', 'active')
      .order('scheduled_at', { ascending: true })
      .limit(MAX_PER_RUN)

    if (error) throw error
    if (!pending?.length) {
      return Response.json({ ok: true, processed: 0 }, { headers: corsHeaders })
    }

    // Lookup instance_name per group_jid in one shot
    const jids = Array.from(new Set(pending.map((p: any) => p.group_jid)))
    const { data: groupRows } = await supabase
      .from('wa_groups')
      .select('group_jid, instance_name')
      .in('group_jid', jids)
    const instanceByJid = new Map<string, string>(
      (groupRows ?? []).map((g: any) => [g.group_jid, g.instance_name])
    )

    // Resolve per-instance Evolution apikey (memory: Evolution Per-Instance Credentials)
    const instanceNames = Array.from(new Set(
      (groupRows ?? []).map((g: any) => g.instance_name).filter(Boolean)
    )) as string[]
    const apikeyByInstance = new Map<string, string>()
    if (instanceNames.length) {
      const { data: tmRows } = await supabase
        .from('team_members')
        .select('evolution_instance_name, evolution_api_key')
        .in('evolution_instance_name', instanceNames)
      for (const tm of tmRows ?? []) {
        if (tm.evolution_instance_name && tm.evolution_api_key) {
          apikeyByInstance.set(tm.evolution_instance_name, tm.evolution_api_key)
        }
      }
    }

    for (const item of pending) {
      const camp    = item.wa_campaigns as { delay_seconds: number; daily_limit: number }
      const delayMs = Math.max((camp.delay_seconds ?? 15) * 1000, 10_000)
      const jitter  = Math.floor(Math.random() * 5000)
      const instance = instanceByJid.get(item.group_jid) ?? undefined
      const apikey   = instance ? apikeyByInstance.get(instance) : undefined

      await supabase.from('wa_message_queue')
        .update({ status: 'sending' }).eq('id', item.id)

      console.log(`[wa-dispatcher] → send`, { queue_id: item.id, group_jid: item.group_jid, instance, node_type: item.node_type })

      try {
        // GUARDA ANTI-DUPLICAÇÃO: se já temos evo_message_id de um envio anterior,
        // confere primeiro com o Baileys antes de reenviar.
        if (item.evo_message_id && instance) {
          const raw = await findMessageStatus(item.group_jid, item.evo_message_id, instance, apikey)
          const mapped = mapBaileysStatus(raw)
          if (mapped === 'delivered' || mapped === 'read' || mapped === 'sent_to_server') {
            const now = new Date().toISOString()
            await supabase.from('wa_message_queue').update({
              status: 'sent',
              sent_at: now,
              delivery_status: mapped,
              delivery_checked_at: now,
            }).eq('id', item.id)
            results.push({ id: item.id, status: 'sent_dedup' })
            console.log(`[wa-dispatcher] ⊘ dedup ${item.id}: already ${mapped} on Evolution`)
            continue
          }
        }

        if (!(await checkDailyLimit(supabase, item.campaign_id, camp.daily_limit))) {
          await setStatus(supabase, item.id, 'skipped', 'Limite diário atingido')
          results.push({ id: item.id, status: 'skipped' })
          continue
        }

        const { data: cooldown } = await supabase
          .rpc('fn_check_group_send_cooldown', {
            p_group_jid:   item.group_jid,
            p_node_index:  item.node_index,
            p_campaign_id: item.campaign_id,
          })

        if (cooldown === false) {
          await setStatus(supabase, item.id, 'skipped', 'Cooldown anti-duplicata: mesmo nó enviado nas últimas 2h')
          results.push({ id: item.id, status: 'skipped' })
          console.warn(`[wa-dispatcher] Cooldown: ${item.group_jid} node ${item.node_index}`)
          continue
        }

        let evoId: string | null = null

        // Helper: encapsula sendText/sendMedia com retry-once + warmup em SessionError
        const sendWithSessionRetry = async (
          fn: () => Promise<string | null>,
        ): Promise<string | null> => {
          try {
            return await fn()
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e)
            if (/SessionError|No sessions/i.test(m) && instance) {
              console.warn(`[wa-dispatcher] SessionError → warmup ${item.group_jid}`)
              await warmupGroup(item.group_jid, instance, apikey)
              await sleep(3000)
              return await fn()
            }
            throw e
          }
        }

        switch (item.node_type) {
          case 'msg': {
            const txt = (item.content_json?.text ?? '') as string
            if (!txt) throw new Error('Texto vazio')
            evoId = await sendWithSessionRetry(() => sendText(item.group_jid, txt, instance, apikey))
            break
          }
          case 'image':
            evoId = await sendWithSessionRetry(() => sendMedia(item.group_jid, 'image',
              item.content_json?.media_url as string,
              (item.content_json?.caption ?? '') as string, instance, apikey))
            break
          case 'video':
            evoId = await sendWithSessionRetry(() => sendMedia(item.group_jid, 'video',
              item.content_json?.media_url as string,
              (item.content_json?.caption ?? '') as string, instance, apikey))
            break
          case 'audio':
            evoId = await sendWithSessionRetry(() => sendMedia(item.group_jid, 'audio',
              item.content_json?.media_url as string,
              (item.content_json?.caption ?? '') as string, instance, apikey))
            break
          case 'document':
            evoId = await sendWithSessionRetry(() => sendMedia(item.group_jid, 'document',
              item.content_json?.media_url as string,
              (item.content_json?.caption ?? '') as string, instance, apikey))
            break
          case 'link': {
            const c = item.content_json ?? {}
            const txt = [
              c.title       ? `*${c.title}*`        : '',
              c.description ? String(c.description) : '',
              c.url         ? String(c.url)         : '',
            ].filter(Boolean).join('\n\n')
            evoId = await sendWithSessionRetry(() => sendText(item.group_jid, txt, instance, apikey))
            break
          }
          case 'ai': {
            const txt = await resolveAIContent(supabase, item.content_json)
            evoId = await sendWithSessionRetry(() => sendText(item.group_jid, txt, instance, apikey))
            await supabase.from('wa_message_queue')
              .update({ content_json: { ...item.content_json, _resolved_text: txt } })
              .eq('id', item.id)
            break
          }
          default:
            throw new Error(`Tipo desconhecido: ${item.node_type}`)
        }

        const now = new Date().toISOString()
        await supabase.from('wa_message_queue')
          .update({
            status: 'sent',
            sent_at: now,
            evo_message_id: evoId,
            delivery_status: 'sent_to_server',
            delivery_checked_at: now,
          })
          .eq('id', item.id)

        await supabase.from('wa_send_log').insert({
          queue_id: item.id, campaign_id: item.campaign_id,
          group_jid: item.group_jid, instance_name: instance ?? 'unknown',
          node_type: item.node_type, success: true,
          http_status: 200, evo_message_id: evoId, sent_at: now,
        })

        await advanceCampaign(supabase, item.campaign_id, item.node_index)
        results.push({ id: item.id, status: 'sent' })
        processedCount++
        console.log(`[wa-dispatcher] ✓ ${item.group_jid} [${item.node_type}]`)

      } catch (err) {
        const msg     = err instanceof Error ? err.message : String(err)
        const retries = (item.retry_count ?? 0) + 1
        const isFinal = retries >= 3

        await supabase.from('wa_message_queue').update({
          status:        isFinal ? 'failed' : 'pending',
          error_message: msg.slice(0, 500),
          retry_count:   retries,
          ...(isFinal ? {} : { scheduled_at: new Date(Date.now() + 30 * 60_000).toISOString() }),
        }).eq('id', item.id)

        await supabase.from('wa_send_log').insert({
          queue_id: item.id, campaign_id: item.campaign_id,
          group_jid: item.group_jid, instance_name: instance ?? 'unknown',
          node_type: item.node_type, success: false,
          http_status: 500, error_message: msg.slice(0, 500),
        })

        try {
          await supabase.from('system_health_logs').insert({
            function_name:       'wa-dispatcher',
            severity:            isFinal ? 'warning' : 'info',
            error_type:          isFinal ? 'send_failed_final' : 'send_failed_retry',
            details: {
              queue_id:    item.id,
              group_jid:   item.group_jid,
              node_type:   item.node_type,
              retry_count: retries,
              error:       msg.slice(0, 500),
            },
            ai_suggested_action: isFinal
              ? 'Verificar instância Evolution e conectividade. Campanha marcada como error.'
              : `Retry ${retries}/3 em 30 minutos.`,
            auto_remediated: false,
            resolved:        false,
          })
        } catch (_) { /* não fatal */ }

        if (isFinal) {
          await supabase.from('wa_campaigns')
            .update({ status: 'error' }).eq('id', item.campaign_id)
        }

        results.push({ id: item.id, status: isFinal ? 'failed' : 'retrying', error: msg })
        console.error(`[wa-dispatcher] ✗ ${item.id}:`, msg)
      }

      if (pending.indexOf(item) < pending.length - 1) {
        await sleep(delayMs + jitter)
      }
    }

    if (processedCount > 0) {
      try {
        await supabase.from('system_health_logs').insert({
          function_name: 'wa-dispatcher',
          severity:      'info',
          error_type:    null,
          details: {
            processed:    processedCount,
            duration_ms:  Date.now() - startTime,
            results:      results.map(r => ({ id: r.id, status: r.status })),
          },
          auto_remediated: false,
          resolved:        true,
        })
      } catch (_) { /* não fatal */ }
    }

    return Response.json(
      { ok: true, processed: results.length, results },
      { headers: corsHeaders }
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[wa-dispatcher] CRÍTICO:', err)

    try {
      await supabase.from('system_health_logs').insert({
        function_name:       'wa-dispatcher',
        severity:            'critical',
        error_type:          'dispatcher_crash',
        details:             { error: msg, duration_ms: Date.now() - startTime },
        ai_suggested_action: 'Verificar logs do Supabase. Possível problema com DB ou configuração.',
        auto_remediated:     false,
        resolved:            false,
      })
    } catch (_) { /* ignore */ }

    return Response.json(
      { ok: false, error: msg },
      { status: 500, headers: corsHeaders }
    )
  }
})

async function checkDailyLimit(sb: SupabaseClient, cid: string, limit: number) {
  const start = spStartOfDay()
  const { count } = await sb.from('wa_message_queue')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', cid).eq('status', 'sent')
    .gte('sent_at', start.toISOString())
  return (count ?? 0) < limit
}

async function setStatus(sb: SupabaseClient, id: string, status: string, msg?: string) {
  await sb.from('wa_message_queue')
    .update({ status, ...(msg ? { error_message: msg } : {}) }).eq('id', id)
}

async function advanceCampaign(sb: SupabaseClient, cid: string, sentIdx: number) {
  const { data: c } = await sb.from('wa_campaigns')
    .select('flow_json').eq('id', cid).single()
  if (!c) return
  const flow: Record<string, unknown>[] = c.flow_json ?? []
  const next = sentIdx + 1
  if (next >= flow.length) {
    await sb.from('wa_campaigns')
      .update({ status: 'finished', finished_at: new Date().toISOString(), current_node_index: next })
      .eq('id', cid)
    return
  }
  const nxt = flow[next]
  if (nxt.type === 'wait') {
    const days = (nxt.days as number) ?? 1
    const [hh, mm] = ((nxt.time as string) ?? '09:00').split(':').map(Number)
    let at = spDateTimeToUtc(addDaysSp(new Date(), days), hh, mm)
    if (nxt.weekdays_only) {
      const d = spWeekday(at)
      if (d === 0) at = addDaysSp(at, 1)
      else if (d === 6) at = addDaysSp(at, 2)
    }
    await sb.from('wa_campaigns')
      .update({ current_node_index: next, next_send_at: at.toISOString() }).eq('id', cid)
    const ci = flow.findIndex((n, i) => i > next && n.type !== 'wait')
    if (ci !== -1) {
      await sb.from('wa_message_queue')
        .update({ scheduled_at: at.toISOString() })
        .eq('campaign_id', cid).eq('node_index', ci).eq('status', 'pending')
    }
  } else {
    await sb.from('wa_campaigns').update({ current_node_index: next }).eq('id', cid)
  }
}

async function resolveAIContent(sb: SupabaseClient, cfg: Record<string, unknown>): Promise<string> {
  const type = cfg?.ai_source_type as string
  const id   = cfg?.ai_source_id   as string
  let ctx = '', title = ''

  if (type === 'article' && id) {
    const { data } = await sb.from('knowledge_contents')
      .select('title, meta_description, excerpt, content_html').eq('id', id).single()
    if (data) {
      title = data.title
      const body = (data.content_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      ctx = `Título: ${data.title}\nResumo: ${data.excerpt ?? data.meta_description ?? ''}\n\n${body.substring(0, 1500)}`
    }
  } else if (type === 'product' && id) {
    const { data } = await sb.from('system_a_catalog')
      .select('name, description, category').eq('id', id).single()
    if (data) {
      title = data.name
      ctx = `Produto: ${data.name}\nCategoria: ${data.category}\n${(data.description ?? '').substring(0, 1000)}`
    }
  } else if (type === 'video' && id) {
    const { data } = await sb.from('knowledge_videos')
      .select('title, description').eq('id', id).single()
    if (data) {
      title = data.title
      ctx = `Vídeo: ${data.title}\n${(data.description ?? '').substring(0, 800)}`
    }
  }

  const sys = `Você é o assistente de marketing da Smart Dent (tecnologia odontológica digital, Brasil).
Crie uma mensagem para grupo de WhatsApp de dentistas e laboratórios de prótese.
Regras: máximo 280 caracteres, português, profissional, máximo 2 emojis, sem hashtags.
Sem preços (política content-generation-policy-no-prices-v2).`

  const prompt = (cfg?.ai_prompt_override as string)
    ?? `Com base no conteúdo abaixo, crie mensagem para grupo WA:\n\n${ctx || `Conteúdo: ${cfg?.ai_source_title ?? 'SmartDent'}`}`

  if (DEEPSEEK_KEY) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
          max_tokens: 150, temperature: 0.7,
        }),
      })
      if (r.ok) {
        const d = await r.json()
        const text = d.choices?.[0]?.message?.content?.trim()
        if (text) return text
      }
    } catch { /* fallback */ }
  }

  if (GEMINI_KEY) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${sys}\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
        }),
      }
    )
    if (r.ok) {
      const d = await r.json()
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return text
    }
  }

  return `${title || 'Smart Dent'} — confira o conteúdo completo em nosso portal! 📲`
}
// training-factory-publish — publica assets da fábrica de conteúdo de turma
// Recebe: { run_id: string }
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') ?? 'http://82.25.75.61:8080'
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') ?? 'Dra. Lia'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? 'SmartDent_LIA_2026'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const FEED_CHANNELS = [
  { platform: 'instagram', format: 'Feed' },
  { platform: 'facebook', format: 'Post' },
  { platform: 'linkedin', format: 'Post' },
  { platform: 'reddit', format: 'Post' },
  { platform: 'tiktok', format: 'Video' },
]

const REEL_CHANNELS = [
  { platform: 'instagram', format: 'Reel' },
  { platform: 'tiktok', format: 'Video' },
]

async function sendEvolutionText(number: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${EVOLUTION_BASE_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number, text }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const body = await req.json().catch(() => ({}))
    const run_id = body?.run_id as string | undefined
    if (!run_id || typeof run_id !== 'string') {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) Run
    const { data: run, error: runErr } = await supabase
      .from('training_factory_runs')
      .select('*')
      .eq('id', run_id)
      .maybeSingle()
    if (runErr || !run) {
      return new Response(JSON.stringify({ error: 'run not found', detail: runErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) Assets prontos
    const { data: assets, error: assetsErr } = await supabase
      .from('training_factory_assets')
      .select('*')
      .eq('run_id', run_id)
      .eq('status', 'pronto')
    if (assetsErr) throw assetsErr

    const summary = {
      scheduled_posts: 0,
      whatsapp_participants_sent: 0,
      whatsapp_participants_failed: 0,
      whatsapp_groups_sent: 0,
      whatsapp_groups_failed: 0,
    }

    for (const asset of assets ?? []) {
      const t = asset.asset_type as string

      // 3) Posts agendados (feed_instagram, linkedin, reel_turma)
      if (t === 'feed_instagram' || t === 'linkedin' || t === 'reel_turma') {
        const channels = t === 'reel_turma' ? REEL_CHANNELS : FEED_CHANNELS
        const mediaType = t === 'reel_turma' ? 'video' : 'image'

        const { error: insErr } = await supabase.from('social_scheduled_posts').insert({
          publish_now: true,
          status: 'pending',
          post_type: t,
          caption: asset.caption ?? '',
          hashtags: asset.hashtags ?? [],
          media_items: [{ url: asset.media_url, type: mediaType }],
          channels,
        })
        if (insErr) {
          await supabase
            .from('training_factory_assets')
            .update({ status: 'erro', error_message: insErr.message })
            .eq('id', asset.id)
          continue
        }
        await supabase
          .from('training_factory_assets')
          .update({ status: 'publicando' })
          .eq('id', asset.id)
        summary.scheduled_posts++
        continue
      }

      // 4) WhatsApp por participante
      if (t === 'whatsapp_participante') {
        const phone = (asset.participant_phone ?? '').toString().replace(/\D/g, '')
        const text = asset.whatsapp_text ?? ''
        if (!phone || !text) {
          await supabase
            .from('training_factory_assets')
            .update({ status: 'erro', error_message: 'phone or text missing' })
            .eq('id', asset.id)
          summary.whatsapp_participants_failed++
          continue
        }
        const number = phone.startsWith('55') ? phone : `55${phone}`
        const r = await sendEvolutionText(number, text)
        if (r.ok) {
          await supabase
            .from('training_factory_assets')
            .update({ status: 'publicado', wa_sent_at: new Date().toISOString() })
            .eq('id', asset.id)
          summary.whatsapp_participants_sent++
        } else {
          await supabase
            .from('training_factory_assets')
            .update({ status: 'erro', error_message: r.error })
            .eq('id', asset.id)
          summary.whatsapp_participants_failed++
        }
        await sleep(3000)
        continue
      }

      // 5) WhatsApp grupos clientes
      if (t === 'whatsapp_grupos') {
        const { data: groups, error: gErr } = await supabase
          .from('wa_groups')
          .select('group_jid, name')
          .eq('active', true)
          .eq('type', 'clientes')
        if (gErr) {
          await supabase
            .from('training_factory_assets')
            .update({ status: 'erro', error_message: gErr.message })
            .eq('id', asset.id)
          continue
        }
        const text = asset.whatsapp_text ?? asset.caption ?? ''
        let sent = 0
        let failed = 0
        for (const g of groups ?? []) {
          const jid = (g as any).group_jid
          if (!jid) {
            failed++
            continue
          }
          const r = await sendEvolutionText(jid, text)
          if (r.ok) sent++
          else failed++
          await sleep(3000)
        }
        summary.whatsapp_groups_sent += sent
        summary.whatsapp_groups_failed += failed
        await supabase
          .from('training_factory_assets')
          .update({
            status: failed > 0 && sent === 0 ? 'erro' : 'publicado',
            wa_sent_at: new Date().toISOString(),
            error_message: failed > 0 ? `${failed} grupo(s) falharam` : null,
          })
          .eq('id', asset.id)
        continue
      }
    }

    // 6) Run concluído
    await supabase
      .from('training_factory_runs')
      .update({ status: 'concluido', published_at: new Date().toISOString() })
      .eq('id', run_id)

    // 7) Turma concluída
    if ((run as any).turma_id) {
      await supabase
        .from('smartops_course_turmas')
        .update({ factory_status: 'concluido', factory_processed_at: new Date().toISOString() })
        .eq('id', (run as any).turma_id)
    } else if ((run as any).turma_number != null) {
      await supabase
        .from('smartops_course_turmas')
        .update({ factory_status: 'concluido', factory_processed_at: new Date().toISOString() })
        .eq('turma_number', (run as any).turma_number)
    }

    return new Response(JSON.stringify({ ok: true, run_id, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[training-factory-publish] error', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
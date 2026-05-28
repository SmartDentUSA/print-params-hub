// wa-verify-lead/index.ts — v3 FINAL
// Verifica telefone de leads no WhatsApp via Evolution API.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkWaNumber, normalizePhone, sleep, corsHeaders } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BATCH_SIZE       = 30
const DELAY_MS         = 1200

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const stats = { processed: 0, has_wa: 0, no_wa: 0, failed: 0, skipped: 0 }

  try {
    const { data: queue, error } = await supabase
      .from('wa_verify_queue')
      .select('id, lead_id, phone')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (error) throw error
    if (!queue?.length) {
      return Response.json({ ok: true, processed: 0, message: 'Fila vazia' }, { headers: corsHeaders })
    }

    console.log(`[wa-verify-lead] Processando ${queue.length} leads`)

    for (const item of queue) {
      await supabase.from('wa_verify_queue')
        .update({ status: 'processing' }).eq('id', item.id)

      const phone = normalizePhone(item.phone ?? '')

      if (!phone || phone.length < 10) {
        await supabase.from('wa_verify_queue')
          .update({ status: 'no_phone', processed_at: new Date().toISOString() })
          .eq('id', item.id)
        stats.skipped++
        continue
      }

      try {
        const result = await checkWaNumber(phone)

        // Lê wa_phone atual; só sobrescreve se estiver null
        const { data: lead } = await supabase
          .from('lia_attendances')
          .select('wa_phone')
          .eq('id', item.lead_id)
          .is('merged_into', null)
          .maybeSingle()

        const updatePayload: Record<string, unknown> = {
          wa_exists:      result.exists,
          wa_verified_at: new Date().toISOString(),
        }
        if (result.exists && result.jid && !lead?.wa_phone) {
          updatePayload.wa_phone = result.jid
        }

        const { error: updErr } = await supabase
          .from('lia_attendances')
          .update(updatePayload)
          .eq('id', item.lead_id)
          .is('merged_into', null)

        if (updErr) throw updErr

        await supabase.from('wa_verify_queue')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', item.id)

        if (result.exists) {
          stats.has_wa++
          console.log(`[wa-verify-lead] ✓ ${phone} → ${result.jid}`)
        } else {
          stats.no_wa++
        }
        stats.processed++

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[wa-verify-lead] ✗ ${phone}:`, msg)
        await supabase.from('wa_verify_queue')
          .update({ status: 'failed', error_message: msg.slice(0, 500), processed_at: new Date().toISOString() })
          .eq('id', item.id)
        stats.failed++
      }

      if (queue.indexOf(item) < queue.length - 1) await sleep(DELAY_MS)
    }

    // system_health_logs schema canônico do projeto
    try {
      await supabase.from('system_health_logs').insert({
        function_name:   'wa-verify-lead',
        severity:        'info',
        error_type:      null,
        details:         stats,
        auto_remediated: false,
        resolved:        true,
      })
    } catch (_) { /* não fatal */ }

    return Response.json({ ok: true, ...stats }, { headers: corsHeaders })

  } catch (err) {
    console.error('[wa-verify-lead] ERRO:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    )
  }
})
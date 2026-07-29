// smart-ops-wa-capture-conversations
// Captura TODAS as conversas (inbound + outbound) de TODAS as instâncias Evolution
// vinculadas a team_members ativos com role vendedor | cs | suporte.
// Idempotente via índice único (instance_name, wa_message_id).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, EVO_BASE, EVO_KEY } from '../_shared/evolution.ts'

const CAPTURE_ROLES = ['vendedor', 'cs', 'suporte']
const enc = (s: string) => encodeURIComponent(s)

type Member = {
  id: string
  nome_completo: string | null
  role: string | null
  evolution_instance_name: string
  evolution_api_key: string | null
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '')
}

function extractText(m: any): string | null {
  const msg = m?.message ?? {}
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    msg.buttonsResponseMessage?.selectedDisplayText ??
    msg.listResponseMessage?.title ??
    null
  )
}

function extractMediaType(m: any): string | null {
  const msg = m?.message ?? {}
  if (msg.imageMessage) return 'image'
  if (msg.videoMessage) return 'video'
  if (msg.audioMessage) return 'audio'
  if (msg.documentMessage) return 'document'
  if (msg.stickerMessage) return 'sticker'
  return null
}

async function callFindMessages(instance: string, apikey: string, page: number, limit: number) {
  return await fetch(`${EVO_BASE}/chat/findMessages/${enc(instance)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey },
    body: JSON.stringify({ where: {}, page, offset: limit, limit }),
    signal: AbortSignal.timeout(30_000),
  })
}

async function fetchMessages(instance: string, apikey: string, page: number, limit: number) {
  let res = await callFindMessages(instance, apikey || EVO_KEY, page, limit)
  // Fallback: apikey por instância inválida → tenta a chave global
  if ((res.status === 401 || res.status === 403) && apikey && apikey !== EVO_KEY) {
    await res.text().catch(() => '')
    res = await callFindMessages(instance, EVO_KEY, page, limit)
  }
  if (!res.ok) throw new Error(`findMessages ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const records = Array.isArray(data)
    ? data
    : (data?.messages?.records ?? data?.records ?? [])
  return Array.isArray(records) ? records : []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({} as any))
  const sinceHours: number = Math.min(Math.max(Number(body.since_hours ?? 72), 1), 24 * 30)
  const pages: number = Math.min(Math.max(Number(body.pages ?? 3), 1), 20)
  const pageSize: number = Math.min(Math.max(Number(body.page_size ?? 200), 20), 500)
  const includeGroups: boolean = body.include_groups === true
  const onlyInstance: string | null = body.instance_name ?? null

  const sinceTs = Date.now() - sinceHours * 3_600_000

  const { data: members, error: memErr } = await supabase
    .from('team_members')
    .select('id, nome_completo, role, evolution_instance_name, evolution_api_key')
    .eq('ativo', true)
    .in('role', CAPTURE_ROLES)
    .not('evolution_instance_name', 'is', null)

  if (memErr) {
    return new Response(JSON.stringify({ error: memErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1 execução por instância (evita duplicar quando dois membros compartilham instância)
  const byInstance = new Map<string, Member>()
  for (const m of (members ?? []) as Member[]) {
    if (onlyInstance && m.evolution_instance_name !== onlyInstance) continue
    const cur = byInstance.get(m.evolution_instance_name)
    if (!cur || (!cur.evolution_api_key && m.evolution_api_key)) {
      byInstance.set(m.evolution_instance_name, m)
    }
  }

  const results: any[] = []

  for (const member of byInstance.values()) {
    const instance = member.evolution_instance_name
    const apikey = member.evolution_api_key || EVO_KEY
    let fetched = 0
    let inserted = 0
    let skipped = 0
    let error: string | null = null

    try {
      for (let page = 1; page <= pages; page++) {
        const records = await fetchMessages(instance, apikey, page, pageSize)
        if (!records.length) break
        fetched += records.length

        const rows: any[] = []
        for (const m of records) {
          const jid: string = m?.key?.remoteJid ?? ''
          if (!jid) { skipped++; continue }
          const isGroup = jid.endsWith('@g.us')
          if (isGroup && !includeGroups) { skipped++; continue }
          if (jid.includes('status@broadcast')) { skipped++; continue }

          const tsSec = Number(m?.messageTimestamp?.low ?? m?.messageTimestamp ?? 0)
          const tsMs = tsSec > 1e12 ? tsSec : tsSec * 1000
          if (tsMs && tsMs < sinceTs) { skipped++; continue }

          const waId: string | null = m?.key?.id ?? null
          if (!waId) { skipped++; continue }

          const fromMe = m?.key?.fromMe === true
          const rawSource = isGroup ? (m?.key?.participant ?? jid) : jid
          // WhatsApp LID privacy: prefer o número real quando a Evolution o expõe
          const phoneSource = String(rawSource).includes('@lid')
            ? (m?.key?.senderPn ?? m?.key?.remoteJidAlt ?? m?.senderPn ?? rawSource)
            : rawSource
          const phone = normalizePhone(String(phoneSource).split('@')[0])
          if (!phone) { skipped++; continue }

          const text = extractText(m)
          const mediaType = extractMediaType(m)
          if (!text && !mediaType) { skipped++; continue }

          rows.push({
            phone,
            phone_normalized: phone,
            message_text: text,
            media_type: mediaType,
            direction: fromMe ? 'outbound' : 'inbound',
            created_at: tsMs ? new Date(tsMs).toISOString() : new Date().toISOString(),
            instance_name: instance,
            team_member_id: member.id,
            wa_message_id: waId,
            is_group: isGroup,
            sender_name: m?.pushName ?? null,
            remote_jid: jid,
            raw_payload: m,
          })
        }

        if (rows.length) {
          const { error: upErr, count } = await supabase
            .from('whatsapp_inbox')
            .upsert(rows, { onConflict: 'instance_name,wa_message_id', ignoreDuplicates: true, count: 'exact' })
          if (upErr) throw new Error(`upsert: ${upErr.message}`)
          inserted += count ?? 0
        }

        if (records.length < pageSize) break
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      console.error(`[wa-capture] ${instance}:`, error)
    }

    results.push({
      instance,
      owner: member.nome_completo,
      role: member.role,
      fetched,
      inserted,
      skipped,
      error,
    })
  }

  // Vincula mensagens novas a leads canônicos por telefone
  let linked = 0
  try {
    const { data: unlinked } = await supabase
      .from('whatsapp_inbox')
      .select('id, phone_normalized')
      .is('lead_id', null)
      .not('phone_normalized', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    const phones = [...new Set((unlinked ?? []).map(r => r.phone_normalized!).filter(Boolean))]
      .filter(p => p.length >= 10 && p.length <= 13) // descarta LIDs (15+ dígitos)
    if (phones.length) {
      const variants = [...new Set(phones.flatMap(p => [p, `+${p}`, `+55${p}`, `55${p}`]))]
      const { data: leads } = await supabase
        .from('lia_attendances')
        .select('id, telefone_normalized')
        .in('telefone_normalized', variants)
        .is('merged_into', null)
      const leadByPhone = new Map<string, string>()
      for (const l of leads ?? []) {
        const digits = String(l.telefone_normalized ?? '').replace(/\D/g, '')
        if (!digits) continue
        leadByPhone.set(digits, l.id as string)
        if (digits.startsWith('55')) leadByPhone.set(digits.slice(2), l.id as string)
      }
      for (const row of unlinked ?? []) {
        const d = row.phone_normalized!
        const leadId = leadByPhone.get(d) ?? leadByPhone.get(`55${d}`) ?? leadByPhone.get(d.replace(/^55/, ''))
        if (!leadId) continue
        await supabase.from('whatsapp_inbox').update({ lead_id: leadId, matched_by: 'phone_capture' }).eq('id', row.id)
        linked++
      }
    }
  } catch (e) {
    console.error('[wa-capture] link leads:', e)
  }

  return new Response(JSON.stringify({
    ok: true,
    instances: results.length,
    since_hours: sinceHours,
    include_groups: includeGroups,
    linked_to_leads: linked,
    results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})

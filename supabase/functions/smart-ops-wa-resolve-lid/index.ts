// smart-ops-wa-resolve-lid
// Resolve conversas gravadas com LID (@lid / dígitos longos) do WhatsApp.
//
// A Evolution/Baileys NÃO expõe o telefone real de um contato @lid
// (findContacts/findChats/whatsappNumbers só devolvem o próprio LID).
// Portanto a resolução ocorre em duas camadas, nesta ordem de confiança:
//   1. phone  — telefone real presente no payload (key.senderPn / remoteJidAlt /
//               customer.number). Match direto com o lead por últimos 8 dígitos.
//   2. name   — pushName do contato (payload + /chat/findContacts) casado com
//               lia_attendances.nome de forma normalizada e SOMENTE quando há
//               exatamente 1 lead candidato (evita vínculo errado).
//
// POST { dry_run?: boolean, instance_name?: string, limit?: number,
//        enable_name_match?: boolean (default true), debug?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, EVO_BASE, EVO_KEY } from '../_shared/evolution.ts'

const enc = (s: string) => encodeURIComponent(s)
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const last8 = (s: unknown) => { const d = digits(s); return d.length >= 8 ? d.slice(-8) : '' }

function isLid(phone: string | null | undefined): boolean {
  const p = String(phone ?? '')
  if (p.includes('@lid')) return true
  return digits(p).length > 13
}

function isRealPhone(v: unknown): boolean {
  const d = digits(String(v ?? '').split('@')[0])
  return d.length >= 10 && d.length <= 13
}

function normName(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(dr|dra|doutor|doutora|sr|sra|lab|laboratorio|clinica|odonto)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function evoCall(path: string, apikey: string, body: unknown) {
  return await fetch(`${EVO_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
}

async function evoPost(path: string, apikey: string, body: unknown) {
  let res = await evoCall(path, apikey || EVO_KEY, body)
  if ((res.status === 401 || res.status === 403) && apikey && apikey !== EVO_KEY) {
    await res.text().catch(() => '')
    res = await evoCall(path, EVO_KEY, body)
  }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  if (Array.isArray(data)) return data
  return data?.records ?? data?.contacts ?? data?.chats ?? []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({} as any))
  const dryRun: boolean = body.dry_run === true
  const onlyInstance: string | null = body.instance_name ?? null
  const nameMatch: boolean = body.enable_name_match !== false
  const limit: number = Math.min(Math.max(Number(body.limit ?? 1500), 100), 5000)

  const debug: any = { errors: [] as string[], sources: {} as Record<string, number> }

  // ------------------------------------------------------------------ inbox
  let q = supabase
    .from('whatsapp_inbox')
    .select('id, phone, phone_normalized, remote_jid, sender_name, instance_name, lead_id, is_group')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (onlyInstance) q = q.eq('instance_name', onlyInstance)
  const { data: rows, error: rowsErr } = await q
  if (rowsErr) {
    return new Response(JSON.stringify({ error: rowsErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const pending = (rows ?? []).filter((r: any) =>
    !r.lead_id && !r.is_group && isLid(r.phone_normalized || r.phone))
  const lidKeys = [...new Set(pending.map((r: any) => digits(r.phone_normalized || r.phone)))]
  debug.pending_rows = pending.length
  debug.pending_lids = lidKeys.length

  // --------------------------------------------------- camada 1: telefone real
  const phoneByLid = new Map<string, string>()
  const nameByLid = new Map<string, string>()
  for (const r of pending) {
    const lk = digits(r.phone_normalized || r.phone)
    if (r.sender_name && !nameByLid.get(lk)) nameByLid.set(lk, String(r.sender_name))
  }

  // payload consultado só para os LIDs ainda sem telefone (evita baixar JSON gigante)
  const needPayload = lidKeys.filter((lk) => !phoneByLid.has(lk)).slice(0, 100)
  for (let i = 0; i < needPayload.length; i += 20) {
    const batch = needPayload.slice(i, i + 20)
    await Promise.all(batch.map(async (lk) => {
      const { data: one } = await supabase
        .from('whatsapp_inbox')
        .select('raw_payload')
        .eq('phone', lk)
        .not('raw_payload', 'is', null)
        .limit(1)
      const p = (one?.[0]?.raw_payload ?? {}) as any
      const phoneCands = [
        p?.key?.senderPn, p?.key?.remoteJidAlt, p?.senderPn, p?.remoteJidAlt,
        p?.customer?.number, p?.data?.key?.senderPn, p?.data?.key?.remoteJidAlt,
      ]
      for (const c of phoneCands) {
        if (isRealPhone(c)) { phoneByLid.set(lk, digits(String(c).split('@')[0])); break }
      }
      const nm = p?.pushName || p?.data?.pushName
      if (nm && !nameByLid.get(lk)) nameByLid.set(lk, String(nm))
    }))
  }
  debug.sources.phone_from_payload = phoneByLid.size

  // --------------------------------- camada 2: pushName vindo dos contatos Evo
  if (nameMatch) {
    const { data: members } = await supabase
      .from('team_members')
      .select('evolution_instance_name, evolution_api_key')
      .eq('ativo', true)
      .not('evolution_instance_name', 'is', null)

    const instances = new Map<string, string>()
    for (const m of (members ?? []) as any[]) {
      const inst = m.evolution_instance_name
      if (onlyInstance && inst !== onlyInstance) continue
      if (!inst || inst.length < 3) continue // ignora instâncias inválidas
      if (!instances.has(inst)) instances.set(inst, m.evolution_api_key || EVO_KEY)
    }

    for (const [instance, apikey] of instances) {
      try {
        const recs = await evoPost(`/chat/findContacts/${enc(instance)}`, apikey, { where: {} })
        for (const rec of (Array.isArray(recs) ? recs : []) as any[]) {
          const jid = String(rec?.remoteJid ?? '')
          if (!jid || jid.includes('@g.us') || jid.includes('broadcast')) continue
          const lk = digits(jid.split('@')[0])
          if (!lk || !pendingSet.has(lk)) continue
          if (rec?.pushName && !nameByLid.get(lk)) nameByLid.set(lk, String(rec.pushName))
        }
      } catch (e) {
        debug.errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  debug.sources.names_available = nameByLid.size

  // ------------------------------------------------------- resolução por lead
  type Hit = { lidKey: string; leadId: string; how: 'phone' | 'name'; phone?: string; name?: string }
  const hits = new Map<string, Hit>()

  // 1) telefone
  const wanted = [...new Set([...phoneByLid.values()])]
  for (let i = 0; i < wanted.length; i += 50) {
    const chunk = wanted.slice(i, i + 50)
    const ors = chunk.map((p) => `telefone.ilike.%${p.slice(-8)}`).join(',')
    const { data: leads } = await supabase
      .from('lia_attendances').select('id, telefone, nome')
      .is('merged_into', null).or(ors).limit(1000)
    const byLast8 = new Map<string, string>()
    for (const l of (leads ?? []) as any[]) {
      const k = last8(l.telefone)
      if (k && !byLast8.has(k)) byLast8.set(k, l.id)
    }
    for (const [lk, ph] of phoneByLid) {
      if (!chunk.includes(ph)) continue
      const leadId = byLast8.get(ph.slice(-8))
      if (leadId) hits.set(lk, { lidKey: lk, leadId, how: 'phone', phone: ph })
    }
  }

  // 2) nome (somente match único) — em lotes para não estourar o tempo
  if (nameMatch) {
    const candidates = [...nameByLid.entries()].filter(([lk, nm]) => {
      if (hits.has(lk)) return false
      const n = normName(nm)
      return n.split(' ').length >= 2 && n.length >= 8
    })
    for (let i = 0; i < candidates.length; i += 100) {
      const chunk = candidates.slice(i, i + 100)
      const { data: matches, error } = await supabase.rpc('wa_match_leads_by_names', {
        p_names: chunk.map(([, nm]) => nm),
      })
      if (error) { debug.errors.push(`name_batch: ${error.message}`); continue }
      const byNorm = new Map<string, string>()
      for (const m of (matches ?? []) as any[]) byNorm.set(m.norm_name, m.lead_id)
      for (const [lk, nm] of chunk) {
        const leadId = byNorm.get(normName(nm))
        if (leadId) hits.set(lk, { lidKey: lk, leadId, how: 'name', name: nm })
      }
    }
  }

  const byPhone = [...hits.values()].filter((h) => h.how === 'phone').length
  const byName = [...hits.values()].filter((h) => h.how === 'name').length

  const affected = pending.filter((r: any) => hits.has(digits(r.phone_normalized || r.phone)))

  if (dryRun) {
    return new Response(JSON.stringify({
      dry_run: true, wrote_anything: false,
      matched_lids: hits.size, matched_by_phone: byPhone, matched_by_name: byName,
      rows_to_update: affected.length, ...debug,
      sample: [...hits.values()].slice(0, 15),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let updated = 0
  for (const r of affected) {
    const h = hits.get(digits(r.phone_normalized || r.phone))!
    const patch: any = { lead_id: h.leadId, matched_by: h.how === 'phone' ? 'lid_phone' : 'lid_pushname' }
    if (h.phone) patch.phone_normalized = h.phone
    if (h.name && !r.sender_name) patch.sender_name = h.name
    const { error } = await supabase.from('whatsapp_inbox').update(patch).eq('id', r.id)
    if (error) debug.errors.push(`update ${r.id}: ${error.message}`)
    else updated++
  }

  return new Response(JSON.stringify({
    ok: true, updated_rows: updated,
    matched_lids: hits.size, matched_by_phone: byPhone, matched_by_name: byName, ...debug,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})

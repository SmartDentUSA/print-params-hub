// _shared/evolution.ts — v3.1
// Instância real: "Dra. Lia" (profileName=Comercial) | 5516981158403 | http://82.25.75.61:8080

export const EVO_BASE  = Deno.env.get('EVOLUTION_API_URL')      ?? 'http://82.25.75.61:8080'
export const EVO_INST  = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? 'Dra. Lia'
export const EVO_KEY   = Deno.env.get('EVOLUTION_API_KEY')      ?? 'SmartDent_LIA_2026'
export const EVO_PHONE = '5516981158403'
export const ADMIN_JID = `${EVO_PHONE}@s.whatsapp.net`
// WhatsApp LID privacy: participantes vêm como @lid, não @s.whatsapp.net.
// Nosso LID confirmado via contagem de grupos owned (MEMBER *) = 98908885786860@lid.
export const ADMIN_LID = Deno.env.get('EVOLUTION_ADMIN_LID') ?? '98908885786860@lid'
const enc = (instance: string) => encodeURIComponent(instance)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface EvoGroup {
  id: string
  subject: string
  desc?: string
  size: number
  participants: { id: string; admin: 'admin' | 'superadmin' | null }[]
  owner?: string
  subjectOwner?: string
}

export interface WaNumberCheckResult {
  exists: boolean
  jid?: string
  name?: string
}

export interface WaInstanceInfo {
  instanceName:     string
  connectionStatus: 'open' | 'close' | 'connecting' | string
  owner?:           string
  profileName?:     string
}

function h() {
  return { 'Content-Type': 'application/json', 'apikey': EVO_KEY }
}

function hWith(apikey?: string) {
  return { 'Content-Type': 'application/json', 'apikey': apikey || EVO_KEY }
}

export async function fetchInstances(apikey?: string): Promise<WaInstanceInfo[]> {
  const res = await fetch(`${EVO_BASE}/instance/fetchInstances`, { headers: hWith(apikey) })
  if (!res.ok) throw new Error(`fetchInstances ${res.status}: ${await res.text()}`)
  const raw = await res.json()
  const list = Array.isArray(raw) ? raw : []
  return list
    .map((it: any): WaInstanceInfo => {
      const inst = it.instance ?? it
      return {
        instanceName:     inst.instanceName ?? inst.name ?? '',
        connectionStatus: inst.connectionStatus ?? inst.status ?? 'close',
        owner:            inst.owner ?? inst.ownerJid ?? undefined,
        profileName:      inst.profileName ?? inst.profile_name ?? undefined,
      }
    })
    .filter(i => i.instanceName)
}

export interface OwnerHints {
  jid?:   string  // ex: 5519992612348@s.whatsapp.net
  lid?:   string  // ex: 98908885786860@lid
  phone?: string  // dígitos puros, ex: 5519992612348
}

export async function fetchAdminGroups(
  instanceName: string = EVO_INST,
  hints?: OwnerHints,
  apikey?: string,
): Promise<EvoGroup[]> {
  const url = `${EVO_BASE}/group/fetchAllGroups/${enc(instanceName)}?getParticipants=true`
  const res = await fetch(url, { headers: hWith(apikey) })
  if (!res.ok) throw new Error(`fetchAllGroups ${res.status}: ${await res.text()}`)
  const all: EvoGroup[] = await res.json()

  // Sem hints → retrocompat (Dra. Lia). Com hints → usa só os valores fornecidos.
  const jid   = hints?.jid   ?? (hints ? undefined : ADMIN_JID)
  const lid   = hints?.lid   ?? (hints ? undefined : ADMIN_LID)
  const phone = hints?.phone ?? (hints ? undefined : EVO_PHONE)

  const digitsOf = (s?: string) => (s ?? '').replace(/\D/g, '')
  const phoneDigits = digitsOf(phone)

  return all.filter(g => {
    // 1) owner do grupo bate com a instância
    if (jid && (g.owner === jid || g.subjectOwner === jid)) return true
    if (phoneDigits) {
      const od = digitsOf(g.owner || g.subjectOwner)
      if (od && od.startsWith(phoneDigits)) return true
    }
    // 2) participante admin que bate com jid/lid/phone
    return g.participants?.some(p => {
      if (p.admin !== 'admin' && p.admin !== 'superadmin') return false
      if (lid && p.id === lid) return true
      if (jid && p.id === jid) return true
      if (phoneDigits) {
        const pd = digitsOf(p.id)
        if (pd && pd.startsWith(phoneDigits)) return true
      }
      return false
    }) ?? false
  })
}

/**
 * Retorna TODOS os grupos que a instância participa, com flag `isAdmin`
 * computada pelo melhor esforço (owner/subjectOwner/participants).
 * Útil quando o filtro estrito derruba grupos válidos por divergência de
 * formato de ID (LID privacy, owner ausente, etc.).
 */
export async function fetchGroupsWithAdminFlag(
  instanceName: string = EVO_INST,
  hints?: OwnerHints,
  apikey?: string,
): Promise<Array<EvoGroup & { isAdmin: boolean }>> {
  const url = `${EVO_BASE}/group/fetchAllGroups/${enc(instanceName)}?getParticipants=true`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 120_000)
  let res: Response
  try {
    res = await fetch(url, { headers: hWith(apikey), signal: ctrl.signal })
  } catch (e) {
    throw new Error(`fetchAllGroups timeout/aborted: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`fetchAllGroups ${res.status}: ${await res.text()}`)
  const all: EvoGroup[] = await res.json()

  const jid   = hints?.jid   ?? (hints ? undefined : ADMIN_JID)
  const lid   = hints?.lid   ?? (hints ? undefined : ADMIN_LID)
  const phone = hints?.phone ?? (hints ? undefined : EVO_PHONE)

  const digitsOf = (s?: string) => (s ?? '').replace(/\D/g, '')
  const phoneDigits = digitsOf(phone)

  return (all ?? []).map(g => {
    let isAdmin = false
    if (jid && (g.owner === jid || g.subjectOwner === jid)) isAdmin = true
    if (!isAdmin && phoneDigits) {
      const od = digitsOf(g.owner || g.subjectOwner)
      if (od && od.startsWith(phoneDigits)) isAdmin = true
    }
    if (!isAdmin) {
      isAdmin = g.participants?.some(p => {
        const adm = (p as any).admin
        if (adm !== 'admin' && adm !== 'superadmin' && adm !== true) return false
        if (lid && p.id === lid) return true
        if (jid && p.id === jid) return true
        if (phoneDigits) {
          const pd = digitsOf(p.id)
          if (pd && pd.startsWith(phoneDigits)) return true
        }
        return false
      }) ?? false
    }
    return { ...g, isAdmin }
  })
}

export async function sendText(groupJid: string, text: string, instanceName: string = EVO_INST, apikey?: string): Promise<string | null> {
  const res = await fetch(`${EVO_BASE}/message/sendText/${enc(instanceName)}`, {
    method: 'POST', headers: hWith(apikey),
    body: JSON.stringify({ number: groupJid, text }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`sendText ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d?.key?.id ?? null
}

export async function sendMedia(
  groupJid: string,
  mediatype: 'image' | 'video' | 'audio' | 'document',
  mediaUrl: string,
  caption = '',
  instanceName: string = EVO_INST,
  apikey?: string,
): Promise<string | null> {
  const res = await fetch(`${EVO_BASE}/message/sendMedia/${enc(instanceName)}`, {
    method: 'POST', headers: hWith(apikey),
    body: JSON.stringify({ number: groupJid, mediatype, media: mediaUrl, caption }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`sendMedia ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d?.key?.id ?? null
}

export async function checkWaNumber(rawPhone: string, instanceName: string = EVO_INST, apikey?: string): Promise<WaNumberCheckResult> {
  const clean = normalizePhone(rawPhone)
  if (!clean || clean.length < 10) return { exists: false }

  const res = await fetch(`${EVO_BASE}/chat/whatsappNumbers/${enc(instanceName)}`, {
    method: 'POST', headers: hWith(apikey),
    body: JSON.stringify({ numbers: [clean] }),
  })
  if (!res.ok) throw new Error(`whatsappNumbers ${res.status}: ${await res.text()}`)

  const results = await res.json()
  const r = Array.isArray(results) ? results[0] : results

  return {
    exists: r?.exists === true || r?.numberExists === true,
    jid:    r?.jid ?? (r?.exists ? `${clean}@s.whatsapp.net` : undefined),
    name:   r?.name ?? r?.pushname ?? undefined,
  }
}

export function normalizePhone(raw: string): string {
  if (!raw) return ''
  let d = raw.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2)
  }
  return d
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
// _shared/evolution.ts — v3 FINAL
// Instância: Comercial | 5516981158403 | http://82.25.75.61:8080

export const EVO_BASE  = Deno.env.get('EVOLUTION_API_URL')      ?? 'http://82.25.75.61:8080'
export const EVO_INST  = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? 'Comercial'
export const EVO_KEY   = Deno.env.get('EVOLUTION_API_KEY')      ?? 'E1596BBE-4B93-4A62-A610-3BDBD3788672'
export const EVO_PHONE = '5516981158403'
export const ADMIN_JID = `${EVO_PHONE}@s.whatsapp.net`

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
}

export interface WaNumberCheckResult {
  exists: boolean
  jid?: string
  name?: string
}

function h() {
  return { 'Content-Type': 'application/json', 'apikey': EVO_KEY }
}

export async function fetchAdminGroups(): Promise<EvoGroup[]> {
  const url = `${EVO_BASE}/group/fetchAllGroups/${EVO_INST}?getParticipants=true`
  const res = await fetch(url, { headers: h() })
  if (!res.ok) throw new Error(`fetchAllGroups ${res.status}: ${await res.text()}`)
  const all: EvoGroup[] = await res.json()
  return all.filter(g =>
    g.participants?.some(p =>
      p.id === ADMIN_JID && (p.admin === 'admin' || p.admin === 'superadmin')
    )
  )
}

export async function sendText(groupJid: string, text: string): Promise<string | null> {
  const res = await fetch(`${EVO_BASE}/message/sendText/${EVO_INST}`, {
    method: 'POST', headers: h(),
    body: JSON.stringify({ number: groupJid, text }),
  })
  if (!res.ok) throw new Error(`sendText ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d?.key?.id ?? null
}

export async function sendMedia(
  groupJid: string,
  mediatype: 'image' | 'video' | 'audio' | 'document',
  mediaUrl: string,
  caption = ''
): Promise<string | null> {
  const res = await fetch(`${EVO_BASE}/message/sendMedia/${EVO_INST}`, {
    method: 'POST', headers: h(),
    body: JSON.stringify({ number: groupJid, mediatype, media: mediaUrl, caption }),
  })
  if (!res.ok) throw new Error(`sendMedia ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d?.key?.id ?? null
}

export async function checkWaNumber(rawPhone: string): Promise<WaNumberCheckResult> {
  const clean = normalizePhone(rawPhone)
  if (!clean || clean.length < 10) return { exists: false }

  const res = await fetch(`${EVO_BASE}/chat/whatsappNumbers/${EVO_INST}`, {
    method: 'POST', headers: h(),
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
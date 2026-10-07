import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anon = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = req.headers.get('Authorization')
    if (!url || !anon || !serviceKey) return json({ error: 'Serviço indisponível' }, 503)
    if (!authorization) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await caller.auth.getUser()
    if (authError || !user) return json({ error: 'Sessão inválida' }, 401)
    const { data: allowed, error: accessError } = await caller.rpc('is_support_staff', { _user_id: user.id })
    if (accessError || !allowed) return json({ error: 'Acesso restrito ao suporte técnico' }, 403)
    const body = await req.json().catch(() => null)
    if (typeof body?.ticket_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.ticket_id)) return json({ error: 'Chamado inválido' }, 400)
    // Authorize the ticket through the caller before reading its scoped customer context.
    const { data: ticket, error: ticketError } = await caller.from('technical_tickets').select('lead_id').eq('id', body.ticket_id).single()
    if (ticketError || !ticket) return json({ error: 'Chamado não encontrado' }, 404)
    if (!ticket.lead_id) return json({ client: null, tickets: [], activity: [] })
    const service = createClient(url, serviceKey)
    const fields = 'id,nome,email,telefone_normalized,cidade,uf,omie_razao_social,proprietario_lead_crm,equip_scanner,equip_scanner_serial,equip_scanner_bancada,equip_scanner_bancada_serial,equip_impressora,equip_impressora_serial,equip_cad,equip_cad_serial,equip_pos_impressao,equip_pos_impressao_serial,equip_fresadora,equip_fresadora_serial,equip_notebook,equip_notebook_serial,cs_treinamento,data_treinamento,imersao_equipamentos_treinados'
    const { data: client, error: clientError } = await service.from('lia_attendances').select(fields).eq('id', ticket.lead_id).is('merged_into', null).maybeSingle()
    if (clientError) throw clientError
    if (!client) return json({ client: null, tickets: [], activity: [] })
    const [history, activity] = await Promise.all([
      service.from('technical_tickets').select('id,ticket_full_id,equipment,serial_number,kanban_status,created_at').eq('lead_id', client.id).order('created_at', { ascending: false }).limit(100),
      service.from('lead_activity_log').select('id,event_type,event_timestamp,entity_name,source_channel').eq('lead_id', client.id).order('event_timestamp', { ascending: false }).limit(30),
    ])
    if (history.error) throw history.error
    if (activity.error) throw activity.error
    const { count, error: countError } = await service.from('technical_tickets').select('id', { count: 'exact', head: true }).eq('lead_id', client.id)
    if (countError) throw countError
    return json({ client, tickets: history.data ?? [], ticket_count: count ?? 0, activity: activity.data ?? [] })
  } catch (error) {
    console.error('support-client-context:', error)
    return json({ error: 'Não foi possível carregar a ficha do cliente' }, 500)
  }
})
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/whatsapp'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY')
    if (!LOVABLE_API_KEY || !WHATSAPP_API_KEY) {
      return new Response(JSON.stringify({ error: 'Conexão WhatsApp não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Auth: must be a logged-in support staff member
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: isStaff } = await supabase.rpc('is_support_staff', { _user_id: user.id })
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Acesso restrito ao suporte técnico' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    const ticketId = typeof body?.ticket_id === 'string' ? body.ticket_id : null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!ticketId || !message || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'ticket_id e message (1-4000 chars) são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Load ticket + lead phone
    const { data: ticket, error: tErr } = await supabase
      .from('technical_tickets')
      .select('id, ticket_full_id, lead_id, lia_attendances(telefone_normalized)')
      .eq('id', ticketId)
      .single()
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const phoneRaw = (ticket as any).lia_attendances?.telefone_normalized as string | null
    const to = phoneRaw?.replace(/\D/g, '')
    if (!to || to.length < 10) {
      return new Response(JSON.stringify({ error: 'Cliente sem telefone válido no cadastro' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Send via WhatsApp gateway (free-form — only valid inside the 24h window)
    const waRes = await fetch(`${GATEWAY_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': WHATSAPP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    })
    const waBody = await waRes.text()
    if (!waRes.ok) {
      console.error(`WhatsApp send failed [${waRes.status}]: ${waBody}`)
      return new Response(JSON.stringify({ error: 'Falha no envio pelo WhatsApp', status: waRes.status, details: waBody }), { status: waRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Record the outbound message on the ticket
    await supabase.from('technical_ticket_messages').insert({
      ticket_id: ticketId,
      sender: 'agent',
      message,
    })

    return new Response(JSON.stringify({ ok: true, to }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('support-whatsapp-send error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

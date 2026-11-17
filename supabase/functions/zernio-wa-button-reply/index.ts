// zernio-wa-button-reply — responde sozinho ao clique nos botões de resposta rápida das campanhas
// de WhatsApp oficial (Zernio). Chamado só pelo gatilho trg_dispatch_wa_button_reply (whatsapp_inbox),
// com a chave de serviço. Só clique de botão (metadata.buttonPayload); mensagens digitadas, SAIR,
// descadastrados e Dra. L.I.A. ficam de fora. Máximo 1 resposta por telefone e botão a cada 24 h.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  type ButtonReply, buttonKey, firstNameOf, isOptOutText, matchReply, renderReply, resolveFormIdForLink, withWhatsappOrigin,
} from '../_shared/wa-button-replies.ts';

const ZERNIO = 'https://zernio.com/api/v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Mesmo celular com e sem o 9º dígito. */
function phoneVariants(d: string): string[] {
  if (!d.startsWith('55')) return d ? [d] : [];
  const ddd = d.slice(2, 4), rest = d.slice(4);
  if (rest.length === 9 && rest.startsWith('9')) return [d, `55${ddd}${rest.slice(1)}`];
  if (rest.length === 8 && /^[6-9]/.test(rest)) return [d, `55${ddd}9${rest}`];
  return [d];
}

/** Chave de serviço: a do ambiente ou a guardada no cofre do banco (o gatilho usa esta); confere numa chamada só de administrador. */
async function isServiceKey(token: string, envKey: string): Promise<boolean> {
  if (token === envKey) return true;
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?per_page=1`, { headers: { apikey: token, Authorization: `Bearer ${token}` } });
    await r.body?.cancel().catch(() => null);
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !(await isServiceKey(token, serviceKey))) return json({ error: 'unauthorized' }, 401);
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) return json({ error: 'ZERNIO_API_KEY não configurada' }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const inboxId = String(body?.inbox_id ?? '');
  if (!UUID_RE.test(inboxId)) return json({ error: 'inbox_id inválido' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const { data: msg } = await db.from('whatsapp_inbox')
    .select('id, phone, direction, lead_id, instance_name, raw_payload, created_at, sender_name')
    .eq('id', inboxId).maybeSingle();
  if (!msg || msg.direction !== 'inbound' || !String(msg.instance_name ?? '').startsWith('zernio:'))
    return json({ ok: true, ignored: 'not_zernio_inbound' });

  const p: any = msg.raw_payload ?? {};
  const pressed = String(p?.metadata?.buttonPayload ?? '').trim();
  if (!pressed) return json({ ok: true, ignored: 'not_button' });
  if (isOptOutText(pressed)) return json({ ok: true, ignored: 'opt_out_word' });
  if (Date.now() - new Date(msg.created_at).getTime() > 24 * 3_600_000) return json({ ok: true, ignored: 'window_closed' });

  const accountId = String(msg.instance_name).slice('zernio:'.length);
  const conversationId = String(p?.conversation?.id ?? p?.message?.conversationId ?? '');
  const phone = digits(msg.phone);
  const variants = phoneVariants(phone);

  // Regra do disparo: pela mensagem do template que recebeu o clique (broadcast), senão a mais recente
  // da mesma conta enviada a este telefone.
  const quoted = String(p?.metadata?.quotedMessage?.platformMessageId ?? p?.metadata?.quotedMessageId ?? '');
  let broadcastId = '';
  if (quoted) {
    const { data: out } = await db.from('whatsapp_inbox').select('raw_payload').eq('wa_message_id', quoted).maybeSingle();
    broadcastId = String((out?.raw_payload as any)?.message?.broadcastId ?? '');
  }
  const nowIso = new Date().toISOString();
  let rule: any = null;
  let reply: ButtonReply | null = null;
  if (broadcastId) {
    const { data } = await db.from('wa_button_reply_rules').select('*')
      .contains('broadcast_ids', [broadcastId]).gt('expires_at', nowIso).order('created_at', { ascending: false }).limit(1);
    rule = data?.[0] ?? null;
    reply = rule ? matchReply(rule.buttons, pressed) : null;
  }
  if (!reply) {
    rule = null;
    const { data: cands } = await db.from('wa_button_reply_rules').select('*')
      .eq('account_id', accountId).gt('expires_at', nowIso).order('created_at', { ascending: false }).limit(30);
    for (const c of cands ?? []) {
      const r = matchReply(c.buttons, pressed);
      if (!r) continue;
      let reached = false;
      if (c.is_test) reached = (c.test_phones ?? []).some((t: string) => variants.includes(digits(t)));
      else if (c.campaign_id) {
        const { data: sl } = await db.from('campaign_send_log').select('id').eq('source_campaign_id', c.campaign_id)
          .in('telefone', variants).limit(1);
        reached = !!sl?.length;
      }
      if (reached) { rule = c; reply = r; break; }
    }
  }
  if (!rule || !reply) return json({ ok: true, ignored: 'no_campaign_button' });

  // Lead canônico
  let lead: any = null;
  const { data: byPhone } = await db.from('lia_attendances').select('id, nome, do_not_contact, whatsapp_opt_out')
    .in('telefone_normalized', variants.map((v) => `+${v}`)).is('merged_into', null)
    .order('created_at', { ascending: true }).limit(1);
  lead = byPhone?.[0] ?? null;
  if (!lead && msg.lead_id) {
    const { data } = await db.from('lia_attendances').select('id, nome, do_not_contact, whatsapp_opt_out')
      .eq('id', msg.lead_id).is('merged_into', null).maybeSingle();
    lead = data ?? null;
  }

  const key = reply.key || buttonKey(reply.label);
  // Registro do clique (único por mensagem recebida: reentrega do webhook não duplica)
  const { data: claim, error: claimErr } = await db.from('wa_button_reply_log').insert({
    inbox_id: msg.id, rule_id: rule.id, campaign_id: rule.campaign_id, lead_id: lead?.id ?? null, phone,
    button_key: key, button_label: reply.label, link: reply.link, status: 'sending',
  }).select('id, created_at').single();
  if (claimErr) {
    if (String(claimErr.code) === '23505') return json({ ok: true, duplicate: true });
    throw claimErr;
  }
  const finish = (patch: Record<string, unknown>) => db.from('wa_button_reply_log').update(patch).eq('id', claim.id);

  // Clique conta no comparativo por canal do formulário do link
  const formId = reply.form_id ?? await resolveFormIdForLink(db, reply.link).catch(() => null);
  if (formId) {
    await db.from('attendance_channel_events').insert({
      channel: 'whatsapp_api', event_type: 'click', form_id: formId, lead_id: lead?.id ?? null,
      origin_channel: 'whatsapp', session_id: `wa:${phone}`, page_path: `wa-button:${key}`,
      product_name: reply.label,
    }).then(({ error }) => { if (error) console.error('channel event failed', error); });
  }

  if (lead?.do_not_contact || lead?.whatsapp_opt_out) {
    await finish({ status: 'skipped', skip_reason: 'opt_out' });
    return json({ ok: true, skipped: 'opt_out' });
  }
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: prev } = await db.from('wa_button_reply_log').select('id')
    .in('phone', variants).eq('button_key', key).in('status', ['sent', 'sending'])
    .gt('created_at', since).lte('created_at', claim.created_at).neq('id', claim.id).limit(1);
  if (prev?.length) {
    await finish({ status: 'skipped', skip_reason: 'already_replied_24h' });
    return json({ ok: true, skipped: 'already_replied_24h' });
  }
  if (!conversationId) {
    await finish({ status: 'failed', error: 'conversa da Zernio não informada' });
    return json({ error: 'no_conversation' }, 422);
  }

  const link = withWhatsappOrigin(reply.link);
  const text = renderReply(reply.reply_text, {
    firstName: firstNameOf(lead?.nome, msg.sender_name, p?.message?.sender?.name), name: lead?.nome ?? '', link,
  });
  const r = await fetch(`${ZERNIO}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, message: text }),
  });
  const rb = await r.text();
  if (!r.ok) {
    console.error(`[zernio-wa-button-reply] envio falhou [${r.status}]: ${rb.slice(0, 500)}`);
    await finish({ status: 'failed', reply_text: text, error: `${r.status}: ${rb.slice(0, 500)}` });
    return json({ error: 'Provider request failed', status: r.status, details: rb.slice(0, 500) }, 502);
  }
  let parsed: any = {};
  try { parsed = JSON.parse(rb); } catch { /* */ }
  const providerId = String(parsed?.data?.messageId ?? parsed?.messageId ?? parsed?.message?.id ?? parsed?.data?.id ?? parsed?.id ?? '') || null;
  await finish({ status: 'sent', reply_text: text, provider_message_id: providerId, sent_at: new Date().toISOString() });

  if (lead?.id) {
    await db.from('lead_activity_log').insert({
      lead_id: lead.id, event_type: 'whatsapp_button_auto_reply', event_timestamp: new Date().toISOString(),
      source_channel: 'whatsapp',
      event_data: { botao: reply.label, link, resposta: text, campaign_id: rule.campaign_id, teste: rule.is_test, conta: accountId },
    }).then(({ error }) => { if (error) console.error('timeline failed', error); });
  }
  console.log(JSON.stringify({ event: 'zernio.wa.button_reply', button: key, lead: lead?.id ?? null, campaign: rule.campaign_id, test: rule.is_test }));
  return json({ ok: true, sent: true });
});

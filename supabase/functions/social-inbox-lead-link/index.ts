// social-inbox-lead-link — identifica leads das conversas do Zernio e grava na timeline
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g;
const ZERNIO_BASE = 'https://zernio.com/api/v1';

function digits(v: string) { return (v ?? '').replace(/\D/g, ''); }

function normalizePhone(raw: string): string | null {
  let d = digits(raw);
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

function extract(text: string) {
  const emails = Array.from(new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase())));
  const phones = Array.from(new Set((text.match(PHONE_RE) ?? []).map(normalizePhone).filter(Boolean) as string[]));
  return { emails, phones };
}

type Lead = {
  id: string; nome: string | null; email: string | null; telefone_normalized: string | null;
  instagram: string | null; instagram_user_id?: string | null; facebook_psid?: string | null;
  tiktok_user_id?: string | null;
};
const LEAD_COLS = 'id, nome, email, telefone_normalized, instagram, instagram_user_id, facebook_psid, tiktok_user_id';

/** Coluna do lead que guarda o ID nativo de cada plataforma. */
function idColumnFor(channel: string): 'instagram_user_id' | 'facebook_psid' | 'tiktok_user_id' | null {
  switch ((channel ?? '').toLowerCase()) {
    case 'instagram': return 'instagram_user_id';
    case 'facebook': return 'facebook_psid';
    case 'tiktok': return 'tiktok_user_id';
    default: return null;
  }
}

const PLATFORM_ID_LABEL: Record<string, string> = {
  instagram: 'ID Instagram',
  facebook: 'ID Facebook',
  tiktok: 'ID TikTok',
  whatsapp: 'WhatsApp',
};

/** Cliente = tem ao menos 1 deal GANHO. Sem deal ganho = apenas lead. */
async function classifyLead(supabase: any, leadId: string): Promise<{
  is_customer: boolean; won_deals: number; ltv_total: number;
}> {
  const { count } = await supabase.from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId).eq('status', 'ganha');
  let won = Number(count ?? 0);

  const { data: lead } = await supabase.from('lia_attendances')
    .select('ltv_total, status_oportunidade, piperun_deals_history')
    .eq('id', leadId).maybeSingle();

  if (won === 0) {
    const hist = Array.isArray(lead?.piperun_deals_history) ? lead!.piperun_deals_history : [];
    won = hist.filter((d: any) => /ganh/i.test(String(d?.status ?? d?.deal_status ?? '')) || String(d?.status) === '2').length;
    if (won === 0 && /ganh/i.test(String(lead?.status_oportunidade ?? ''))) won = 1;
  }
  return { is_customer: won > 0, won_deals: won, ltv_total: Number(lead?.ltv_total ?? 0) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = String(body.action ?? 'resolve');

  const findLead = async (opts: {
    name?: string | null; username?: string | null; text?: string | null;
    channel?: string | null; platformUserId?: string | null;
  }): Promise<{ lead: Lead | null; matched_by: string | null }> => {
    const { emails, phones } = extract(String(opts.text ?? ''));
    const username = String(opts.username ?? '').replace(/^@/, '').trim();
    const name = String(opts.name ?? '').trim();
    const channel = String(opts.channel ?? '').toLowerCase();
    const platformId = String(opts.platformUserId ?? '').trim();

    // 0. ID nativo da plataforma (Instagram/Facebook/TikTok) — identidade mais forte
    const idCol = idColumnFor(channel);
    if (idCol && platformId) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).eq(idCol, platformId).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: `${channel}_id` };
    }
    // 0b. WhatsApp: o identificador é o próprio telefone
    if (channel === 'whatsapp' && platformId) {
      const d = platformId.replace(/\D/g, '');
      if (d.length >= 10) {
        const { data } = await supabase.rpc('fn_find_lead_by_social_id', {
          _channel: 'whatsapp', _platform_user_id: d,
        });
        const hit = Array.isArray(data) ? data[0] : null;
        if (hit?.lead_id) {
          const { data: l } = await supabase.from('lia_attendances').select(LEAD_COLS)
            .eq('id', hit.lead_id).maybeSingle();
          if (l) return { lead: l as Lead, matched_by: 'whatsapp_phone' };
        }
      }
    }

    // 1. e-mail (mais forte)
    for (const email of emails) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).ilike('email', email).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'email' };
    }
    // 2. telefone
    for (const phone of phones) {
      const variants = [`+55${phone}`, `55${phone}`, phone];
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).in('telefone_normalized', variants).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'telefone' };
    }
    // 3. @instagram salvo no lead
    if (username) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).or(`instagram.ilike.%${username}%,instagram.ilike.%@${username}%`).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'instagram' };
    }
    // 4. nome exato (último recurso)
    if (name.length >= 6 && name.includes(' ')) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).ilike('nome', name).limit(2);
      if (data?.length === 1) return { lead: data[0] as Lead, matched_by: 'nome' };
    }
    return { lead: null, matched_by: null };
  };

  /** Grava o ID nativo da plataforma no cadastro do lead (não sobrescreve). */
  const persistPlatformId = async (lead: Lead, channel: string, platformUserId?: string | null) => {
    const col = idColumnFor(channel);
    if (!col || !platformUserId) return;
    if ((lead as any)[col]) return;
    await supabase.from('lia_attendances').update({ [col]: platformUserId }).eq('id', lead.id);
  };

  try {
    // Varre as DMs (Instagram/Facebook/WhatsApp) do Zernio, extrai e-mail/telefone do texto
    // das mensagens, casa com a base de leads e registra na timeline.
    if (action === 'scan_dms') {
      const apiKey = Deno.env.get('ZERNIO_API_KEY');
      if (!apiKey) return json({ error: 'ZERNIO_API_KEY não configurada' }, 500);
      const platform = body.platform && body.platform !== 'all' ? String(body.platform) : null;
      const maxConversations = Math.min(Number(body.limit ?? 60), 200);

      const zfetch = async (path: string) => {
        const res = await fetch(`${ZERNIO_BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!res.ok) throw new Error(`Zernio ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return await res.json();
      };

      const convParams = new URLSearchParams({ limit: String(Math.min(maxConversations, 100)), sortOrder: 'desc' });
      if (platform) convParams.set('platform', platform);
      if (body.accountId) convParams.set('accountId', String(body.accountId));
      const convJson = await zfetch(`/inbox/conversations?${convParams}`);
      const conversations: any[] = convJson.conversations ?? convJson.data ?? [];

      let scanned = 0, linked = 0, timeline = 0, withIdentifiers = 0;
      const details: any[] = [];

      for (const c of conversations.slice(0, maxConversations)) {
        scanned++;
        const convPlatform = String(c.platform ?? platform ?? 'instagram');
        const accountId = c.accountId ?? body.accountId;
        let messages: any[] = [];
        try {
          const qs = new URLSearchParams({ limit: '50' });
          if (accountId) qs.set('accountId', String(accountId));
          const mj = await zfetch(`/inbox/conversations/${encodeURIComponent(c.id)}/messages?${qs}`);
          messages = mj.messages ?? mj.data ?? [];
        } catch (e) {
          console.error(JSON.stringify({ event: 'scan_dms.messages_fail', conv: c.id, error: String(e) }));
          continue;
        }

        const texts = messages.map((m: any) => {
          const attach = (m.attachments ?? [])
            .map((a: any) => a?.payload?.generic?.elements?.[0]?.title ?? '')
            .join(' ');
          return [m.message, attach].filter(Boolean).join(' ');
        });
        const allText = [c.lastMessage, ...texts].filter(Boolean).join('\n');
        const found = extract(allText);
        if (found.emails.length || found.phones.length) withIdentifiers++;

        const { lead, matched_by } = await findLead({
          name: c.participantName, username: c.participantUsername, text: allText,
        });
        if (!lead) continue;
        linked++;

        // enriquece o contato espelhado com o que veio da DM
        const contactId = String(c.participantId ?? c.contactId ?? c.participantUsername ?? '');
        if (contactId) {
          const { data: existing } = await supabase.from('social_contacts')
            .select('ig_user_id, custom_fields').eq('ig_user_id', contactId).maybeSingle();
          if (existing) {
            await supabase.from('social_contacts').update({
              lead_id: lead.id,
              custom_fields: {
                ...((existing.custom_fields as any) ?? {}),
                lead_matched_by: matched_by,
                dm_email: found.emails[0] ?? (existing.custom_fields as any)?.dm_email ?? null,
                dm_phone: found.phones[0] ?? (existing.custom_fields as any)?.dm_phone ?? null,
              },
            }).eq('ig_user_id', contactId);
          }
        }

        if (convPlatform === 'instagram' && !lead.instagram && c.participantUsername) {
          await supabase.from('lia_attendances')
            .update({ instagram: `@${String(c.participantUsername).replace(/^@/, '')}` })
            .eq('id', lead.id);
        }

        const rows = messages.map((m: any, i: number) => {
          const text = String(texts[i] ?? '').trim();
          if (!text) return null;
          const out = m.direction === 'outgoing';
          const ts = m.sentAt ?? m.createdAt ?? new Date().toISOString();
          return {
            lead_id: lead.id,
            event_type: out ? 'social_dm_sent' : 'social_dm_received',
            event_timestamp: new Date(ts).toISOString(),
            source_channel: `zernio_${convPlatform}`,
            entity_type: 'social_conversation',
            entity_id: String(m.id ?? `${c.id}:${ts}`),
            entity_name: c.participantName ?? c.participantUsername ?? 'Conversa social',
            event_data: {
              platform: convPlatform,
              conversation_id: c.id,
              direction: out ? 'outgoing' : 'incoming',
              sender: out ? 'Smart Dent' : (m.senderName ?? c.participantName ?? null),
              username: c.participantUsername ?? null,
              message: text.slice(0, 4000),
              matched_by,
              extracted: { emails: found.emails, phones: found.phones },
            },
            dedupe_hash: `zernio_dm:${String(m.id ?? `${c.id}:${ts}`)}`,
          };
        }).filter(Boolean) as any[];

        if (rows.length) {
          const hashes = rows.map((r) => r.dedupe_hash);
          const { data: dup } = await supabase.from('lead_activity_log')
            .select('dedupe_hash').eq('lead_id', lead.id).in('dedupe_hash', hashes);
          const seen = new Set((dup ?? []).map((d: any) => d.dedupe_hash));
          const fresh = rows.filter((r) => !seen.has(r.dedupe_hash));
          if (fresh.length) {
            const { data: ins } = await supabase.from('lead_activity_log').insert(fresh).select('id');
            timeline += ins?.length ?? 0;
          }
        }

        details.push({
          conversation_id: c.id, platform: convPlatform, lead_id: lead.id,
          nome: lead.nome, matched_by, emails: found.emails, phones: found.phones,
        });
      }

      return json({ scanned, with_identifiers: withIdentifiers, linked, timeline_events: timeline, details: details.slice(0, 50) });
    }

    // Identifica contatos do Zernio (Instagram/Facebook/WhatsApp) contra a base de leads
    // e registra os IDs de plataforma na timeline do lead.
    if (action === 'link_contacts') {
      const limit = Math.min(Number(body.limit ?? 300), 1000);
      const onlyUnlinked = body.only_unlinked !== false;
      let q = supabase.from('social_contacts')
        .select('ig_user_id, ig_username, channel, lead_id, custom_fields, last_seen_at')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (onlyUnlinked) q = q.is('lead_id', null);
      if (body.channel && body.channel !== 'all') q = q.eq('channel', String(body.channel));
      const { data: contacts, error: cErr } = await q;
      if (cErr) return json({ error: cErr.message }, 500);

      let linked = 0, timeline = 0;
      const details: any[] = [];
      for (const c of contacts ?? []) {
        const identifier = String((c.custom_fields as any)?.platformIdentifier ?? c.ig_user_id ?? '');
        const { lead, matched_by } = await findLead({
          name: (c.custom_fields as any)?.name ?? c.ig_username,
          username: c.ig_username,
          text: [identifier, (c.custom_fields as any)?.email, (c.custom_fields as any)?.phone].filter(Boolean).join('\n'),
        });
        if (!lead) continue;
        linked++;
        const channel = String(c.channel ?? 'instagram');
        await supabase.from('social_contacts')
          .update({ lead_id: lead.id, custom_fields: { ...(c.custom_fields as any ?? {}), lead_matched_by: matched_by } })
          .eq('ig_user_id', c.ig_user_id);

        // @instagram do lead fica preenchido quando ainda estiver vazio
        if (channel === 'instagram' && !lead.instagram && c.ig_username) {
          await supabase.from('lia_attendances')
            .update({ instagram: `@${String(c.ig_username).replace(/^@/, '')}` })
            .eq('id', lead.id);
        }

        const hash = `social_identity:${channel}:${c.ig_user_id}`;
        const { data: exists } = await supabase.from('lead_activity_log')
          .select('id').eq('dedupe_hash', hash).limit(1);
        if (!exists?.length) {
          const { error: iErr } = await supabase.from('lead_activity_log').insert({
            lead_id: lead.id,
            event_type: 'social_identity_linked',
            event_timestamp: c.last_seen_at ?? new Date().toISOString(),
            source_channel: `zernio_${channel}`,
            entity_type: 'social_contact',
            entity_id: String(c.ig_user_id),
            entity_name: c.ig_username ?? identifier ?? 'Contato social',
            event_data: {
              platform: channel,
              platform_user_id: String(c.ig_user_id),
              platform_identifier: identifier || null,
              username: c.ig_username ?? null,
              matched_by,
            },
            dedupe_hash: hash,
          } as any);
          if (!iErr) timeline++;
        }
        details.push({ contact_id: c.ig_user_id, channel, lead_id: lead.id, nome: lead.nome, matched_by });
      }
      return json({ scanned: contacts?.length ?? 0, linked, timeline_events: timeline, details: details.slice(0, 50) });
    }

    if (action === 'resolve') {
      const items: any[] = Array.isArray(body.conversations) ? body.conversations : [];
      const results: any[] = [];
      for (const c of items.slice(0, 100)) {
        const { lead, matched_by } = await findLead({
          name: c.participantName, username: c.participantUsername,
          text: [c.lastMessage, c.text].filter(Boolean).join('\n'),
        });
        const cls = lead ? await classifyLead(supabase, lead.id) : null;
        results.push({
          conversationId: c.id,
          matched_by,
          lead: lead ? { id: lead.id, nome: lead.nome, email: lead.email, telefone: lead.telefone_normalized } : null,
          is_customer: cls?.is_customer ?? false,
          won_deals: cls?.won_deals ?? 0,
          ltv_total: cls?.ltv_total ?? 0,
        });
      }
      return json({ results });
    }

    if (action === 'log_timeline') {
      const conversationId = String(body.conversationId ?? '');
      const platform = String(body.platform ?? 'instagram');
      const messages: any[] = Array.isArray(body.messages) ? body.messages : [];
      if (!conversationId || messages.length === 0) return json({ error: 'conversationId e messages obrigatórios' }, 400);

      let leadId: string | null = body.leadId ? String(body.leadId) : null;
      let matchedBy: string | null = leadId ? 'manual' : null;
      if (!leadId) {
        const allText = messages.map((m) => m.text ?? m.message ?? '').join('\n');
        const r = await findLead({
          name: body.participantName, username: body.participantUsername,
          text: [body.lastMessage, allText].filter(Boolean).join('\n'),
        });
        leadId = r.lead?.id ?? null;
        matchedBy = r.matched_by;
      }
      if (!leadId) return json({ linked: false, reason: 'lead_not_found' });

      const rows = messages
        .map((m) => {
          const text = String(m.text ?? m.message ?? '').trim();
          if (!text) return null;
          const out = m.direction === 'outgoing';
          const ts = m.sentAt ?? m.createdAt ?? new Date().toISOString();
          return {
            lead_id: leadId,
            event_type: out ? 'social_dm_sent' : 'social_dm_received',
            event_timestamp: new Date(ts).toISOString(),
            source_channel: `zernio_${platform}`,
            entity_type: 'social_conversation',
            entity_id: String(m.id ?? `${conversationId}:${ts}`),
            entity_name: body.participantName ?? body.participantUsername ?? 'Conversa social',
            event_data: {
              platform,
              conversation_id: conversationId,
              direction: out ? 'outgoing' : 'incoming',
              sender: out ? 'Smart Dent' : (m.senderName ?? body.participantName ?? null),
              username: body.participantUsername ?? null,
              message: text.slice(0, 4000),
              matched_by: matchedBy,
            },
            dedupe_hash: `zernio_dm:${String(m.id ?? `${conversationId}:${ts}`)}`,
          };
        })
        .filter(Boolean);

      if (rows.length === 0) return json({ linked: true, lead_id: leadId, inserted: 0 });

      // O índice único de dedupe é parcial (WHERE dedupe_hash IS NOT NULL),
      // então o PostgREST não pode usá-lo em ON CONFLICT: filtramos antes de inserir.
      const hashes = (rows as any[]).map((r) => r.dedupe_hash);
      const { data: existing } = await supabase.from('lead_activity_log')
        .select('dedupe_hash').eq('lead_id', leadId).in('dedupe_hash', hashes);
      const seen = new Set((existing ?? []).map((e: any) => e.dedupe_hash));
      const fresh = (rows as any[]).filter((r) => !seen.has(r.dedupe_hash));
      if (fresh.length === 0) return json({ linked: true, lead_id: leadId, matched_by: matchedBy, inserted: 0 });

      const { error, data } = await supabase.from('lead_activity_log')
        .insert(fresh as any[]).select('id');
      if (error) return json({ error: error.message }, 500);

      return json({ linked: true, lead_id: leadId, matched_by: matchedBy, inserted: data?.length ?? 0 });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error('[social-inbox-lead-link] fail', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

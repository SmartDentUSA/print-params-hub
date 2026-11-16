// zernio-wa-broadcast — Disparo em massa pelo WhatsApp oficial (Cloud API via Zernio).
// Ações (staff-only): accounts | templates | send | status
// Fora da janela de 24h a Meta só aceita modelo APROVADO; por isso o envio exige template.
// Não toca Evolution/WaLeads nem deals; só cria campaign_sessions + campaign_send_log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { MEDIA_HEADERS, isPublicHttpsUrl, planSlots, templateMeta, validateSchedule } from './plan.ts';

const ZERNIO = 'https://zernio.com/api/v1';
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const idOf = (v: any): string => (!v ? '' : typeof v === 'object' ? (v._id ?? v.id ?? '') : String(v));
const digits = (p: string | null | undefined) => String(p ?? '').replace(/\D/g, '');
function e164(p: string | null | undefined): string | null {
  let d = digits(p);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

type VarSpec = { source: 'field' | 'literal'; value: string; fallback?: string };
const firstName = (n: any) => String(n ?? '').trim().split(/\s+/)[0] ?? '';
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const FIELDS: Record<string, (l: any) => string> = {
  primeiro_nome: (l) => titleCase(firstName(l.nome)),
  nome: (l) => String(l.nome ?? '').trim(),
  empresa: (l) => String(l.empresa_nome ?? '').trim(),
  cidade: (l) => String(l.cidade ?? l.empresa_cidade ?? '').trim(),
  uf: (l) => String(l.uf ?? l.empresa_uf ?? '').trim(),
  especialidade: (l) => String(l.especialidade ?? '').trim(),
  produto_interesse: (l) => String(l.produto_interesse ?? '').trim(),
  vendedor: (l) => String(l.proprietario_lead_crm ?? '').trim(),
  ultimo_formulario: (l) => String(l.form_name ?? '').trim(),
  cupom: (l) => String(l.lojaintegrada_cupom_desconto ?? '').trim(),
  email: (l) => String(l.email ?? '').trim(),
};
const LEAD_COLS = 'nome,email,empresa_nome,cidade,empresa_cidade,uf,empresa_uf,especialidade,produto_interesse,proprietario_lead_crm,form_name,lojaintegrada_cupom_desconto';
function resolveVar(v: VarSpec, l: any): string {
  const raw = v.source === 'literal' ? String(v.value ?? '') : FIELDS[v.value](l);
  const out = raw || String(v.fallback ?? '').trim();
  return (out || '-').replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 1000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('ZERNIO_API_KEY');
  if (!key) return json({ error: 'ZERNIO_API_KEY não configurada' }, 500);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Auth: somente equipe interna
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: 'unauthorized' }, 401);
  const { data: isStaff } = await admin.rpc('fn_is_internal_staff', { _user_id: u.user.id });
  if (!isStaff) return json({ error: 'forbidden' }, 403);

  const z = async (path: string, init?: RequestInit) => {
    const r = await fetch(`${ZERNIO}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    const t = await r.text();
    let b: any = {}; try { b = JSON.parse(t); } catch { b = { raw: t }; }
    if (!r.ok) throw new Error(`Zernio ${path} ${r.status}: ${b?.error ?? t.slice(0, 300)}`);
    return b;
  };

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = String(p.action ?? '');

  try {
    if (action === 'accounts') {
      const b = await z('/accounts');
      const list = (b.accounts ?? b.data ?? []).filter((a: any) => a.platform === 'whatsapp').map((a: any) => ({
        accountId: idOf(a._id ?? a.id), profileId: idOf(a.profileId ?? a.profile),
        name: a.displayName ?? a.name ?? a.username ?? null, phone: a.phoneNumber ?? a.username ?? a.handle ?? null,
      }));
      return json({ accounts: list });
    }

    if (action === 'templates') {
      if (!p.accountId) return json({ error: 'accountId obrigatório' }, 400);
      const b = await z(`/whatsapp/templates?accountId=${encodeURIComponent(p.accountId)}&status=APPROVED`);
      const list = (b.templates ?? b.data ?? []).filter((t: any) => String(t.status ?? '').toUpperCase() === 'APPROVED')
        .map((t: any) => templateMeta(t));
      return json({ templates: list });
    }

    if (action === 'send') {
      const { accountId, profileId, templateName, language, name, leadIds, variableMap, description } = p;
      if (!accountId || !profileId || !templateName || !language || !name || !Array.isArray(leadIds) || !leadIds.length)
        return json({ error: 'accountId, profileId, templateName, language, name e leadIds são obrigatórios' }, 400);
      if (leadIds.length > 10000) return json({ error: 'máximo 10.000 leads por disparo' }, 400);
      const nowDate = new Date();
      const perHour = p.perHour == null || p.perHour === '' ? null : Number(p.perHour);
      const scheduledAt = p.scheduledAt ? new Date(String(p.scheduledAt)).toISOString() : null;
      const schedErr = validateSchedule(p.perHour, p.scheduledAt, nowDate);
      if (schedErr) return json({ error: schedErr }, 400);

      // Cabeçalho lido do template aprovado na Meta (não do navegador): com mídia, exige a imagem da campanha
      // e nunca envia com a amostra aprovada.
      const tb = await z(`/whatsapp/templates?accountId=${encodeURIComponent(accountId)}&status=APPROVED`);
      const tplRaw = (tb.templates ?? tb.data ?? []).find((t: any) => t.name === templateName && t.language === language
        && String(t.status ?? '').toUpperCase() === 'APPROVED');
      if (!tplRaw) return json({ error: `Template ${templateName} (${language}) não está aprovado nesta conta` }, 400);
      const meta = templateMeta(tplRaw);
      if (meta.headerType === 'LOCATION') return json({ error: 'Templates com cabeçalho de localização não são suportados' }, 400);
      const headerMediaUrl = p.headerMediaUrl ? String(p.headerMediaUrl).trim() : '';
      const mediaHeader = MEDIA_HEADERS.includes(meta.headerType);
      if (mediaHeader && !headerMediaUrl)
        return json({ error: `O template tem cabeçalho ${meta.headerType}: envie a mídia da campanha (headerMediaUrl). A amostra aprovada nunca é enviada.` }, 400);
      if (mediaHeader && !isPublicHttpsUrl(headerMediaUrl)) return json({ error: 'headerMediaUrl precisa ser uma URL pública https' }, 400);
      const mediaType = meta.headerType.toLowerCase() as 'image' | 'video' | 'document';
      const vmap: VarSpec[] = Array.isArray(variableMap) ? variableMap : [];
      for (const v of vmap) {
        if (v?.source === 'field' && !FIELDS[v.value]) return json({ error: `campo inválido: ${v?.value}` }, 400);
        if (v?.source !== 'field' && v?.source !== 'literal') return json({ error: 'variableMap inválido' }, 400);
      }

      // Leads canônicos com telefone
      const leads: any[] = [];
      for (let i = 0; i < leadIds.length; i += 500) {
        const { data, error } = await admin.from('lia_attendances')
          .select(`id,telefone_normalized,telefone_raw,${LEAD_COLS}`)
          .in('id', leadIds.slice(i, i + 500)).is('merged_into', null);
        if (error) throw error;
        leads.push(...(data ?? []));
      }
      const seen = new Set<string>();
      const valid = leads.map((l) => ({ ...l, phone: e164(l.telefone_normalized || l.telefone_raw) }))
        .filter((l) => l.phone && !seen.has(l.phone) && seen.add(l.phone));
      if (!valid.length) return json({ error: 'Nenhum lead com telefone válido' }, 400);

      // Zernio só aceita valor fixo por broadcast → agrupa por combinação de variáveis (dentro de cada lote).
      // Lotes por hora sobre o TOTAL; dentro de cada lote, um broadcast por combinação de variáveis.
      const slots = planSlots(valid, { perHour, scheduledAt, now: nowDate }).map((sl) => {
        const groups = new Map<string, { values: string[]; leads: any[] }>();
        for (const l of sl.leads) {
          const values = vmap.map((v) => resolveVar(v, l));
          const k = JSON.stringify(values);
          if (!groups.has(k)) groups.set(k, { values, leads: [] });
          groups.get(k)!.leads.push(l);
        }
        return { at: sl.at, groups: [...groups.values()] };
      });
      const totalBroadcasts = slots.reduce((a, sl) => a + sl.groups.length, 0);
      if (totalBroadcasts > 400) return json({ error: `O disparo geraria ${totalBroadcasts} envios distintos (máx. 400). Use campos com menos variação ou um limite por hora maior.` }, 400);
      const isScheduled = slots.some((sl) => sl.at);
      const startAt = slots[0]?.at ?? null;
      const baseResults = {
        provider: 'zernio_cloud_api', account_id: accountId, template: templateName, language, variable_map: vmap,
        header_type: meta.headerType, header_media_url: mediaHeader ? headerMediaUrl : null,
        per_hour: perHour, scheduled_at: startAt,
      };

      const { data: camp } = await admin.from('campaigns').insert({
        nome: name, descricao: description ?? null, canal: 'whatsapp_oficial', status: isScheduled ? 'scheduled' : 'sending',
        mensagem_template: `template:${templateName}`, total_leads: valid.length,
        ...(isScheduled ? { scheduled_at: startAt } : { started_at: nowDate.toISOString() }),
        created_by: u.user.id,
      }).select('id').maybeSingle();

      const { data: session, error: sErr } = await admin.from('campaign_sessions').insert({
        name, channel: 'whatsapp_oficial', status: isScheduled ? 'scheduled' : 'running',
        ...(isScheduled ? { scheduled_at: startAt } : { started_at: nowDate.toISOString() }),
        lead_ids: valid.map((l) => l.id), lead_count: valid.length, created_by: u.user.id,
        results: { ...baseResults, campaign_id: camp?.id ?? null },
      }).select('id').single();
      if (sErr) throw sErr;

      const broadcasts: string[] = [];
      const slotLog: { at: string | null; broadcast_ids: string[]; leads: number }[] = [];
      let added = 0, skipped = 0, failedGroups = 0;
      for (const sl of slots) {
        const slotIds: string[] = [];
        for (const g of sl.groups) {
          const template: any = { name: templateName, language };
          const components: any[] = [];
          if (mediaHeader) {
            components.push({ type: 'header', parameters: [{ type: mediaType, [mediaType]: { link: headerMediaUrl } }] });
            template.headerMedia = { type: mediaType, link: headerMediaUrl };
          }
          if (g.values.length) {
            components.push({ type: 'body', parameters: g.values.map((_, i) => ({ type: 'text', text: `{{${i + 1}}}` })) });
            template.variableMapping = Object.fromEntries(g.values.map((v, i) => [String(i + 1), { field: 'custom', customValue: v }]));
          }
          if (components.length) template.components = components;
          try {
            const created = await z('/broadcasts', { method: 'POST', body: JSON.stringify({
              profileId, accountId, platform: 'whatsapp', name: `${name} · ${session.id.slice(0, 8)} · ${broadcasts.length + 1}`, template,
            }) });
            const bid = created?.broadcast?.id;
            if (!bid) throw new Error('Zernio não retornou broadcast id');
            for (let i = 0; i < g.leads.length; i += 500) {
              const r = await z(`/broadcasts/${bid}/recipients`, { method: 'POST',
                body: JSON.stringify({ phones: g.leads.slice(i, i + 500).map((l) => `+${l.phone}`) }) });
              added += r.added ?? 0; skipped += r.skipped ?? 0;
            }
            if (sl.at) await z(`/broadcasts/${bid}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt: sl.at }) });
            else await z(`/broadcasts/${bid}/send`, { method: 'POST', body: '{}' });
            broadcasts.push(bid); slotIds.push(bid);
            const text = (g.values.length ? `template:${templateName} | ${g.values.join(' | ')}` : `template:${templateName}`)
              + (mediaHeader ? ` | ${meta.headerType.toLowerCase()}:${headerMediaUrl}` : '');
            for (let i = 0; i < g.leads.length; i += 500) {
              await admin.from('campaign_send_log').insert(g.leads.slice(i, i + 500).map((l) => ({
                campaign_id: session.id, source_campaign_id: camp?.id ?? null, lead_id: l.id, nome: l.nome, telefone: l.phone,
                provider: 'zernio_cloud_api', provider_message_id: bid, content_sent: text,
                ...(sl.at ? { status: 'scheduled', scheduled_at: sl.at } : { status: 'sent', sent_at: nowDate.toISOString() }),
              })));
            }
          } catch (e) {
            failedGroups++;
            console.error('[zernio-wa-broadcast] grupo falhou', e);
            await admin.from('campaign_send_log').insert(g.leads.map((l) => ({
              campaign_id: session.id, source_campaign_id: camp?.id ?? null, lead_id: l.id, nome: l.nome, telefone: l.phone,
              status: 'failed', provider: 'zernio_cloud_api', error_message: String((e as Error).message).slice(0, 500),
              content_sent: `template:${templateName}`, ...(sl.at ? { scheduled_at: sl.at } : {}),
            })));
          }
        }
        slotLog.push({ at: sl.at, broadcast_ids: slotIds, leads: sl.groups.reduce((a, g) => a + g.leads.length, 0) });
      }
      const status = broadcasts.length === 0 ? 'failed' : failedGroups ? 'completed_with_errors' : (isScheduled ? 'scheduled' : 'running');
      await admin.from('campaign_sessions').update({
        status, sent_count: isScheduled ? 0 : added, failed_count: skipped,
        results: { ...baseResults, campaign_id: camp?.id ?? null, broadcast_id: broadcasts[0] ?? null, broadcast_ids: broadcasts,
          slots: slotLog, added, skipped, failed_groups: failedGroups },
      }).eq('id', session.id);
      if (camp?.id) await admin.from('campaigns').update({
        total_sent: isScheduled ? 0 : added, total_failed: skipped,
        status: broadcasts.length ? (failedGroups ? 'completed_with_errors' : (isScheduled ? 'scheduled' : 'completed')) : 'failed',
      }).eq('id', camp.id);
      if (!broadcasts.length) return json({ error: 'Nenhum envio foi aceito pela Zernio' }, 502);
      return json({ ok: true, campaign_id: session.id, broadcasts: broadcasts.length, added, skipped, total: valid.length,
        failed_groups: failedGroups, scheduled: isScheduled, scheduled_at: startAt, slots: slotLog.length,
        last_slot_at: slotLog[slotLog.length - 1]?.at ?? null });
    }

    if (action === 'sample') {
      const { leadId } = p;
      const { data } = await admin.from('lia_attendances').select(`id,${LEAD_COLS}`).eq('id', leadId).is('merged_into', null).maybeSingle();
      return json({ lead: data ? Object.fromEntries(Object.keys(FIELDS).map((k) => [k, FIELDS[k](data)])) : null });
    }

    if (action === 'status') {
      const { data: s } = await admin.from('campaign_sessions').select('id,results').eq('id', p.campaignId).single();
      const ids: string[] = s?.results?.broadcast_ids ?? (s?.results?.broadcast_id ? [s.results.broadcast_id] : []);
      if (!ids.length) return json({ error: 'broadcast não encontrado' }, 404);
      const sum: Record<string, number> = {};
      for (const bid of ids) {
        const r = await z(`/broadcasts/${bid}/recipients?limit=1`);
        for (const [k, v] of Object.entries(r.summary ?? {})) sum[k] = (sum[k] ?? 0) + (Number(v) || 0);
      }
      const nowIso = new Date().toISOString();
      // Lotes cujo horário já passou foram entregues à Meta pela Zernio.
      await admin.from('campaign_send_log').update({ status: 'sent' }).eq('campaign_id', s!.id)
        .eq('status', 'scheduled').lte('scheduled_at', nowIso);
      const slots: { at: string | null }[] = Array.isArray(s?.results?.slots) ? s!.results.slots : [];
      const futureSlot = slots.some((sl) => sl.at && sl.at > nowIso);
      const done = (sum.pending ?? 0) === 0 && !futureSlot;
      await admin.from('campaign_sessions').update({
        ...(!done && slots.some((sl) => sl.at) ? { status: slots.some((sl) => sl.at && sl.at <= nowIso) ? 'running' : 'scheduled' } : {}),
        sent_count: (sum.sent ?? 0) + (sum.delivered ?? 0) + (sum.read ?? 0), failed_count: sum.failed ?? 0,
        ...(done ? { status: (sum.failed ?? 0) > 0 ? 'completed_with_errors' : 'completed', completed_at: new Date().toISOString() } : {}),
        results: { ...s!.results, summary: sum },
      }).eq('id', s!.id);
      return json({ summary: sum });
    }

    return json({ error: `ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error('[zernio-wa-broadcast]', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

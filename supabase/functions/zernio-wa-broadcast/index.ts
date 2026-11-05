// zernio-wa-broadcast — Disparo em massa pelo WhatsApp oficial (Cloud API via Zernio).
// Ações (staff-only): accounts | templates | send | status
// Fora da janela de 24h a Meta só aceita modelo APROVADO; por isso o envio exige template.
// Não toca Evolution/WaLeads nem deals; só cria campaign_sessions + campaign_send_log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
        .map((t: any) => {
          const body = (t.components ?? []).find((c: any) => String(c.type).toUpperCase() === 'BODY');
          const text = body?.text ?? '';
          const vars = Array.from(new Set((text.match(/\{\{(\d+)\}\}/g) ?? []) as string[])).length;
          return { name: t.name, language: t.language, category: t.category, body: text, vars };
        });
      return json({ templates: list });
    }

    if (action === 'send') {
      const { accountId, profileId, templateName, language, name, leadIds, variables } = p;
      if (!accountId || !profileId || !templateName || !language || !name || !Array.isArray(leadIds) || !leadIds.length)
        return json({ error: 'accountId, profileId, templateName, language, name e leadIds são obrigatórios' }, 400);
      if (leadIds.length > 10000) return json({ error: 'máximo 10.000 leads por disparo' }, 400);

      // Leads canônicos com telefone
      const leads: any[] = [];
      for (let i = 0; i < leadIds.length; i += 500) {
        const { data, error } = await admin.from('lia_attendances')
          .select('id,nome,telefone_normalized,telefone_raw')
          .in('id', leadIds.slice(i, i + 500)).is('merged_into', null);
        if (error) throw error;
        leads.push(...(data ?? []));
      }
      const seen = new Set<string>();
      const valid = leads.map((l) => ({ ...l, phone: e164(l.telefone_normalized || l.telefone_raw) }))
        .filter((l) => l.phone && !seen.has(l.phone) && seen.add(l.phone));
      if (!valid.length) return json({ error: 'Nenhum lead com telefone válido' }, 400);

      // Variáveis {{n}} → valores fixos ou nome do contato
      const varList: string[] = Array.isArray(variables) ? variables : [];
      const template: any = { name: templateName, language };
      if (varList.length) {
        template.components = [{ type: 'body', parameters: varList.map((_, i) => ({ type: 'text', text: `{{${i + 1}}}` })) }];
        template.variableMapping = Object.fromEntries(varList.map((v, i) =>
          [String(i + 1), v === '__name__' ? { field: 'name' } : { field: 'custom', customValue: String(v) }]));
      }

      const { data: session, error: sErr } = await admin.from('campaign_sessions').insert({
        name, channel: 'whatsapp_oficial', status: 'running', started_at: new Date().toISOString(),
        lead_ids: valid.map((l) => l.id), lead_count: valid.length, created_by: u.user.id,
        results: { provider: 'zernio_cloud_api', account_id: accountId, template: templateName, language, variables: varList },
      }).select('id').single();
      if (sErr) throw sErr;

      try {
        const created = await z('/broadcasts', { method: 'POST', body: JSON.stringify({
          profileId, accountId, platform: 'whatsapp', name: `${name} · ${session.id.slice(0, 8)}`, template,
        }) });
        const bid = created?.broadcast?.id;
        if (!bid) throw new Error('Zernio não retornou broadcast id');
        let added = 0, skipped = 0;
        for (let i = 0; i < valid.length; i += 500) {
          const r = await z(`/broadcasts/${bid}/recipients`, { method: 'POST',
            body: JSON.stringify({ phones: valid.slice(i, i + 500).map((l) => `+${l.phone}`) }) });
          added += r.added ?? 0; skipped += r.skipped ?? 0;
        }
        await z(`/broadcasts/${bid}/send`, { method: 'POST', body: '{}' });

        const now = new Date().toISOString();
        for (let i = 0; i < valid.length; i += 500) {
          await admin.from('campaign_send_log').insert(valid.slice(i, i + 500).map((l) => ({
            campaign_id: session.id, lead_id: l.id, nome: l.nome, telefone: l.phone,
            status: 'sent', sent_at: now, provider: 'zernio_cloud_api', provider_message_id: bid,
            content_sent: `template:${templateName}`,
          })));
        }
        await admin.from('campaign_sessions').update({
          sent_count: added, failed_count: skipped,
          results: { provider: 'zernio_cloud_api', account_id: accountId, template: templateName, language, variables: varList, broadcast_id: bid, added, skipped },
        }).eq('id', session.id);
        return json({ ok: true, campaign_id: session.id, broadcast_id: bid, added, skipped, total: valid.length });
      } catch (e) {
        await admin.from('campaign_sessions').update({ status: 'failed', completed_at: new Date().toISOString(),
          results: { provider: 'zernio_cloud_api', template: templateName, error: String((e as Error).message) } }).eq('id', session.id);
        throw e;
      }
    }

    if (action === 'status') {
      const { data: s } = await admin.from('campaign_sessions').select('id,results').eq('id', p.campaignId).single();
      const bid = s?.results?.broadcast_id;
      if (!bid) return json({ error: 'broadcast não encontrado' }, 404);
      const r = await z(`/broadcasts/${bid}/recipients?limit=1`);
      const sum = r.summary ?? {};
      const done = (sum.pending ?? 0) === 0;
      await admin.from('campaign_sessions').update({
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

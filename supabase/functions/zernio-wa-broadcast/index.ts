// zernio-wa-broadcast — Disparo em massa pelo WhatsApp oficial (Cloud API via Zernio).
// Ações (staff-only): accounts | templates | send | test | sample | status
// Botões de resposta rápida com link ganham resposta automática (wa_button_reply_rules → zernio-wa-button-reply).
// test = mesmo template para até MAX_TEST_PHONES números digitados (ou o lead fixo TEST_LEAD_ID), sem criar campanha.
// Fora da janela de 24h a Meta só aceita modelo APROVADO; por isso o envio exige template.
// Não toca Evolution/WaLeads nem deals; só cria campaign_sessions + campaign_send_log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  MAX_TEST_PHONES, MEDIA_HEADERS, TEST_LEAD_ID, broadcastKeepsHeaderMedia, checkHeaderImage, isPublicHttpsUrl,
  chunk, contactNameFor, fillTokens, groupKeyValues, namesToPatch, phoneVariants, RECIPIENTS_PER_BROADCAST, wantedNameMap, pickNameVarIndex, planSlots, resolveButtons,
  templateMeta, validateDailyAndCost, validateSchedule,
} from './plan.ts';
import { buildButtonReplies, resolveFormIdForLink } from '../_shared/wa-button-replies.ts';
import { type PendingAttempt, recordFailedAttempt, shouldRecordFailure } from './attempts.ts';

const ZERNIO = 'https://zernio.com/api/v1';
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Mesma janela padrão de campaigns.send_window_start/end (horário de São Paulo). */
const SEND_WINDOW: [string, string] = ['07:30', '19:00'];
/** Gravar o nome de cada contato na Zernio leva ~30 s a cada 1.000 leads; acima disso o envio passaria do tempo. */
const MAX_NAMED_LEADS = 4000;

class MediaNotAccepted extends Error {
  constructor() { super('A Zernio não confirmou a imagem da campanha neste envio. Nada foi enviado, para não sair a imagem-amostra do template.'); }
}

/** Baixa só o necessário para conferir tipo e tamanho da imagem do cabeçalho. */
async function checkRemoteImage(url: string): Promise<string | null> {
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    let len = Number(r.headers.get('content-length'));
    let ct = r.headers.get('content-type');
    if (!r.ok || !Number.isFinite(len) || len <= 0) {
      r = await fetch(url, { redirect: 'follow' });
      ct = r.headers.get('content-type');
      const buf = r.ok ? await r.arrayBuffer() : null;
      len = buf ? buf.byteLength : NaN;
    } else await r.body?.cancel().catch(() => null);
    return checkHeaderImage(r.status, ct, Number.isFinite(len) ? len : null);
  } catch (e) {
    return `Não foi possível abrir o link da imagem (${String((e as Error).message).slice(0, 120)})`;
  }
}

const LEAD_ID_CHUNK = 150;
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
  // Texto livre aceita campos do sistema no meio da frase: "Oi {primeiro_nome}, ...".
  const raw = v.source === 'literal'
    ? fillTokens(String(v.value ?? ''), (k) => (FIELDS[k] ? FIELDS[k](l) : null))
    : FIELDS[v.value](l);
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

  // A Zernio limita pedidos por minuto (600 nesta conta): espera quando a cota está acabando e,
  // se mesmo assim vier 429, aguarda o Retry-After e tenta de novo, em vez de derrubar o grupo.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const z = async (path: string, init?: RequestInit) => {
    for (let attemptNo = 0; ; attemptNo++) {
      const r = await fetch(`${ZERNIO}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      });
      const t = await r.text();
      if (r.status === 429 && attemptNo < 6) {
        const wait = Math.min(Number(r.headers.get('retry-after')) || 10, 65);
        await sleep((wait + 1) * 1000);
        continue;
      }
      let b: any = {}; try { b = JSON.parse(t); } catch { b = { raw: t }; }
      if (!r.ok) throw new Error(`Zernio ${path} ${r.status}: ${b?.error ?? t.slice(0, 300)}`);
      const remaining = Number(r.headers.get('x-ratelimit-remaining'));
      const reset = Number(r.headers.get('x-ratelimit-reset'));
      if (Number.isFinite(remaining) && remaining < 25 && Number.isFinite(reset) && reset > 0)
        await sleep(Math.min(Math.max(reset * 1000 - Date.now(), 0) + 500, 65_000));
      return b;
    }
  };

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = String(p.action ?? '');

  // Disparo real que falhar antes de existir a sessão da campanha é registrado no histórico com o motivo.
  let attempt: PendingAttempt | null = null;
  const res = await (async () => {
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

    if (action === 'send' || action === 'test') {
      const isTest = action === 'test';
      const { accountId, profileId, templateName, language, name, variableMap, description } = p;
      // Teste: números digitados na tela (até MAX_TEST_PHONES) ou, sem número, o lead fixo de teste; nunca cria campanha.
      const rawTestPhones: string[] = isTest && Array.isArray(p.testPhones)
        ? p.testPhones.map((x: unknown) => String(x ?? '').trim()).filter(Boolean) : [];
      if (rawTestPhones.length > MAX_TEST_PHONES) return json({ error: `Teste aceita no máximo ${MAX_TEST_PHONES} números` }, 400);
      const testPhones: string[] = [];
      for (const raw of rawTestPhones) {
        const ph = e164(raw);
        if (!ph) return json({ error: `Número inválido para teste: ${raw}. Use DDD + número, ex.: 16 99999-9999` }, 400);
        if (!testPhones.includes(ph)) testPhones.push(ph);
      }
      const leadIds: string[] = isTest ? (testPhones.length ? [] : [TEST_LEAD_ID]) : p.leadIds;
      if (!accountId || !profileId || !templateName || !language || !name || !Array.isArray(leadIds) || (!leadIds.length && !testPhones.length))
        return json({ error: 'accountId, profileId, templateName, language, name e leadIds são obrigatórios' }, 400);
      if (!isTest) attempt = {
        name: String(name), description: description ?? null, userId: u.user.id, leadIds, accountId: String(accountId),
        templateName: String(templateName), language: String(language),
      };
      if (leadIds.length > 10000) return json({ error: 'máximo 10.000 leads por disparo' }, 400);
      const nowDate = new Date();
      const perHour = isTest || p.perHour == null || p.perHour === '' ? null : Number(p.perHour);
      const scheduledAt = !isTest && p.scheduledAt ? new Date(String(p.scheduledAt)).toISOString() : null;
      if (!isTest) {
        const schedErr = validateSchedule(p.perHour, p.scheduledAt, nowDate) ?? validateDailyAndCost(p.perDay, p.costPerMessage);
        if (schedErr) return json({ error: schedErr }, 400);
      }
      const perDay = isTest || p.perDay == null || p.perDay === '' ? null : Number(p.perDay);
      const costPerMessage = isTest || p.costPerMessage == null || p.costPerMessage === '' ? null : Number(p.costPerMessage);
      const campaignId = !isTest && UUID_RE.test(String(p.campaignId ?? '')) ? String(p.campaignId) : null;

      // Cabeçalho e botões lidos do template aprovado na Meta (não do navegador): com mídia, exige a imagem
      // da campanha e nunca envia com a amostra aprovada.
      const tb = await z(`/whatsapp/templates?accountId=${encodeURIComponent(accountId)}&status=APPROVED`);
      const tplRaw = (tb.templates ?? tb.data ?? []).find((t: any) => t.name === templateName && t.language === language
        && String(t.status ?? '').toUpperCase() === 'APPROVED');
      if (!tplRaw) return json({ error: `Template ${templateName} (${language}) não está aprovado nesta conta` }, 400);
      const meta = templateMeta(tplRaw);
      if (meta.headerType === 'LOCATION') return json({ error: 'Templates com cabeçalho de localização não são suportados' }, 400);
      const headerMediaUrl = p.headerMediaUrl ? String(p.headerMediaUrl).trim() : '';
      const mediaHeader = MEDIA_HEADERS.includes(meta.headerType);
      if (mediaHeader && !headerMediaUrl)
        return json({ error: meta.headerType === 'IMAGE' ? 'Imagem da campanha obrigatória' : `O template tem cabeçalho ${meta.headerType}: envie a mídia da campanha. A amostra aprovada nunca é enviada.` }, 400);
      if (mediaHeader && !isPublicHttpsUrl(headerMediaUrl)) return json({ error: 'O link da imagem precisa ser uma URL pública https' }, 400);
      if (meta.headerType === 'IMAGE') {
        const mediaErr = await checkRemoteImage(headerMediaUrl);
        if (mediaErr) return json({ error: mediaErr }, 400);
      }
      const mediaType = meta.headerType.toLowerCase() as 'image' | 'video' | 'document';
      const btn = resolveButtons(meta.buttons, p.buttonLinks && typeof p.buttonLinks === 'object' ? p.buttonLinks : null);
      if ('error' in btn) return json({ error: btn.error }, 400);
      // Resposta automática dos botões de resposta rápida (rótulo, link, texto e formulário do link).
      const br = buildButtonReplies(meta.buttons, p.buttonLinks, p.buttonReplies && typeof p.buttonReplies === 'object' ? p.buttonReplies : null);
      if ('error' in br) return json({ error: br.error }, 400);
      const buttonReplies = await Promise.all(br.replies.map(async (r) => ({ ...r, form_id: await resolveFormIdForLink(admin, r.link).catch(() => null) })));
      const vmap: VarSpec[] = Array.isArray(variableMap) ? variableMap : [];
      for (const v of vmap) {
        if (v?.source === 'field' && !FIELDS[v.value]) return json({ error: `campo inválido: ${v?.value}` }, 400);
        if (v?.source !== 'field' && v?.source !== 'literal') return json({ error: 'variableMap inválido' }, 400);
      }
      // A variável de nome é preenchida pela Zernio com o nome do contato, por destinatário; assim nomes
      // diferentes não viram envios separados (antes: 1 envio por nome, barrando públicos acima de ~600).
      const nameIdx = pickNameVarIndex(vmap);
      if (nameIdx >= 0 && leadIds.length > MAX_NAMED_LEADS)
        return json({ error: `Com o nome do lead na mensagem, cada disparo aceita até ${MAX_NAMED_LEADS.toLocaleString('pt-BR')} leads. Divida o público em mais de uma campanha.` }, 400);

      // Leads canônicos com telefone
      const leads: any[] = [];
      // IDs vão na URL da consulta: 500 UUIDs passam de 18 KB e a requisição nem sai; 150 ficam em ~5,5 KB.
      for (let i = 0; i < leadIds.length; i += LEAD_ID_CHUNK) {
        const { data, error } = await admin.from('lia_attendances')
          .select(`id,telefone_normalized,telefone_raw,${LEAD_COLS}`)
          .in('id', leadIds.slice(i, i + LEAD_ID_CHUNK)).is('merged_into', null);
        if (error) throw error;
        leads.push(...(data ?? []));
      }
      // Números de teste digitados: usa os dados do lead com esse telefone (se existir) só para preencher as variáveis.
      for (const ph of testPhones) {
        const { data: match } = await admin.from('lia_attendances')
          .select(`id,telefone_normalized,telefone_raw,${LEAD_COLS}`)
          .in('telefone_normalized', phoneVariants(ph).map((d) => `+${d}`)).is('merged_into', null)
          .order('updated_at', { ascending: false }).limit(1);
        leads.push({ ...(match?.[0] ?? { nome: null }), forcedPhone: ph });
      }
      const seen = new Set<string>();
      const valid = leads.map((l) => ({ ...l, phone: l.forcedPhone ?? e164(l.telefone_normalized || l.telefone_raw) }))
        .filter((l) => l.phone && !seen.has(l.phone) && seen.add(l.phone));
      if (!valid.length) return json({ error: 'Nenhum lead com telefone válido' }, 400);

      // Zernio só aceita valor fixo por broadcast → agrupa por combinação de variáveis (dentro de cada lote).
      // Lotes por hora sobre o TOTAL, dentro da janela de envio da campanha; dentro de cada lote, um broadcast
      // por combinação de variáveis.
      const planned = planSlots(valid, { perHour, perDay, scheduledAt, now: nowDate, windowStart: SEND_WINDOW[0], windowEnd: SEND_WINDOW[1] });
      const lastPlanned = planned[planned.length - 1]?.at;
      if (lastPlanned && new Date(lastPlanned).getTime() > nowDate.getTime() + 60 * 86_400_000)
        return json({ error: 'Com esse limite por dia o último lote passaria de 60 dias. Aumente o máximo por dia ou divida o público.' }, 400);
      const slots = planned.map((sl) => {
        const groups = new Map<string, { values: string[]; leads: any[] }>();
        for (const l of sl.leads) {
          const values = vmap.map((v) => resolveVar(v, l));
          if (nameIdx >= 0) l.contactName = contactNameFor(values[nameIdx]);
          const k = JSON.stringify(groupKeyValues(values, nameIdx));
          if (!groups.has(k)) groups.set(k, { values, leads: [] });
          groups.get(k)!.leads.push(l);
        }
        return { at: sl.at, groups: [...groups.values()].flatMap((g) =>
          chunk(g.leads, RECIPIENTS_PER_BROADCAST).map((leads) => ({ values: g.values, leads }))) };
      });
      const totalBroadcasts = slots.reduce((a, sl) => a + sl.groups.length, 0);
      if (totalBroadcasts > 400) return json({ error: `O disparo geraria ${totalBroadcasts} envios distintos (máx. 400). Use campos com menos variação ou um limite por hora maior.` }, 400);

      // Cria um broadcast; com mídia, confere que a Zernio guardou a imagem da campanha antes de qualquer envio.
      const createBroadcast = async (bname: string, values: string[]) => {
        const template: any = { name: templateName, language };
        const components: any[] = [];
        if (mediaHeader) {
          components.push({ type: 'header', parameters: [{ type: mediaType, [mediaType]: { link: headerMediaUrl } }] });
          template.headerMedia = { type: mediaType, link: headerMediaUrl };
        }
        if (values.length) {
          components.push({ type: 'body', parameters: values.map((_, i) => ({ type: 'text', text: `{{${i + 1}}}` })) });
          template.variableMapping = Object.fromEntries(values.map((v, i) =>
            [String(i + 1), i === nameIdx ? { field: 'name' } : { field: 'custom', customValue: v }]));
        }
        if (btn.components.length) {
          components.push(...btn.components);
          template.buttonParams = btn.params;
        }
        if (components.length) template.components = components;
        const created = await z('/broadcasts', { method: 'POST', body: JSON.stringify({
          profileId, accountId, platform: 'whatsapp', name: bname, template,
        }) });
        const bid = created?.broadcast?.id;
        if (!bid) throw new Error('Zernio não retornou broadcast id');
        if (mediaHeader) {
          const got = await z(`/broadcasts/${bid}`).catch((e) => ({ error: String(e) }));
          const kept = broadcastKeepsHeaderMedia(created, headerMediaUrl) || broadcastKeepsHeaderMedia(got, headerMediaUrl);
          if (!kept) {
            console.error('[zernio-wa-broadcast] Zernio não confirmou headerMedia', JSON.stringify({ created, got }).slice(0, 4000));
            await z(`/broadcasts/${bid}`, { method: 'DELETE' }).catch(() => null);
            throw new MediaNotAccepted();
          }
        }
        return bid as string;
      };

      // A Zernio copia o nome do contato para o destinatário no instante em que ele entra no envio, e o contato
      // novo nasce com o telefone como nome; corrigir o contato depois não muda a cópia. Por isso: 1) um rascunho
      // de preparo (nunca enviado) cria/acha os contatos e grava o nome; 2) só então o envio real recebe os
      // destinatários; 3) a cópia é conferida antes de enviar. Se algo falhar, o grupo não é enviado.
      // Cada envio tem no máximo RECIPIENTS_PER_BROADCAST destinatários e é lido numa página só, porque a
      // paginação da Zernio repete e pula destinatários (nomes ficavam sem conferir).
      const listRecipients = async (bid: string, expected: number) => {
        const r = await z(`/broadcasts/${bid}/recipients?limit=${RECIPIENTS_PER_BROADCAST}`);
        const recipients: any[] = r.recipients ?? [];
        const total = Number(r.pagination?.total ?? recipients.length);
        if (r.pagination?.hasMore || total !== recipients.length || recipients.length > expected)
          throw new Error(`A Zernio listou ${recipients.length} de ${total} destinatário(s); este grupo não foi enviado.`);
        return recipients;
      };
      const addPhones = async (bid: string, list: any[]) => {
        const r = await z(`/broadcasts/${bid}/recipients`, { method: 'POST',
          body: JSON.stringify({ phones: list.map((l) => `+${l.phone}`) }) });
        return { added: Number(r.added ?? 0), skipped: Number(r.skipped ?? 0) };
      };
      const addContacts = async (bid: string, contactIds: string[]) => {
        const r = await z(`/broadcasts/${bid}/recipients`, { method: 'POST', body: JSON.stringify({ contactIds }) });
        return { added: Number(r.added ?? 0), skipped: Number(r.skipped ?? 0) };
      };
      // Devolve os contatos exatos (já com o nome certo) que vão entrar no envio real; sem nome na mensagem,
      // devolve null e o envio recebe os telefones direto.
      const prepareContactNames = async (list: any[]): Promise<string[] | null> => {
        if (nameIdx < 0) return null;
        // Números novos nascem já com o nome (um pedido para o bloco todo); os existentes são ignorados aqui.
        const bulk = await z('/contacts/bulk', { method: 'POST', body: JSON.stringify({
          profileId, accountId, contacts: list.map((l) => ({ name: l.contactName, platformIdentifier: l.phone })),
        }) }).catch((e) => { console.error('[zernio-wa-broadcast] criação em lote falhou', e); return null; });
        if (bulk?.errors?.length) console.warn('[zernio-wa-broadcast] contatos recusados', JSON.stringify(bulk.errors).slice(0, 1000));
        const probe = await z('/broadcasts', { method: 'POST', body: JSON.stringify({
          profileId, accountId, platform: 'whatsapp', name: `PREPARO (não enviar) · ${name}`.slice(0, 200),
          template: { name: templateName, language },
        }) });
        const pid = probe?.broadcast?.id;
        if (!pid) throw new Error('Zernio não retornou o rascunho de preparo dos nomes');
        try {
          await addPhones(pid, list);
          const recipients = await listRecipients(pid, list.length);
          const todo = namesToPatch(recipients, wantedNameMap(list));
          let failed = 0;
          for (let i = 0; i < todo.length; i += 10) {
            await Promise.all(todo.slice(i, i + 10).map(async (t) => {
              try { await z(`/contacts/${t.contactId}`, { method: 'PATCH', body: JSON.stringify({ name: t.name }) }); }
              catch { failed++; }
            }));
          }
          if (failed) throw new Error(`Não foi possível gravar o nome de ${failed} contato(s) na Zernio; este grupo não foi enviado.`);
          return [...new Set(recipients.map((r: any) => String(r.contactId ?? '')).filter(Boolean))];
        } finally {
          await z(`/broadcasts/${pid}`, { method: 'DELETE' }).catch(() => null);
        }
      };
      // Envio real: entra com os mesmos contatos preparados e confere a cópia do nome antes de enviar.
      const fillRecipients = async (bid: string, list: any[], contactIds: string[] | null) => {
        const r = contactIds ? await addContacts(bid, contactIds) : await addPhones(bid, list);
        if (nameIdx >= 0) {
          const wrong = namesToPatch(await listRecipients(bid, list.length), wantedNameMap(list));
          if (wrong.length) {
            await z(`/broadcasts/${bid}`, { method: 'DELETE' }).catch(() => null);
            throw new Error(`A Zernio não gravou o nome de ${wrong.length} contato(s) no envio; este grupo não foi enviado.`);
          }
        }
        return r;
      };
      const textFor = (g: { values: string[] }, l: any) => {
        const vals = g.values.map((v, i) => (i === nameIdx ? l.contactName : v));
        return (vals.length ? `template:${templateName} | ${vals.join(' | ')}` : `template:${templateName}`)
          + (mediaHeader ? ` | ${meta.headerType.toLowerCase()}:${headerMediaUrl}` : '');
      };

      if (isTest) {
        try {
          let added = 0;
          const ids: string[] = [];
          for (const g of slots.flatMap((sl) => sl.groups)) {
            const cids = await prepareContactNames(g.leads);
            const bid = await createBroadcast(`TESTE · ${name} · ${nowDate.toISOString().slice(0, 16)}`, g.values);
            const r = await fillRecipients(bid, g.leads, cids);
            await z(`/broadcasts/${bid}/send`, { method: 'POST', body: '{}' });
            added += r.added; ids.push(bid);
          }
          if (buttonReplies.length) {
            const { error: rErr } = await admin.from('wa_button_reply_rules').insert({
              account_id: accountId, broadcast_ids: ids, is_test: true, test_phones: valid.map((l) => l.phone),
              buttons: buttonReplies, expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
            });
            if (rErr) console.error('[zernio-wa-broadcast] regra de resposta (teste) falhou', rErr);
          }
          return json({
            ok: true, test: true, broadcast_ids: ids, added,
            phones: valid.map((l) => `+${l.phone}`), lead: testPhones.length ? null : valid[0]?.nome, warnings: btn.warnings,
          });
        } catch (e) {
          if (e instanceof MediaNotAccepted) return json({ error: e.message }, 502);
          throw e;
        }
      }

      const isScheduled = slots.some((sl) => sl.at);
      const estimatedCost = costPerMessage != null ? Math.round(valid.length * costPerMessage * 100) / 100 : null;
      const startAt = slots[0]?.at ?? null;
      const baseResults = {
        provider: 'zernio_cloud_api', account_id: accountId, template: templateName, language, variable_map: vmap,
        header_type: meta.headerType, header_media_url: mediaHeader ? headerMediaUrl : null,
        per_hour: perHour, per_day: perDay, scheduled_at: startAt, button_links: btn.stored, button_replies: buttonReplies,
        cost_per_message: costPerMessage, estimated_cost: estimatedCost,
      };

      if (campaignId) {
        const { data: exists } = await admin.from('campaigns').select('id').eq('id', campaignId).maybeSingle();
        if (exists) return json({ error: 'Esta campanha já foi enviada. Recarregue a tela para criar outra.' }, 409);
      }
      const { data: camp } = await admin.from('campaigns').insert({
        ...(campaignId ? { id: campaignId } : {}),
        nome: name, descricao: description ?? null, canal: 'whatsapp_oficial', status: isScheduled ? 'scheduled' : 'sending',
        mensagem_template: `template:${templateName}`, total_leads: valid.length,
        send_window_start: SEND_WINDOW[0], send_window_end: SEND_WINDOW[1],
        metadata: { button_links: btn.stored, button_replies: buttonReplies, per_day: perDay, cost_per_message: costPerMessage, estimated_cost: estimatedCost },
        ...(isScheduled ? { scheduled_at: startAt } : { started_at: nowDate.toISOString() }),
        created_by: u.user.id,
      }).select('id').maybeSingle();
      if (attempt) attempt.campaignRowId = camp?.id ?? null;

      const { data: session, error: sErr } = await admin.from('campaign_sessions').insert({
        name, channel: 'whatsapp_oficial', status: isScheduled ? 'scheduled' : 'running',
        ...(isScheduled ? { scheduled_at: startAt } : { started_at: nowDate.toISOString() }),
        lead_ids: valid.map((l) => l.id), lead_count: valid.length, created_by: u.user.id,
        results: { ...baseResults, campaign_id: camp?.id ?? null },
      }).select('id').single();
      if (sErr) throw sErr;
      attempt = null; // a partir daqui a própria sessão registra falhas e resultado

      const broadcasts: string[] = [];
      const slotLog: { at: string | null; broadcast_ids: string[]; leads: number }[] = [];
      let added = 0, skipped = 0, failedGroups = 0;
      let mediaRefused = false;
      outer: for (const sl of slots) {
        const slotIds: string[] = [];
        for (const g of sl.groups) {
          try {
            const cids = await prepareContactNames(g.leads);
            const bid = await createBroadcast(`${name} · ${session.id.slice(0, 8)} · ${broadcasts.length + 1}`, g.values);
            const r = await fillRecipients(bid, g.leads, cids);
            added += r.added; skipped += r.skipped;
            if (sl.at) await z(`/broadcasts/${bid}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt: sl.at }) });
            else await z(`/broadcasts/${bid}/send`, { method: 'POST', body: '{}' });
            broadcasts.push(bid); slotIds.push(bid);
            for (let i = 0; i < g.leads.length; i += 500) {
              await admin.from('campaign_send_log').insert(g.leads.slice(i, i + 500).map((l) => ({
                campaign_id: session.id, source_campaign_id: camp?.id ?? null, lead_id: l.id, nome: l.nome, telefone: l.phone,
                provider: 'zernio_cloud_api', provider_message_id: bid, content_sent: textFor(g, l),
                ...(sl.at ? { status: 'scheduled', scheduled_at: sl.at } : { status: 'sent', sent_at: nowDate.toISOString() }),
              })));
            }
          } catch (e) {
            failedGroups++;
            console.error('[zernio-wa-broadcast] grupo falhou', e);
            if (e instanceof MediaNotAccepted) { mediaRefused = true; break outer; }
            await admin.from('campaign_send_log').insert(g.leads.map((l) => ({
              campaign_id: session.id, source_campaign_id: camp?.id ?? null, lead_id: l.id, nome: l.nome, telefone: l.phone,
              status: 'failed', provider: 'zernio_cloud_api', error_message: String((e as Error).message).slice(0, 500),
              content_sent: `template:${templateName}`, ...(sl.at ? { scheduled_at: sl.at } : {}),
            })));
          }
        }
        slotLog.push({ at: sl.at, broadcast_ids: slotIds, leads: sl.groups.reduce((a, g) => a + g.leads.length, 0) });
      }
      if (buttonReplies.length && broadcasts.length) {
        const lastAt = slotLog.reduce((m, sl) => Math.max(m, sl.at ? new Date(sl.at).getTime() : nowDate.getTime()), nowDate.getTime());
        const { error: rErr } = await admin.from('wa_button_reply_rules').insert({
          campaign_id: camp?.id ?? null, session_id: session.id, account_id: accountId, broadcast_ids: broadcasts,
          buttons: buttonReplies, expires_at: new Date(lastAt + 30 * 86_400_000).toISOString(),
        });
        if (rErr) console.error('[zernio-wa-broadcast] regra de resposta falhou', rErr);
      }
      const status = broadcasts.length === 0 ? 'failed' : failedGroups ? 'completed_with_errors' : (isScheduled ? 'scheduled' : 'running');
      await admin.from('campaign_sessions').update({
        status, sent_count: isScheduled ? 0 : added, failed_count: skipped,
        results: { ...baseResults, campaign_id: camp?.id ?? null, broadcast_id: broadcasts[0] ?? null, broadcast_ids: broadcasts,
          slots: slotLog, added, skipped, failed_groups: failedGroups, ...(mediaRefused ? { media_refused: true } : {}) },
      }).eq('id', session.id);
      if (camp?.id) await admin.from('campaigns').update({
        total_sent: isScheduled ? 0 : added, total_failed: skipped,
        status: broadcasts.length ? (failedGroups ? 'completed_with_errors' : (isScheduled ? 'scheduled' : 'completed')) : 'failed',
      }).eq('id', camp.id);
      if (mediaRefused && !broadcasts.length) return json({ error: new MediaNotAccepted().message }, 502);
      if (!broadcasts.length) return json({ error: 'Nenhum envio foi aceito pela Zernio' }, 502);
      return json({ ok: true, campaign_id: session.id, broadcasts: broadcasts.length, added, skipped, total: valid.length,
        failed_groups: failedGroups, scheduled: isScheduled, scheduled_at: startAt, slots: slotLog.length,
        last_slot_at: slotLog[slotLog.length - 1]?.at ?? null, warnings: btn.warnings });
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
  })();
  if (attempt && shouldRecordFailure(res.status)) {
    const body = await res.clone().json().catch(() => ({}));
    await recordFailedAttempt(admin, attempt, String(body?.error ?? `Erro ${res.status}`));
  }
  return res;
});

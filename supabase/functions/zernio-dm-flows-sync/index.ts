// zernio-dm-flows-sync — cria/atualiza um flow IG DM por formulário com palavra-gatilho.
// Quando um usuário do Instagram comenta/manda DM com a palavra-gatilho, o flow envia
// uma DM com o link encurtado (landing page publicada, senão o formulário).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHORT_BASE = 'https://s.smartdent.com.br';

// Único produto que já tem landing page pronta; os demais usam o link curto do formulário.
const LANDING_PAGE_SLUGS = new Set(['exocad_dentalcad_rms']);

// A Zernio não faz template de variáveis na DM: qualquer {{...}} chega literal ao usuário.
// Por isso as mensagens são escritas sem placeholders.
function dmMessages(produto: string, link: string): string[] {
  return [
    [
      `Olá! Que bom que você se interessou pelo ${produto}!`,
      'Abaixo segue o link onde você terá todas as informações. Qualquer dúvida, estamos à disposição.',
      `Link: ${link}`,
    ].join('\n\n'),
    [
      `Oi! Vi seu comentário sobre o ${produto} 😊`,
      'Separei tudo pra você neste link — informações completas, e se precisar de ajuda me chama por aqui.',
      `Link: ${link}`,
    ].join('\n\n'),
    [
      `Olá! Aqui estão as informações do ${produto} que você pediu.`,
      'Dá uma olhada no link abaixo e qualquer dúvida responde essa mensagem que a gente te ajuda.',
      `Link: ${link}`,
    ].join('\n\n'),
  ];
}

// Respostas públicas ao comentário: nunca pedir a palavra-gatilho de novo
// (o usuário já escreveu). Sempre confirmar que a DM foi enviada.
function commentReplies(): string[] {
  return [
    'Acabei de mandar as informações na sua DM! 📩',
    'Prontinho, já te enviei tudo no direct 📲',
    'Enviei agora as informações no seu direct — confere lá! 👀',
    'Respondi no direct com todos os detalhes 💬',
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const onlySlug: string | null = body?.form_slug ?? null;
    const activate: boolean = body?.activate !== false; // por padrão ativa os flows
    const dryRun: boolean = body?.dry_run === true;

    let q = supabase
      .from('smartops_forms')
      .select('id, name, slug, title, active, product_catalog_id, workflow_stage_target, ig_trigger_keyword, ig_trigger_cta, ig_trigger_dm_message, ig_trigger_enabled')
      .not('ig_trigger_keyword', 'is', null);
    if (onlySlug) q = q.eq('slug', onlySlug);
    const { data: forms, error: formsErr } = await q;
    if (formsErr) throw formsErr;

    // Landing pages publicadas
    const { data: lps } = await supabase
      .from('smartops_form_landing_pages')
      .select('form_id, status');
    const publishedLp = new Set((lps ?? []).filter((l: any) => l.status === 'published').map((l: any) => l.form_id));

    // Links curtos existentes
    const { data: shorts } = await supabase
      .from('smartops_short_links')
      .select('short_code, form_slug, default_target');
    const shortByKey = new Map<string, string>();
    (shorts ?? []).forEach((s: any) => {
      if (s.form_slug && s.short_code) shortByKey.set(`${s.default_target}:${s.form_slug}`, s.short_code);
    });

    // Nomes de produto do catálogo
    const catalogIds = Array.from(new Set((forms ?? []).map((f: any) => f.product_catalog_id).filter(Boolean)));
    const catalogById = new Map<string, any>();
    if (catalogIds.length) {
      const { data: cat } = await supabase
        .from('system_a_catalog')
        .select('id, name, slug, category')
        .in('id', catalogIds);
      (cat ?? []).forEach((c: any) => catalogById.set(c.id, c));
    }

    const results: any[] = [];

    for (const f of forms ?? []) {
      const keyword = String(f.ig_trigger_keyword ?? '').trim().toUpperCase();
      if (!keyword) continue;

      // Por enquanto só o exocad DentalCad RMS aponta para a landing page; os demais vão para o formulário.
      const target: 'landing_page' | 'form' =
        LANDING_PAGE_SLUGS.has(String(f.slug)) && publishedLp.has(f.id) ? 'landing_page' : 'form';
      let code = shortByKey.get(`${target}:${f.slug}`) ?? shortByKey.get(`form:${f.slug}`) ?? null;
      if (!code && !dryRun) {
        const { data: newCode, error: slErr } = await supabase.rpc('generate_short_link', {
          p_form_slug: f.slug,
          p_target: target,
        });
        if (slErr) {
          results.push({ slug: f.slug, ok: false, error: `short_link: ${slErr.message}` });
          continue;
        }
        code = String(newCode);
        shortByKey.set(`${target}:${f.slug}`, code);
      }
      if (!code) { results.push({ slug: f.slug, ok: false, error: 'sem_link_curto' }); continue; }

      const link = `${SHORT_BASE}/${code}`;
      const catalog = f.product_catalog_id ? catalogById.get(f.product_catalog_id) : null;
      const produto = catalog?.name || f.title || String(f.name ?? '').replace(/^#\s*-\s*(FORMS|Formulário)\s*-\s*/i, '').trim();
      const custom = String(f.ig_trigger_dm_message ?? '').trim().replace(/\{\{\s*[\w.]+\s*\}\}/g, '').trim();
      const generated = dmMessages(produto, link);
      const message = custom || generated[0];
      const messageVariations = custom ? generated.slice(0, 2) : generated.slice(1);
      const replies = commentReplies();
      const commentReply = replies[0];
      const commentReplyVariations = replies.slice(1);

      const nodes = [
        {
          id: 'dm',
          type: 'default',
          position: { x: 120, y: 80 },
          data: {
            label: `DM com link — ${produto}`,
            nodeType: 'send_dm',
            config: { message },
          },
        },
        {
          id: 'end',
          type: 'default',
          position: { x: 120, y: 240 },
          data: { label: 'Fim', nodeType: 'end', config: {} },
        },
      ];
      const edges = [{ id: 'e-dm-end', source: 'dm', target: 'end' }];

      const flowPayload: any = {
        name: `DM IG — ${produto}`,
        description: `Palavra-gatilho "${keyword}" → DM com link ${link}${f.active ? '' : ' (formulário inativo)'}`,
        channel: 'instagram',
        is_active: activate && f.ig_trigger_enabled !== false && !!f.active,
        nodes,
        edges,
        produto_slug: catalog?.slug ?? f.slug,
        produto_nome: produto,
        produto_categoria: catalog?.category ?? null,
        form_name: f.slug,
        zernio_automation_config: {
          keywords: [keyword],
          dm_message: message,
          comment_reply: commentReply,
          short_link: link,
          short_link_target: target,
          form_slug: f.slug,
        },
        updated_at: new Date().toISOString(),
      };

      if (dryRun) { results.push({ slug: f.slug, ok: true, dry_run: true, keyword, link, produto }); continue; }

      const { data: existing } = await supabase
        .from('social_flows')
        .select('id')
        .eq('form_name', f.slug)
        .maybeSingle();

      let flowId = existing?.id ?? null;
      if (flowId) {
        const { error } = await supabase.from('social_flows').update(flowPayload).eq('id', flowId);
        if (error) { results.push({ slug: f.slug, ok: false, error: error.message }); continue; }
      } else {
        const { data: ins, error } = await supabase.from('social_flows').insert(flowPayload).select('id').single();
        if (error) { results.push({ slug: f.slug, ok: false, error: error.message }); continue; }
        flowId = ins.id;
      }

      // Triggers: comentário + DM com a mesma palavra
      const { data: trg } = await supabase
        .from('social_triggers')
        .select('id, trigger_type')
        .eq('flow_id', flowId);
      const byType = new Map((trg ?? []).map((t: any) => [t.trigger_type, t.id]));
      for (const type of ['comment_keyword', 'dm_keyword']) {
        const payload = { flow_id: flowId, trigger_type: type, keywords: [keyword], is_regex: false, priority: 10 };
        const id = byType.get(type);
        if (id) await supabase.from('social_triggers').update(payload).eq('id', id);
        else await supabase.from('social_triggers').insert(payload);
      }

      results.push({ slug: f.slug, ok: true, flow_id: flowId, keyword, link, produto, active: flowPayload.is_active });
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      created_or_updated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

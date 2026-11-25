import { campaignIntent, campaignPhone, campaignSubmissionId, categoryMenu, selectedCategory, serviceWindowOpen } from '../_shared/wa-campaign-intent.ts';
import { matchReply, resolveFormIdForLink } from '../_shared/wa-button-replies.ts';

// No caller-supplied identity, campaign, product, seller or text is accepted.
// All attribution comes from the stored inbox and a successful prior send.
export async function processCampaignReply(db: any, inboxId: string, dryRun: boolean, ingest: (payload: Record<string, unknown>) => Promise<any>, sendMenu: (conversationId: string, accountId: string, interactive: unknown) => Promise<string | null>) {
  const { data: msg, error: inboxError } = await db.from('whatsapp_inbox')
    .select('id,phone,lead_id,direction,instance_name,is_group,message_text,raw_payload,created_at,sender_name')
    .eq('id', inboxId).maybeSingle();
  if (inboxError) throw inboxError;
  if (!msg || msg.direction !== 'inbound' || msg.is_group || !String(msg.instance_name).startsWith('zernio:') || msg.raw_payload?.test)
    return { inbox_id: inboxId, skipped: 'not_campaign_inbound' };
  const pressed = msg.raw_payload?.metadata?.buttonPayload ?? msg.raw_payload?.metadata?.interactiveId;
  const intent = campaignIntent(msg.message_text, pressed);
  const identity = campaignPhone(String(msg.phone));
  if (!identity) return { inbox_id: inboxId, skipped: 'invalid_phone' };
  const { data: staff, error: staffError } = await db.rpc('fn_team_member_by_phone', { p_phone: identity.phone });
  // The shared team matcher is authoritative; a read failure never qualifies staff.
  if (staffError) throw staffError;
  if (Array.isArray(staff) ? staff.length > 0 : !!staff) return { inbox_id: inboxId, skipped: 'team_phone' };

  const accountId = String(msg.instance_name).slice('zernio:'.length);
  const { data: pendingRows, error: pendingError } = await db.from('wa_campaign_lead_jobs').select('*')
    .eq('phone', identity.phone).eq('account_id', accountId)
    .in('status', ['awaiting_category', 'waiting_window', 'failed', 'processing'])
    .order('created_at', { ascending: false }).limit(20);
  if (pendingError) throw pendingError;
  const choice = pressed || msg.message_text;
  for (const pending of pendingRows ?? []) {
    const index = selectedCategory(pending.id, pending.categories ?? [], choice);
    if (index !== null && pending.menu_sent_at) {
      if (dryRun) return { inbox_id: inboxId, eligible: true, action: 'category_selected', category: pending.categories[index].label };
      const { data: claimed, error } = await db.rpc('fn_claim_wa_category', { p_job_id: pending.id, p_inbox_id: inboxId, p_category_index: index });
      if (error) throw error;
      const job = claimed?.[0];
      if (!job) return { inbox_id: inboxId, skipped: 'already_registered_or_processing' };
      return await finalizeChoice(db, job, msg, ingest);
    }
    const pageMatch = /^wa-page:([0-9a-f-]+):(\d+)$/i.exec(String(choice || ''));
    if (pageMatch && pageMatch[1] === pending.id && pending.menu_sent_at) {
      const page = Number(pageMatch[2]);
      if (page < 1 || page * 9 >= pending.categories.length) return { skipped: 'invalid_category_page' };
      if (dryRun) return { eligible: true, action: 'category_page' };
      return await offerCategories(db, pending, msg, sendMenu, page);
    }
  }
  // A category token from another session/phone never becomes a new campaign conversion.
  if (/^wa-(?:interest|page):/.test(String(choice || ''))) return { inbox_id: inboxId, skipped: 'invalid_category_selection' };
  if (intent === 'none') return { inbox_id: inboxId, skipped: 'no_explicit_interest' };
  const waiting = (pendingRows ?? []).find((j: any) => ['awaiting_category', 'waiting_window'].includes(j.status));
  if (waiting) {
    if (dryRun) return { inbox_id: inboxId, eligible: true, action: 'awaiting_category', campaign_id: waiting.campaign_id };
    if (waiting.status === 'awaiting_category') return { inbox_id: inboxId, skipped: 'category_menu_already_sent' };
    return await offerCategories(db, waiting, msg, sendMenu);
  }

  const quoted = String(msg.raw_payload?.metadata?.quotedMessage?.platformMessageId ?? msg.raw_payload?.metadata?.quotedMessageId ?? '');
  let quotedBroadcast = '';
  if (quoted) {
    const { data: out, error } = await db.from('whatsapp_inbox').select('raw_payload').eq('wa_message_id', quoted).maybeSingle();
    if (error) throw error;
    quotedBroadcast = String(out?.raw_payload?.message?.broadcastId ?? '');
  }
  let q = db.from('campaign_send_log')
    .select('campaign_id,source_campaign_id,lead_id,nome,email,provider_message_id,wa_message_id,sent_at')
    .eq('provider', 'zernio_cloud_api').eq('status', 'sent')
    .in('telefone', identity.variants).lte('sent_at', msg.created_at)
    .order('sent_at', { ascending: false }).limit(100);
  if (quotedBroadcast) q = q.eq('provider_message_id', quotedBroadcast);
  const { data: sends, error: sendError } = await q;
  if (sendError) throw sendError;
  let reached: any = null;
  let session: any = null;
  for (const send of sends ?? []) {
    if (quoted && !quotedBroadcast && send.wa_message_id !== quoted) continue;
    const { data: s, error } = await db.from('campaign_sessions').select('id,name,results').eq('id', send.campaign_id).maybeSingle();
    if (error) throw error;
    if (s?.results?.account_id !== accountId || !send.source_campaign_id) continue;
    reached = send; session = s; break;
  }
  if (!reached) return { inbox_id: inboxId, skipped: 'no_prior_official_campaign' };
  const { data: campaign, error: campaignError } = await db.from('campaigns').select('id,nome,metadata').eq('id', reached.source_campaign_id).maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign) return { inbox_id: inboxId, skipped: 'campaign_not_found' };

  // Prefer the sent audience's canonical identity; never infer a person from a company name.
  let lead: any = null;
  const knownId = reached.lead_id ?? msg.lead_id;
  if (knownId) {
    const { data, error } = await db.from('lia_attendances')
      .select('id,nome,email,telefone_normalized,do_not_contact,whatsapp_opt_out')
      .eq('id', knownId).is('merged_into', null).maybeSingle();
    if (error) throw error;
    lead = data;
  }
  if (!lead) {
    const { data, error } = await db.from('lia_attendances')
      .select('id,nome,email,telefone_normalized,do_not_contact,whatsapp_opt_out')
      .in('telefone_normalized', identity.variants.filter((v) => v.startsWith('+'))).is('merged_into', null)
      .order('created_at', { ascending: true }).limit(2);
    if (error) throw error;
    if ((data ?? []).length > 1) return { inbox_id: inboxId, skipped: 'ambiguous_identity' };
    lead = data?.[0] ?? null;
  }
  if (lead?.do_not_contact || lead?.whatsapp_opt_out) return { inbox_id: inboxId, skipped: 'existing_contact_restriction' };
  const name = String(lead?.nome || reached.nome || msg.sender_name || '').trim();
  if (!name) return { inbox_id: inboxId, skipped: 'missing_name' };

  const buttons = campaign.metadata?.button_replies ?? session.results?.button_replies ?? [];
  const reply = pressed ? matchReply(buttons, pressed) : null;
  let formId = reply?.form_id ?? (reply?.link ? await resolveFormIdForLink(db, reply.link) : null);
  // Typed requests use the form only when every published campaign action has
  // the same destination; otherwise keep a distinct campaign origin.
  if (!formId && !pressed) {
    const ids = [...new Set((Array.isArray(buttons) ? buttons : []).map((b: any) => b.form_id).filter(Boolean))];
    if (ids.length === 1) formId = String(ids[0]);
  }
  let form: any = null;
  if (formId) {
    const { data, error } = await db.from('smartops_forms').select('id,name,form_purpose,product_catalog_id,capture_buttons').eq('id', formId).maybeSingle();
    if (error) throw error;
    if (data?.form_purpose === 'sdr_captacao') form = data;
  }
  const origin = form?.name ?? `[WHATSAPP OFICIAL] - ${campaign.nome}`;
  const submissionId = campaignSubmissionId(campaign.id, identity.phone);
  let categories = Array.isArray(form?.capture_buttons) ? form.capture_buttons : [];
  if (!categories.length) {
    // Common system categories: the same maintained choices used by site capture,
    // not a new question/options dictionary specific to WhatsApp.
    const { data: standard, error } = await db.from('smartops_forms').select('capture_buttons')
      .eq('name', '# - [CHATSITE] - Oportunidade').eq('active', true).maybeSingle();
    if (error) throw error;
    categories = Array.isArray(standard?.capture_buttons) ? standard.capture_buttons : [];
  }
  categories = categories.filter((c: any) => typeof c?.label === 'string' && c.label.trim());
  if (!categories.length) throw new Error('system interest categories unavailable');
  if (dryRun) return { inbox_id: inboxId, eligible: true, action: 'offer_categories', intent, lead_id: lead?.id ?? null, campaign_id: campaign.id, origin, submission_id: submissionId, categories: categories.map((c: any) => c.label) };

  if (!form) {
    const slug = `whatsapp-oficial-${campaign.id}`;
    const { error } = await db.from('smartops_forms').upsert({ slug, name: origin, title: origin, form_purpose: 'sdr_captacao', active: false }, { onConflict: 'slug', ignoreDuplicates: true });
    if (error) throw error;
    const { data, error: readError } = await db.from('smartops_forms').select('id,name,form_purpose,product_catalog_id,capture_buttons').eq('slug', slug).single();
    if (readError) throw readError;
    form = data;
  }
  const { data: claimed, error: claimError } = await db.rpc('fn_claim_wa_campaign_lead', {
    p_campaign_id: campaign.id, p_phone: identity.phone, p_inbox_id: inboxId, p_form_id: form.id,
  });
  if (claimError) throw claimError;
  const job = claimed?.[0];
  if (!job) return { inbox_id: inboxId, skipped: 'already_registered_or_processing', campaign_id: campaign.id };
  const conversationId = String(msg.raw_payload?.conversation?.id ?? msg.raw_payload?.message?.conversationId ?? '');
  const context = { nome: name, email: lead?.email || reached.email || null, lead_id: lead?.id ?? null, form_name: form.name,
    campaign_name: campaign.nome, original_text: String(msg.message_text || pressed || ''), received_at: msg.created_at,
    conversation_start_at: reached.sent_at, intent, submission_id: submissionId };
  const { error: contextError } = await db.from('wa_campaign_lead_jobs').update({ account_id: accountId, conversation_id: conversationId, categories, context })
    .eq('id', job.id).eq('claim_token', job.claim_token);
  if (contextError) throw contextError;
  return await offerCategories(db, { ...job, account_id: accountId, conversation_id: conversationId, categories, context }, msg, sendMenu);
}

async function offerCategories(db: any, job: any, msg: any, sendMenu: (conversationId: string, accountId: string, interactive: unknown) => Promise<string | null>, page = 0) {
  const variants = campaignPhone(job.phone)?.variants ?? [job.phone];
  const { data: last, error: lastError } = await db.from('whatsapp_inbox').select('created_at').eq('direction', 'inbound')
    .eq('instance_name', `zernio:${job.account_id}`).in('phone', variants).order('created_at', { ascending: false }).limit(1);
  if (lastError) throw lastError;
  const lastAt = last?.[0]?.created_at ?? msg.created_at;
  const update = async (patch: any) => {
    const { error } = await db.from('wa_campaign_lead_jobs').update(patch).eq('id', job.id);
    if (error) throw error;
  };
  if (!serviceWindowOpen(lastAt)) {
    await update({ status: 'waiting_window' });
    return { inbox_id: msg.id, waiting_window: true, job_id: job.id };
  }
  const conversationId = String(msg.raw_payload?.conversation?.id ?? msg.raw_payload?.message?.conversationId ?? job.conversation_id ?? '');
  if (!conversationId) { await update({ status: 'failed', last_error: 'missing conversation' }); throw new Error('missing conversation'); }
  // Serialize a re-open/page send too, not just first creation.
  if (job.status !== 'menu_sending') {
    const { data: claimed, error } = await db.from('wa_campaign_lead_jobs').update({ status: 'menu_sending' }).eq('id', job.id).eq('status', job.status).select('id');
    if (error) throw error;
    if (!claimed?.length) return { skipped: 'menu_already_sending' };
  }
  try {
    const sentAt = new Date().toISOString();
    const messageId = await sendMenu(conversationId, job.account_id, categoryMenu(job.id, job.categories, page));
    await update({ status: 'awaiting_category', conversation_id: conversationId, menu_sent_at: job.menu_sent_at ?? sentAt, menu_message_id: messageId, last_error: null });
    return { inbox_id: msg.id, awaiting_category: true, job_id: job.id };
  } catch (error) {
    await update({ status: 'failed', last_error: String(error).slice(0, 1000) });
    throw error;
  }
}

async function finalizeChoice(db: any, job: any, msg: any, ingest: (payload: Record<string, unknown>) => Promise<any>) {
  const ctx = job.context;
  const selected = job.selected_category;
  if (!selected || !ctx?.nome) throw new Error('category or saved identity missing');
  const finish = async (patch: any) => {
    const { error } = await db.from('wa_campaign_lead_jobs').update(patch).eq('id', job.id).eq('claim_token', job.claim_token);
    if (error) throw error;
  };
  try {
    if (ctx.lead_id) {
      const { data: restrictions, error } = await db.from('lia_attendances').select('do_not_contact,whatsapp_opt_out')
        .eq('id', ctx.lead_id).is('merged_into', null).maybeSingle();
      if (error) throw error;
      if (restrictions?.do_not_contact || restrictions?.whatsapp_opt_out) { await finish({ status: 'blocked' }); return { skipped: 'existing_contact_restriction' }; }
    }
    const product = selected.product_name || selected.label;
    // Keep every explicit customer request before the category choice, not
    // merely the first button click (including the authorized historical replies).
    const variants = campaignPhone(job.phone)?.variants ?? [job.phone];
    const { data: messages, error: transcriptError } = await db.from('whatsapp_inbox').select('message_text,raw_payload,created_at')
      .eq('direction', 'inbound').eq('instance_name', `zernio:${job.account_id}`).in('phone', variants)
      .gte('created_at', ctx.conversation_start_at ?? ctx.received_at).lte('created_at', msg.created_at)
      .order('created_at', { ascending: true }).limit(200);
    if (transcriptError) throw transcriptError;
    const transcript = (messages ?? []).filter((m: any) => campaignIntent(m.message_text, m.raw_payload?.metadata?.buttonPayload) !== 'none')
      .map((m: any) => String(m.message_text || m.raw_payload?.metadata?.buttonPayload || '')).join('\n\n') || ctx.original_text;
    const responses = [
      { label: 'Nome', value: ctx.nome }, { label: 'Telefone', value: job.phone },
      { label: 'Produto de interesse', value: product },
      { label: 'Mensagem recebida (WhatsApp Oficial)', value: transcript },
      { label: 'Campanha', value: ctx.campaign_name },
    ];
    if (ctx.email) responses.push({ label: 'E-mail', value: ctx.email });
    const result = await ingest({
      source: 'form', form_name: ctx.form_name, form_id: job.form_id, form_purpose: 'sdr_captacao',
      nome: ctx.nome, phone: job.phone, telefone_raw: job.phone, ...(ctx.email ? { email: ctx.email } : {}),
      produto_interesse: product, ...(selected.product_catalog_id ? { product_catalog_id: selected.product_catalog_id } : {}),
      submission_id: ctx.submission_id, form_responses: responses,
      utm_source: 'whatsapp_oficial', utm_medium: 'categoria_selecionada', utm_campaign: ctx.campaign_name,
      raw_payload: { whatsapp_campaign_response: { inbox_id: job.inbox_id, selection_inbox_id: msg.id, campaign_id: job.campaign_id,
        mensagem: transcript, category: selected, received_at: ctx.received_at, selected_at: msg.created_at } },
    });
    if (!result?.lead_id) throw new Error('ingestion did not return a lead');
    const { data: previous, error: previousError } = await db.from('lead_activity_log').select('id')
      .eq('event_type', 'whatsapp_campaign_lead').eq('entity_id', ctx.submission_id).limit(1).maybeSingle();
    if (previousError) throw previousError;
    if (!previous) {
      const { error } = await db.from('lead_activity_log').insert({
        lead_id: result.lead_id, event_type: 'whatsapp_campaign_lead', entity_id: ctx.submission_id,
        entity_name: 'Solicitou atendimento — WhatsApp Oficial', event_timestamp: msg.created_at, source_channel: 'whatsapp',
        event_data: { label: 'Solicitou atendimento — WhatsApp Oficial', mensagem: transcript, produto_interesse: product,
          campaign_id: job.campaign_id, campanha: ctx.campaign_name, form_name: ctx.form_name, inbox_id: job.inbox_id,
          selection_inbox_id: msg.id, received_at: ctx.received_at, submission_id: ctx.submission_id },
      });
      if (error) throw error;
    }
    const { error: linkError } = await db.from('whatsapp_inbox').update({ lead_id: result.lead_id }).in('id', [job.inbox_id, msg.id]);
    if (linkError) throw linkError;
    await finish({ status: 'ingested', lead_id: result.lead_id, note_status: 'pending' });
    return { inbox_id: msg.id, ingested: true, lead_id: result.lead_id, job_id: job.id, campaign_id: job.campaign_id, origin: ctx.form_name };
  } catch (error) { await finish({ status: 'failed', last_error: String(error).slice(0, 1000) }); throw error; }
}

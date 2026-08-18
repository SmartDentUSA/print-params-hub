// push-campaign-send — cria/dispara campanhas de Web Push (imediato ou agendado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PUBLIC_BASE = (Deno.env.get("NPS_PUBLIC_BASE_URL") ?? "https://parametros.smartdent.com.br").replace(/\/+$/, "");
const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

function firstName(n?: string | null) {
  const s = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function render(tpl: string, lead: { nome?: string | null; cidade?: string | null; produto_interesse?: string | null }) {
  return (tpl || "")
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName(lead.nome) || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, (lead.nome ?? "").trim())
    .replace(/\{\{\s*cidade\s*\}\}/gi, (lead.cidade ?? "").trim())
    .replace(/\{\{\s*produto_interesse\s*\}\}/gi, (lead.produto_interesse ?? "").trim())
    .replace(/\s{2,}/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    const priv = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:marketing@smartdent.com.br";
    if (!pub || !priv) return json({ ok: false, error: "Chaves VAPID não configuradas." }, 500);
    webpush.setVapidDetails(subject, pub, priv);

    const body = await req.json().catch(() => ({}));

    // 1) Carrega ou cria a campanha
    let campaign: any = null;
    if (body?.campaign_id) {
      const { data } = await admin.from("push_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
      if (!data) return json({ ok: false, error: "Campanha não encontrada." }, 404);
      campaign = data;
    } else {
      const title = String(body?.title || "").trim();
      const text = String(body?.body || "").trim();
      if (!title || !text) return json({ ok: false, error: "Título e mensagem são obrigatórios." }, 400);
      const filters = (body?.filters && typeof body.filters === "object") ? body.filters : {};
      const scheduleAt = body?.schedule_at ? new Date(body.schedule_at).toISOString() : null;
      const audience = await admin.rpc("fn_count_push_audience", { p_filters: filters });
      const { data, error } = await admin.from("push_campaigns").insert({
        title,
        body: text,
        icon_url: body?.icon_url ?? null,
        image_url: body?.image_url ?? null,
        target_url: body?.target_url ?? null,
        filters,
        schedule_at: scheduleAt,
        status: scheduleAt && new Date(scheduleAt).getTime() > Date.now() ? "agendada" : "enviando",
        total_audience: (audience.data as number) ?? 0,
      }).select("*").maybeSingle();
      if (error) throw error;
      campaign = data;
      if (campaign.status === "agendada") {
        return json({ ok: true, campaign_id: campaign.id, status: "agendada", audience: campaign.total_audience });
      }
    }

    if (campaign.status === "enviada") {
      return json({ ok: true, campaign_id: campaign.id, status: "enviada", already: true });
    }

    await admin.from("push_campaigns").update({ status: "enviando", updated_at: new Date().toISOString() }).eq("id", campaign.id);

    // 2) Público
    const { data: audience, error: eAud } = await admin.rpc("fn_push_audience", { p_filters: campaign.filters ?? {} });
    if (eAud) throw eAud;
    const recipients = (audience ?? []) as Array<{
      subscription_id: string; lead_id: string; endpoint: string; p256dh: string; auth: string;
      nome: string | null; cidade: string | null; produto_interesse: string | null;
    }>;

    let sent = 0;
    let failed = 0;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < recipients.length; i += 25) {
      const batch = recipients.slice(i, i + 25);
      await Promise.all(batch.map(async (r) => {
        const clickUrl = campaign.target_url
          ? `${FN_BASE}/push-click?c=${campaign.id}&l=${r.lead_id}&u=${encodeURIComponent(campaign.target_url)}`
          : `${PUBLIC_BASE}/`;
        const payload = JSON.stringify({
          title: render(campaign.title, r),
          body: render(campaign.body, r),
          icon: campaign.icon_url || `${PUBLIC_BASE}/favicon-192x192.png`,
          image: campaign.image_url || undefined,
          url: clickUrl,
          tag: `push-${campaign.id}`,
        });
        try {
          await webpush.sendNotification(
            { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
            payload,
          );
          sent++;
          await admin.from("push_send_log").insert({
            campaign_id: campaign.id, subscription_id: r.subscription_id, lead_id: r.lead_id,
            status: "enviado", sent_at: nowIso, dedupe_hash: `${campaign.id}:${r.subscription_id}`,
          });
          await admin.from("lead_activity_log").insert({
            lead_id: r.lead_id,
            event_type: "push_sent",
            event_timestamp: nowIso,
            source_channel: "push_app",
            entity_type: "push_campaign",
            entity_id: campaign.id,
            entity_name: campaign.title,
            event_data: {
              label: `Push enviado: ${render(campaign.title, r)}`,
              message: render(campaign.body, r),
              url: campaign.target_url ?? null,
            },
            dedupe_hash: `push_sent:${campaign.id}:${r.subscription_id}`,
          }).then(() => undefined, () => undefined);
        } catch (err) {
          failed++;
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").update({ enabled: false }).eq("id", r.subscription_id);
          }
          await admin.from("push_send_log").insert({
            campaign_id: campaign.id, subscription_id: r.subscription_id, lead_id: r.lead_id,
            status: "erro", error: String((err as Error)?.message ?? err).slice(0, 400), sent_at: nowIso,
            dedupe_hash: `${campaign.id}:${r.subscription_id}`,
          });
        }
      }));
    }

    await admin.from("push_campaigns").update({
      status: "enviada",
      total_audience: recipients.length,
      sent_count: sent,
      failed_count: failed,
      updated_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    return json({ ok: true, campaign_id: campaign.id, audience: recipients.length, sent, failed });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});

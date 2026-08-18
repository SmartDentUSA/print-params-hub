// push-click — registra o clique no push e redireciona para a URL final.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c");
  const leadId = url.searchParams.get("l");
  const target = url.searchParams.get("u") || "https://parametros.smartdent.com.br/";

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  if (campaignId) {
    try {
      const nowIso = new Date().toISOString();
      const q = admin.from("push_send_log").update({ clicked_at: nowIso }).eq("campaign_id", campaignId);
      await (leadId ? q.eq("lead_id", leadId) : q);

      const { count } = await admin
        .from("push_send_log")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .not("clicked_at", "is", null);
      await admin.from("push_campaigns").update({ clicked_count: count ?? 0 }).eq("id", campaignId);

      if (leadId) {
        await admin.from("lead_activity_log").insert({
          lead_id: leadId,
          event_type: "push_clicked",
          event_timestamp: nowIso,
          source_channel: "push_app",
          entity_type: "push_campaign",
          entity_id: campaignId,
          event_data: { label: "Cliente abriu a notificação push", url: target },
          dedupe_hash: `push_clicked:${campaignId}:${leadId}`,
        });
      }
    } catch { /* noop */ }
  }

  return Response.redirect(target, 302);
});

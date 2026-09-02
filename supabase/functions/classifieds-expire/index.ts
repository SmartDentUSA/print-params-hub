// classifieds-expire (cron diário) — avisa 3 dias antes e expira no prazo.
import {
  corsHeaders, json, notifyWhatsApp, publicUrl, serviceClient,
} from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = serviceClient();
  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 86_400_000).toISOString();

  // 1) avisos (3 dias antes)
  const { data: soon } = await db
    .from("classified_listings")
    .select("id, slug, title, contact_whatsapp, lead_id, expires_at")
    .eq("status", "active")
    .eq("type", "equipment")
    .gt("expires_at", now.toISOString())
    .lte("expires_at", in3days);

  let warned = 0;
  for (const l of soon ?? []) {
    const sent = await notifyWhatsApp(
      db, l.contact_whatsapp,
      `⏳ Seu anúncio *${l.title}* expira em 3 dias.\nRenove em um toque em "Meus anúncios":\n${publicUrl(null, "meus-anuncios")}`,
      l.lead_id,
    );
    if (sent) warned++;
  }

  // 2) expiração
  const { data: expired } = await db
    .from("classified_listings")
    .update({ status: "expired" })
    .eq("status", "active")
    .eq("type", "equipment")
    .lte("expires_at", now.toISOString())
    .select("id");

  return json({ ok: true, warned, expired: expired?.length ?? 0 });
});

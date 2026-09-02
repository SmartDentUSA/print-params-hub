// classifieds-alerts (cron) — casa anúncios novos com buscas salvas e avisa por WhatsApp.
import {
  corsHeaders, json, notifyWhatsApp, priceLabel, publicUrl, serviceClient,
} from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = serviceClient();

  const { data: searches } = await db
    .from("classified_saved_searches")
    .select("id, user_id, lead_id, filtros, notify_whatsapp, last_notified_at")
    .eq("notify_whatsapp", true);

  if (!searches?.length) return json({ ok: true, matched: 0, notified: 0 });

  let notified = 0;
  let matchedTotal = 0;

  for (const s of searches) {
    const f = (s.filtros ?? {}) as Record<string, unknown>;
    const since = s.last_notified_at ?? new Date(Date.now() - 7 * 86_400_000).toISOString();

    let q = db
      .from("classified_listings")
      .select("id, slug, title, price, location_city, location_state, contact_whatsapp")
      .eq("status", "active")
      .eq("type", "equipment")
      .gt("published_at", since)
      .order("published_at", { ascending: false })
      .limit(5);

    if (f.category) q = q.eq("category", String(f.category));
    if (f.condition) q = q.eq("condition", String(f.condition));
    if (f.uf) q = q.eq("location_state", String(f.uf));
    if (f.price_max != null) q = q.lte("price", Number(f.price_max));

    const { data: matches } = await q;
    if (!matches?.length) continue;
    matchedTotal += matches.length;

    // Telefone do interessado vem do CDP (lead), nunca do anúncio.
    let phone: string | null = null;
    if (s.lead_id) {
      const { data: lead } = await db
        .from("lia_attendances")
        .select("telefone_normalized, telefone_raw")
        .eq("id", s.lead_id)
        .maybeSingle();
      phone = lead?.telefone_normalized || lead?.telefone_raw || null;
    }
    if (!phone) continue;

    const lines = matches.map((m) =>
      `• ${m.title} — ${priceLabel(m.price)}${m.location_state ? ` (${m.location_state})` : ""}\n  ${publicUrl(m.slug, m.id)}`
    ).join("\n");

    const sent = await notifyWhatsApp(
      db, phone,
      `🔔 Novidades no Canal de Equipamentos Usados da Smart Dent:\n\n${lines}`,
      s.lead_id,
    );
    if (sent) {
      notified++;
      await db.from("classified_saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", s.id);
    }
  }

  return json({ ok: true, searches: searches.length, matched: matchedTotal, notified });
});

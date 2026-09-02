// classifieds-dispatch-wa — publica o anúncio nos grupos de WhatsApp REUTILIZANDO
// wa-group-blast (nenhum segundo mecanismo de envio é criado aqui).
import {
  corsHeaders, json, listingBlastText, serviceClient,
} from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const listingId = String(body.listing_id ?? "");
  if (!listingId) return json({ error: "listing_id obrigatório" }, 400);

  const db = serviceClient();
  const { data: listing } = await db
    .from("classified_listings")
    .select("id, slug, title, description, price, location_city, location_state, images, status, wa_dispatched_at")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) return json({ error: "Anúncio não encontrado" }, 404);
  if (listing.status !== "active") return json({ ok: false, skipped: "anúncio não está ativo" });
  if (listing.wa_dispatched_at && !body.force) return json({ ok: false, skipped: "já disparado" });

  const { data: groups } = await db
    .from("wa_groups")
    .select("group_jid")
    .eq("enabled", true)
    .eq("ativo", true)
    .eq("is_admin", true);

  const jids = (groups ?? []).map((g) => g.group_jid).filter(Boolean);
  if (jids.length === 0) return json({ ok: false, skipped: "nenhum grupo elegível" });

  const text = listingBlastText(listing as Record<string, unknown>);
  const firstImage = Array.isArray(listing.images) ? String(listing.images[0] ?? "") : "";

  const payload = firstImage
    ? { message_type: "image", content: { url: firstImage, caption: text } }
    : { message_type: "msg", content: { text } };

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-group-blast`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      group_jids: jids,
      campaign_name: `Usados — ${listing.title}`.slice(0, 90),
      dedupe_window_days: 7,
      ...payload,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.warn("[classifieds-dispatch-wa] wa-group-blast falhou:", res.status, raw.slice(0, 300));
    return json({ ok: false, error: "falha no disparo", detail: raw.slice(0, 300) }, 502);
  }

  await db.from("classified_listings").update({
    wa_dispatched_at: new Date().toISOString(),
    wa_groups_reached: jids.length,
  }).eq("id", listingId);

  return json({ ok: true, groups: jids.length });
});

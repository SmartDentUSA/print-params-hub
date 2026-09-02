// classifieds-contact — revela o WhatsApp do anunciante (fora da view pública)
// e contabiliza o clique. Público, mas só para anúncios ativos.
import { corsHeaders, json, serviceClient } from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const listingId = String(body.listing_id ?? "");
  if (!listingId) return json({ error: "listing_id obrigatório" }, 400);

  const db = serviceClient();
  const { data } = await db
    .from("classified_listings")
    .select("id, title, contact_whatsapp, status")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return json({ error: "Anúncio não disponível" }, 404);

  await db.rpc("increment_wa_click", { p_listing: listingId });

  return json({ ok: true, whatsapp: data.contact_whatsapp, title: data.title });
});

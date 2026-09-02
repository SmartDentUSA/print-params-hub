// classifieds-moderate — aprovar/reprovar anúncio, marcar revisão de auto-aprovados,
// revogar auto-aprovação e resolver denúncias. Somente admin.
import {
  corsHeaders, expiresAtFromNow, getAuthUser, isAdmin, json, notifyWhatsApp,
  publicUrl, scheduleGroupBlast, serviceClient,
} from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getAuthUser(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  const db = serviceClient();
  if (!(await isAdmin(db, user.id))) return json({ error: "Acesso restrito" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const action = String(body.action ?? "");
  const listingId = String(body.listing_id ?? "");
  if (!listingId) return json({ error: "listing_id obrigatório" }, 400);

  const { data: listing } = await db
    .from("classified_listings")
    .select("id, slug, title, status, contact_whatsapp, lead_id, user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return json({ error: "Anúncio não encontrado" }, 404);

  const now = new Date().toISOString();

  if (action === "approve") {
    const { error } = await db.from("classified_listings").update({
      status: "active",
      published_at: now,
      expires_at: expiresAtFromNow(),
      moderation_reason: null,
      moderated_by: user.id,
      moderated_at: now,
      reviewed_at: now,
      reviewed_by: user.id,
    }).eq("id", listingId);
    if (error) return json({ error: error.message }, 400);

    await scheduleGroupBlast(db, listingId);
    await notifyWhatsApp(
      db, listing.contact_whatsapp,
      `✅ Seu anúncio *${listing.title}* foi aprovado e já está no ar:\n${publicUrl(listing.slug, listing.id)}`,
      listing.lead_id,
    );
    return json({ ok: true, status: "active" });
  }

  if (action === "reject") {
    const reason = String(body.reason ?? "").trim();
    if (!reason) return json({ error: "Motivo obrigatório" }, 400);
    const { error } = await db.from("classified_listings").update({
      status: "removed",
      moderation_reason: reason,
      moderated_by: user.id,
      moderated_at: now,
      reviewed_at: now,
      reviewed_by: user.id,
    }).eq("id", listingId);
    if (error) return json({ error: error.message }, 400);

    await notifyWhatsApp(
      db, listing.contact_whatsapp,
      `⚠️ Seu anúncio *${listing.title}* não foi aprovado.\nMotivo: ${reason}\n\nVocê pode corrigir e reenviar aqui:\n${publicUrl(null, "meus-anuncios")}`,
      listing.lead_id,
    );
    return json({ ok: true, status: "removed" });
  }

  if (action === "mark_reviewed") {
    const { error } = await db.from("classified_listings").update({
      reviewed_at: now, reviewed_by: user.id,
    }).eq("id", listingId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "revoke_auto_approval") {
    const { error } = await db.from("classified_listings").update({
      auto_approval_revoked: true,
      moderation_reason: String(body.reason ?? "Auto-aprovação revogada"),
      moderated_by: user.id,
      moderated_at: now,
    }).eq("id", listingId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "block_seller") {
    // Bloqueia o anunciante: revoga auto-aprovação e remove os anúncios abertos.
    const { error } = await db.from("classified_listings").update({
      status: "removed",
      auto_approval_revoked: true,
      moderation_reason: String(body.reason ?? "Anunciante bloqueado"),
      moderated_by: user.id,
      moderated_at: now,
    }).eq("user_id", listing.user_id).in("status", ["active", "pending"]);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "resolve_reports") {
    const { error } = await db.from("classified_reports").update({
      resolved_at: now, resolved_by: user.id,
    }).eq("listing_id", listingId).is("resolved_at", null);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "action inválida" }, 400);
});

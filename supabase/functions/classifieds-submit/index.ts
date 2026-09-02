// classifieds-submit — cria/edita anúncio de equipamento usado.
// Decide 'active' (cliente, auto-aprovado) vs 'pending' resolvendo o lead pelo
// USUÁRIO AUTENTICADO. Nunca pelo telefone digitado no formulário.
import {
  CATEGORIES, CLASSIFIEDS_TYPE, CONDITIONS, MAX_ACTIVE_FREE, MAX_IMAGES,
  buildUniqueSlug, corsHeaders, expiresAtFromNow, getAuthUser, isCliente, json,
  resolveLeadForUser, scheduleGroupBlast, serviceClient,
} from "../_shared/classifieds.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getAuthUser(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const title = String(body.title ?? "").trim();
  const condition = String(body.condition ?? "").trim();
  const category = String(body.category ?? "").trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const errors: string[] = [];

  if (title.length < 5) errors.push("Título obrigatório (mín. 5 caracteres)");
  if (!CONDITIONS.includes(condition as typeof CONDITIONS[number])) errors.push("Estado de conservação obrigatório");
  if (!CATEGORIES.includes(category as typeof CATEGORIES[number])) errors.push("Categoria inválida");
  if (Array.isArray(body.images) && body.images.length > MAX_IMAGES) errors.push(`Máximo de ${MAX_IMAGES} fotos`);
  if (body.price != null && (isNaN(Number(body.price)) || Number(body.price) < 0)) errors.push("Preço inválido");
  if (errors.length) return json({ error: errors.join("; ") }, 400);

  const db = serviceClient();
  const listingId = typeof body.id === "string" ? body.id : null;

  const fields = {
    type: CLASSIFIEDS_TYPE,
    title,
    description: String(body.description ?? "").slice(0, 4000) || null,
    price: body.price != null ? Number(body.price) : null,
    condition,
    category,
    location_city: String(body.location_city ?? "").slice(0, 120) || null,
    location_state: String(body.location_state ?? "").slice(0, 2).toUpperCase() || null,
    country_code: "BR",
    images,
    contact_whatsapp: String(body.contact_whatsapp ?? "").replace(/\D/g, "") || null,
  };

  // ---------- edição ----------
  if (listingId) {
    const { data: existing } = await db
      .from("classified_listings")
      .select("id, user_id, status")
      .eq("id", listingId)
      .maybeSingle();
    if (!existing || existing.user_id !== user.id) return json({ error: "Anúncio não encontrado" }, 404);

    const { error } = await db.from("classified_listings").update(fields).eq("id", listingId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, id: listingId, status: existing.status });
  }

  // ---------- criação ----------
  const leadId = await resolveLeadForUser(db, user, {
    nome: String(body.seller_name ?? "") || undefined,
    telefone: fields.contact_whatsapp ?? undefined,
  });

  const { count: activeCount } = await db
    .from("classified_listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["active", "pending"]);

  if ((activeCount ?? 0) >= MAX_ACTIVE_FREE) {
    return json({ error: `Limite de ${MAX_ACTIVE_FREE} anúncios ativos no plano gratuito` }, 400);
  }

  // Cliente => publica na hora. Sem lead => trata como não-cliente (falha fechada).
  const cliente = await isCliente(db, leadId);
  let revoked = false;
  if (leadId) {
    const { data: prior } = await db
      .from("classified_listings")
      .select("auto_approval_revoked")
      .eq("user_id", user.id)
      .eq("auto_approval_revoked", true)
      .limit(1)
      .maybeSingle();
    revoked = !!prior;
  }
  const autoApprove = cliente && !revoked;

  const slug = await buildUniqueSlug(db, title);
  const now = new Date().toISOString();

  const { data: created, error } = await db
    .from("classified_listings")
    .insert({
      ...fields,
      slug,
      user_id: user.id,
      lead_id: leadId,
      plan: "free",
      status: autoApprove ? "active" : "pending",
      auto_approved: autoApprove,
      published_at: autoApprove ? now : null,
      expires_at: autoApprove ? expiresAtFromNow() : null,
    })
    .select("id, slug, status, auto_approved")
    .maybeSingle();

  if (error) return json({ error: error.message }, 400);

  if (autoApprove && created) await scheduleGroupBlast(db, created.id);

  return json({
    ok: true,
    id: created?.id,
    slug: created?.slug,
    status: created?.status,
    is_cliente: cliente,
    auto_approved: !!created?.auto_approved,
    message: autoApprove
      ? "Seu anúncio já está no ar."
      : "Recebemos seu anúncio. Nossa equipe revisa em até 1 dia útil.",
  });
});

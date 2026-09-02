// _shared/classifieds.ts — helpers do Canal de Equipamentos Usados.
// Regras de negócio de servidor: slug, resolução de lead pelo usuário autenticado,
// decisão de auto-aprovação (via fn_is_cliente) e notificações reaproveitando a
// infraestrutura de WhatsApp já existente (smart-ops-wa-send / wa-group-blast).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CLASSIFIEDS_TYPE = "equipment";
export const EXPIRY_DAYS = 60;
export const MAX_IMAGES = 10;
export const MAX_ACTIVE_FREE = 5;

export const CATEGORIES = [
  "scanner",
  "impressora_3d",
  "fresadora",
  "pos_cura",
  "cuba",
  "compressor",
] as const;

export const CONDITIONS = ["new", "excellent", "good", "fair", "na"] as const;

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function slugify(input: string): string {
  return (input || "anuncio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "anuncio";
}

export async function buildUniqueSlug(db: SupabaseClient, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 6; i++) {
    const suffix = i === 0 ? "" : "-" + Math.random().toString(36).slice(2, 7);
    const candidate = `${base}${suffix}`;
    const { data } = await db
      .from("classified_listings")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Usuário autenticado a partir do header Authorization. NUNCA confiar em id vindo do body. */
export async function getAuthUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function isAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.rpc("is_admin", { _user_id: userId }).select?.() ?? { data: null };
  if (typeof data === "boolean") return data;
  const { data: roles } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!roles;
}

/**
 * Resolve o lead do CDP a partir do USUÁRIO AUTENTICADO (nunca do telefone digitado).
 * Cria o lead pelo caminho já existente (insert canônico em lia_attendances) se não houver.
 */
export async function resolveLeadForUser(
  db: SupabaseClient,
  user: { id: string; email: string | null },
  fallback: { nome?: string; telefone?: string },
): Promise<string | null> {
  const email = (user.email || "").trim().toLowerCase();

  if (email) {
    const { data } = await db.rpc("find_lead_id_by_email_ci", { p_email: email });
    const leadId = Array.isArray(data) ? data[0]?.lead_id ?? data[0] : data;
    if (leadId && typeof leadId === "string") return leadId;
  }

  if (email) {
    const { data } = await db
      .from("lia_attendances")
      .select("id")
      .ilike("email", email)
      .is("merged_into", null)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (!email && !fallback.telefone) return null;

  const { data: created, error } = await db
    .from("lia_attendances")
    .insert({
      nome: fallback.nome || email || "Anunciante Equipamento Usado",
      email: email || null,
      telefone: fallback.telefone || null,
      origem_primeiro_contato: "Canal de Equipamentos Usados",
      source: "classifieds",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[classifieds] falha ao criar lead:", error.message);
    return null;
  }
  return created?.id ?? null;
}

/** Regra ÚNICA de cliente — sempre via fn_is_cliente. Sem lead => falha fechada. */
export async function isCliente(db: SupabaseClient, leadId: string | null): Promise<boolean> {
  if (!leadId) return false;
  const { data, error } = await db.rpc("fn_is_cliente", { p_lead: leadId });
  if (error) {
    console.warn("[classifieds] fn_is_cliente falhou:", error.message);
    return false;
  }
  return data === true;
}

export function expiresAtFromNow(days = EXPIRY_DAYS): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function defaultTeamMemberId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("team_members")
    .select("id")
    .eq("active", true)
    .not("evolution_instance_name", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Notificação 1:1 — reutiliza smart-ops-wa-send (não cria segundo mecanismo). */
export async function notifyWhatsApp(
  db: SupabaseClient,
  phone: string | null,
  message: string,
  leadId: string | null,
): Promise<boolean> {
  if (!phone) return false;
  const teamMemberId = await defaultTeamMemberId(db);
  if (!teamMemberId) {
    console.warn("[classifieds] nenhum team_member ativo com instância Evolution");
    return false;
  }
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-wa-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_member_id: teamMemberId,
        phone,
        tipo: "text",
        message,
        lead_id: leadId,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[classifieds] notifyWhatsApp erro:", e);
    return false;
  }
}

export function publicUrl(slug: string | null, id: string): string {
  const base = Deno.env.get("PUBLIC_SITE_URL") || "https://admin.smartdent.com.br";
  return `${base}/usados/${slug || id}`;
}

export function priceLabel(price: number | null): string {
  if (price == null) return "Valor a combinar";
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function listingBlastText(l: Record<string, unknown>): string {
  const city = [l.location_city, l.location_state].filter(Boolean).join(" - ");
  return [
    `🔧 *${l.title}*`,
    `💰 ${priceLabel(l.price as number | null)}`,
    city ? `📍 ${city}` : null,
    "",
    String(l.description || "").slice(0, 320),
    "",
    `Ver anúncio e falar com o anunciante:`,
    publicUrl(l.slug as string | null, l.id as string),
  ].filter((v) => v !== null).join("\n");
}

/** Agenda o disparo em grupos reaproveitando wa-group-blast. */
export async function scheduleGroupBlast(db: SupabaseClient, listingId: string): Promise<void> {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/classifieds-dispatch-wa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listing_id: listingId }),
    });
  } catch (e) {
    console.warn("[classifieds] scheduleGroupBlast erro:", e);
  }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

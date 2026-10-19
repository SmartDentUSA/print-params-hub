// Criação idempotente do formulário de indicação do KOL.
// Clona a estrutura do formulário modelo "# - INDICAÇÃO - Erick Souza"
// (campos, opções, botões de produto, condições) e vincula à ficha do profissional.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const TEMPLATE_FORM_ID = "98918740-4e99-45f9-bf6d-89cfe90a8c14"; // # - INDICAÇÃO - Erick Souza

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ReferralFormResult {
  form_id: string;
  form_name: string;
  slug: string;
  created: boolean;
  seller_team_member_id: string | null;
}

/**
 * Garante que o profissional tenha um formulário de indicação próprio.
 * - Se já existir um formulário "# - INDICAÇÃO - ..." vinculado na ficha, retorna o existente.
 * - Senão, clona o modelo, nomeia "# - INDICAÇÃO - {nome}" e grava o vendedor responsável
 *   (seller do contrato; fallback: especialista fixado na ficha).
 */
export async function ensureReferralForm(
  admin: SupabaseClient,
  leadId: string,
): Promise<ReferralFormResult | null> {
  const { data: lead } = await admin
    .from("lia_attendances")
    .select("id, nome, prof_kol_form_ids, prof_specialist_team_member_id")
    .eq("id", leadId)
    .is("merged_into", null)
    .maybeSingle();
  if (!lead) return null;

  const profName = String(lead.nome ?? "").trim();
  if (!profName) return null;

  const linkedIds = Array.isArray(lead.prof_kol_form_ids)
    ? (lead.prof_kol_form_ids as unknown[])
        .map((x: any) => (typeof x === "string" ? x : x?.id))
        .filter(Boolean)
    : [];

  // Já tem formulário de indicação vinculado? Não duplica.
  if (linkedIds.length) {
    const { data: existing } = await admin
      .from("smartops_forms")
      .select("id, name, slug, forced_seller_team_member_id")
      .in("id", linkedIds)
      .ilike("name", "# - INDICAÇÃO -%")
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        form_id: existing.id,
        form_name: existing.name,
        slug: existing.slug,
        created: false,
        seller_team_member_id: existing.forced_seller_team_member_id ?? null,
      };
    }
  }

  // Vendedor responsável: contrato mais recente → especialista fixado na ficha
  let sellerId: string | null = null;
  const { data: ct } = await admin
    .from("kol_contracts")
    .select("seller_team_member_id")
    .eq("lead_id", leadId)
    .not("seller_team_member_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  sellerId = ct?.seller_team_member_id ?? (lead as any).prof_specialist_team_member_id ?? null;

  // Clona o formulário modelo
  const { data: tpl } = await admin
    .from("smartops_forms")
    .select("*")
    .eq("id", TEMPLATE_FORM_ID)
    .maybeSingle();
  if (!tpl) {
    console.error("[kol-referral-form] formulário modelo não encontrado", TEMPLATE_FORM_ID);
    return null;
  }

  const formName = `# - INDICAÇÃO - ${profName}`;
  const baseSlug = `indicacao-${slugify(profName)}`;
  let slug = baseSlug;
  const { data: slugClash } = await admin
    .from("smartops_forms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugClash) slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { id: _id, created_at: _c, updated_at: _u, submissions_count: _s, ...rest } = tpl as any;
  const { data: newForm, error: formErr } = await admin
    .from("smartops_forms")
    .insert({
      ...rest,
      name: formName,
      title: (tpl as any).title ? String((tpl as any).title).replace(/Erick Souza/gi, profName) : formName,
      slug,
      active: true,
      forced_seller_team_member_id: sellerId,
      professional_lead_id: leadId,
      submissions_count: 0,
    })
    .select("id, name, slug")
    .single();
  if (formErr || !newForm) {
    console.error("[kol-referral-form] insert form", formErr?.message);
    return null;
  }

  // Clona os campos (perguntas, opções, botões de produto, condições)
  const { data: fields } = await admin
    .from("smartops_form_fields")
    .select("*")
    .eq("form_id", TEMPLATE_FORM_ID)
    .order("order_index");
  if (fields?.length) {
    const rows = fields.map((f: any) => {
      const { id: _fid, created_at: _fc, updated_at: _fu, ...frest } = f;
      return { ...frest, form_id: newForm.id };
    });
    const { error: fErr } = await admin.from("smartops_form_fields").insert(rows);
    if (fErr) console.error("[kol-referral-form] clone fields", fErr.message);
  }

  // Vincula na ficha do profissional
  const nextLinks = [
    ...(Array.isArray(lead.prof_kol_form_ids) ? (lead.prof_kol_form_ids as unknown[]) : []),
    { id: newForm.id, name: formName },
  ];
  const { error: linkErr } = await admin
    .from("lia_attendances")
    .update({ prof_kol_form_ids: nextLinks })
    .eq("id", leadId);
  if (linkErr) console.error("[kol-referral-form] link form", linkErr.message);

  await admin.rpc("fn_kol_log", {
    _lead_id: leadId,
    _event_type: "kol_referral_form_created",
    _entity_type: "smartops_form",
    _entity_id: newForm.id,
    _entity_name: formName,
    _value: null,
    _channel: "kol",
    _data: {
      descricao: `Formulário de indicação criado automaticamente: ${formName}`,
      form_id: newForm.id,
      slug: newForm.slug,
      seller_team_member_id: sellerId,
      actor: "sistema",
      dedupe_key: `kol_referral_form:${newForm.id}`,
    },
  });

  return {
    form_id: newForm.id,
    form_name: formName,
    slug: newForm.slug,
    created: true,
    seller_team_member_id: sellerId,
  };
}

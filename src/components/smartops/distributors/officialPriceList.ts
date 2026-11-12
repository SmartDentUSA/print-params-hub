import { supabase } from "@/integrations/supabase/client";

/** Tabela de preços de um distribuidor (sem tabelas exclusivas de promoção). */
export async function fetchDistributorPriceList(distributorId?: string | null) {
  const query = supabase.from("distributors" as any).select("id,razao_social,nome_fantasia");
  const { data: distributor } = distributorId
    ? await query.eq("id", distributorId).maybeSingle()
    : await query.ilike("nome_fantasia", "%Loja Oficial%").limit(1).maybeSingle();
  if (!distributor) return null;
  const { data: list } = await supabase
    .from("dealer_price_lists" as any)
    .select("*")
    .eq("distributor_id", (distributor as any).id)
    .is("promotional_table_id", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!list) return null;
  const { data: items } = await supabase
    .from("dealer_price_items" as any)
    .select("*")
    .eq("price_list_id", (list as any).id);
  return { distributor: distributor as any, list: list as any, items: ((items as any) || []) as any[] };
}

/** Tabela da Loja Oficial — base das tabelas exclusivas de promoção. */
export const fetchOfficialPriceList = () => fetchDistributorPriceList(null);

/** Tabela exclusiva de uma promoção (uma por tabela promocional). */
export async function fetchPromotionPriceList(promotionalTableId: string) {
  const { data: list } = await supabase
    .from("dealer_price_lists" as any)
    .select("*")
    .eq("promotional_table_id", promotionalTableId)
    .maybeSingle();
  if (!list) return null;
  const { data: items } = await supabase
    .from("dealer_price_items" as any)
    .select("*")
    .eq("price_list_id", (list as any).id);
  return { list: list as any, items: ((items as any) || []) as any[] };
}

type PromotionSource = {
  id: string;
  name: string;
  price_table_mode?: string | null;
  price_table_distributor_id?: string | null;
};

/** Itens que a promoção de origem mostra no PDF (exclusiva/clonada ou distribuição). */
export async function fetchPromotionSourceItems(source: PromotionSource) {
  if (source.price_table_mode === "exclusive" || source.price_table_mode === "clone") {
    return (await fetchPromotionPriceList(source.id))?.items ?? [];
  }
  return (await fetchDistributorPriceList(source.price_table_distributor_id ?? null))?.items ?? [];
}

/**
 * Substitui a tabela própria da promoção pelos itens da promoção de origem.
 * Antes de apagar, guarda a versão atual no histórico para poder restaurar.
 */
export async function clonePromotionPriceTable(
  target: { id: string; name: string; currency: string },
  source: PromotionSource,
  buildRows: (items: any[], priceListId: string) => any[],
) {
  const sourceItems = await fetchPromotionSourceItems(source);
  if (!sourceItems.length) throw new Error(`A promoção “${source.name}” não tem tabela de preços com itens.`);

  let { data: list } = await supabase.from("dealer_price_lists" as any).select("*").eq("promotional_table_id", target.id).maybeSingle();
  if (!list) {
    const { data: created, error } = await supabase.from("dealer_price_lists" as any).insert({
      promotional_table_id: target.id, distributor_id: null, name: `Promoção — ${target.name}`,
      currency: target.currency || "BRL", language: "pt",
    }).select("*").single();
    if (error) throw error;
    list = created;
  }
  const listId = (list as any).id as string;

  const { data: current } = await supabase.from("dealer_price_items" as any).select("*").eq("price_list_id", listId);
  const currentItems = ((current as any) || []) as any[];
  if (currentItems.length) {
    const subtotal = currentItems.reduce((a, b) => a + Number(b.price_base || 0) * Number(b.quantity_multiplier ?? 1), 0);
    const total = currentItems.reduce((a, b) => a + Number(b.price_dealer || 0) * Number(b.quantity_multiplier ?? 1), 0);
    const { error: snapErr } = await supabase.from("dealer_price_list_snapshots" as any).insert({
      distributor_id: null, price_list_id: listId, label: `Antes de clonar de “${source.name}”`,
      currency: (list as any).currency, language: (list as any).language,
      items: currentItems, totals: { subtotal, total, discount: subtotal - total },
    });
    if (snapErr) throw snapErr;
    const { error: delErr } = await supabase.from("dealer_price_items" as any).delete().eq("price_list_id", listId);
    if (delErr) throw delErr;
  }

  const rows = buildRows(sourceItems, listId);
  const { error: insErr } = await supabase.from("dealer_price_items" as any).insert(rows);
  if (insErr) throw insErr;
  return rows.length;
}

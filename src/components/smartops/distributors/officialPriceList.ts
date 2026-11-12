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

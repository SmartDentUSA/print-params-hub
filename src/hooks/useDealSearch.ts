import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DealSearchResult, DealSearchListItem, PiperunDeal } from '@/types/courses';

export function useDealSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<DealSearchResult | null>(null);
  const [results, setResults] = useState<DealSearchListItem[]>([]);

  const hydrateFull = async (lead_id: string, deal_id: string): Promise<DealSearchResult | null> => {
    // Busca os dados completos do lead canônico (telefones formatados, endereço, etc.)
    const { data, error: rpcErr } = await (supabase as any)
      .rpc('fn_search_deal_for_training', { p_deal_id: deal_id });
    if (rpcErr) throw rpcErr;
    if (!data?.found) return null;

    // Fetch cirúrgico do deal escolhido a partir do histórico
    let matched: PiperunDeal | null = null;
    try {
      const { data: dealRow } = await (supabase as any).rpc(
        'fn_get_deal_from_history',
        { p_lead_id: lead_id, p_deal_id: deal_id },
      );
      if (dealRow) matched = dealRow as PiperunDeal;
    } catch (e) {
      console.warn('[DealSearch] fn_get_deal_from_history fallback:', e);
    }

    return { ...(data as DealSearchResult), matched_deal: matched };
  };

  const search = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setResults([]);

    try {
      const { data, error: rpcErr } = await (supabase as any)
        .rpc('fn_search_deals_for_training', { p_query: q });
      if (rpcErr) throw rpcErr;

      const list: DealSearchListItem[] = data?.results ?? [];
      if (!data?.found || list.length === 0) {
        setError('Nenhum deal encontrado. Tente outro ID ou e-mail.');
        return;
      }

      setResults(list);

      // Auto-seleciona se houver apenas 1 resultado
      if (list.length === 1) {
        const r = list[0];
        const hydrated = await hydrateFull(r.lead_id, r.deal_id);
        if (hydrated) setResult(hydrated);
      }
    } catch (err: any) {
      setError(`Erro: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const selectDeal = async (item: DealSearchListItem) => {
    setLoading(true);
    setError(null);
    try {
      const hydrated = await hydrateFull(item.lead_id, item.deal_id);
      if (!hydrated) {
        setError('Falha ao carregar dados do deal.');
        return;
      }
      setResult(hydrated);
    } catch (err: any) {
      setError(`Erro: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    search,
    selectDeal,
    loading,
    error,
    result,
    results,
    clear: () => { setResult(null); setResults([]); setError(null); },
  };
}

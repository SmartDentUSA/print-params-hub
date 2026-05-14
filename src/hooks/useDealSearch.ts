import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DealSearchResult, PiperunDeal } from '@/types/courses';

export function useDealSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<DealSearchResult | null>(null);

  const search = async (dealId: string) => {
    const id = dealId.trim();
    if (!id) return;
    setLoading(true); setError(null); setResult(null);

    try {
      // 1) RPC resolve o lead canônico + payload completo (sem carregar 1000+ deals)
      const { data, error: rpcErr } = await (supabase as any)
        .rpc('fn_search_deal_for_training', { p_deal_id: id });
      if (rpcErr) throw rpcErr;
      if (!data?.found) {
        setError('Deal não encontrado. Verifique o ID e tente novamente.');
        return;
      }
      if (data.warning) console.warn('[DealSearch]', data.warning);

      // 2) Fetch cirúrgico: extrai SÓ o deal escolhido do JSONB no servidor
      let matched: PiperunDeal | null = null;
      try {
        const { data: dealRow, error: dealErr } = await (supabase as any).rpc(
          'fn_get_deal_from_history',
          { p_lead_id: data.lead_id, p_deal_id: id },
        );
        if (!dealErr && dealRow) matched = dealRow as PiperunDeal;
      } catch (e) {
        console.warn('[DealSearch] fn_get_deal_from_history fallback:', e);
      }

      setResult({ ...(data as DealSearchResult), matched_deal: matched });
    } catch (err: any) {
      setError(`Erro: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    search, loading, error, result,
    clear: () => { setResult(null); setError(null); },
  };
}

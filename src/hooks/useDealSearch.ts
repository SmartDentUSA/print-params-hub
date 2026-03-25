import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DealSearchResult, PiperunDeal } from '@/types/courses';
import { isDealGanho } from '@/lib/courseUtils';

const SEARCH_FIELDS = 'id,nome,email,telefone_normalized,piperun_id,pessoa_piperun_id,especialidade,area_atuacao,buyer_type,empresa_cnpj,cidade,uf,pais,piperun_deals_history';

export function useDealSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<DealSearchResult | null>(null);

  const search = async (dealId: string) => {
    if (!dealId.trim()) return;
    const id = dealId.trim();
    setLoading(true); setError(null); setResult(null);
    try {
      let data: any = null;

      // Tentativa 1: piperun_id do lead (coluna text)
      if (!data) {
        const res = await (supabase as any).from('lia_attendances').select(SEARCH_FIELDS)
          .eq('piperun_id', id)
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T1 piperun_id:', { count: res.data?.length, err: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 2: pessoa_piperun_id (coluna integer)
      if (!data && /^\d+$/.test(id)) {
        const res = await (supabase as any).from('lia_attendances').select(SEARCH_FIELDS)
          .eq('pessoa_piperun_id', Number(id))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T2 pessoa_piperun_id:', { count: res.data?.length, err: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 3: deal_id dentro do JSONB como string
      if (!data) {
        const res = await (supabase as any).from('lia_attendances').select(SEARCH_FIELDS)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: id }]))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T3 JSONB string:', { count: res.data?.length, err: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 4: deal_id como numero no JSONB
      if (!data && /^\d+$/.test(id)) {
        const res = await (supabase as any).from('lia_attendances').select(SEARCH_FIELDS)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: Number(id) }]))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T4 JSONB number:', { count: res.data?.length, err: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 5: textSearch via RPC (fallback mais confiável)
      if (!data) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_search_deals_by_status' as any, {
          p_status: null,
          p_product: null,
          p_owner: null,
          p_min_value: null,
          p_max_value: null,
          p_limit: 1,
        });
        console.log('[DealSearch] T5 RPC fallback:', { count: (rpcData as any)?.length, err: rpcErr?.message });
        // Se a RPC retorna deals, procurar o deal_id match
        if (!rpcErr && Array.isArray(rpcData)) {
          const match = (rpcData as any[]).find((r: any) => String(r.deal_id) === id);
          if (match?.lead_id) {
            const res = await (supabase as any).from('lia_attendances').select(SEARCH_FIELDS)
              .eq('id', match.lead_id)
              .is('merged_into', null)
              .limit(1);
            if (!res.error && res.data?.length) data = res.data[0];
          }
        }
      }

      if (!data) {
        setError('Deal não encontrado. Verifique o ID e tente novamente.');
        return;
      }

      const history: PiperunDeal[] = data.piperun_deals_history ?? [];
      const matchedDeal =
        history.find((d: PiperunDeal) => String(d.deal_id) === id) ??
        history.find(isDealGanho) ??
        history[0];

      if (!matchedDeal) {
        setError('Lead encontrado mas sem deals no histórico.');
        return;
      }

      setResult({ ...data, lead_id: data.id, piperun_deals_history: history, matched_deal: matchedDeal });
    } catch (err) {
      console.error('[useDealSearch]', err);
      setError('Erro na busca. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return {
    search, loading, error, result,
    clear: () => { setResult(null); setError(null); },
  };
}

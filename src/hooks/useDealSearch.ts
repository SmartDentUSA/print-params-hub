import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DealSearchResult, PiperunDeal } from '@/types/courses';
import { isDealGanho } from '@/lib/courseUtils';

const FIELDS = 'id,nome,email,telefone_normalized,piperun_id,pessoa_piperun_id,especialidade,area_atuacao,buyer_type,empresa_cnpj,cidade,uf,pais_origem,piperun_deals_history';

export function useDealSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<DealSearchResult | null>(null);

  const search = async (dealId: string) => {
    if (!dealId.trim()) return;
    const id = dealId.trim();
    setLoading(true); setError(null); setResult(null);

    try {
      // 1) RPC resolve o lead canônico (sem duplicatas)
      const { data: rpc, error: rpcErr } = await (supabase as any)
        .rpc('fn_search_deal_for_training', { p_deal_id: id });
      if (rpcErr) throw rpcErr;

      const r: any = rpc;
      if (!r?.found || !r?.lead_id) {
        setError('Deal não encontrado. Verifique o ID e tente novamente.');
        return;
      }
      if (r.warning) console.warn('[DealSearch]', r.warning);

      // 2) Hidrata o lead canônico para preservar Step 2/3 do EnrollmentModal
      const { data, error: leadErr } = await (supabase as any)
        .from('lia_attendances')
        .select(FIELDS)
        .eq('id', r.lead_id)
        .is('merged_into', null)
        .maybeSingle();
      if (leadErr) throw leadErr;
      if (!data) {
        setError('Lead canônico não encontrado para este deal.');
        return;
      }

      const history: PiperunDeal[] = data.piperun_deals_history ?? [];
      const matchedDeal =
        history.find((d: PiperunDeal) => String(d.deal_id) === id) ??
        history.find(isDealGanho) ??
        history[0];

      if (!matchedDeal) {
        setError(`Lead "${data.nome}" encontrado mas sem deals no histórico (${history.length} deals).`);
        return;
      }

      setResult({
        ...data,
        lead_id: data.id,
        piperun_deals_history: history,
        matched_deal: matchedDeal,
        rpc_strategy: r.strategy,
        rpc_warning: r.warning ?? null,
      });
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

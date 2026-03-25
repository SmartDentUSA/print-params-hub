import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DealSearchResult, PiperunDeal } from '@/types/courses';
import { isDealGanho } from '@/lib/courseUtils';

export function useDealSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<DealSearchResult | null>(null);

  const search = async (dealId: string) => {
    if (!dealId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fields = `id, nome, email, telefone_normalized,
        piperun_id, pessoa_piperun_id, especialidade, area_atuacao,
        buyer_type, empresa_cnpj, cidade, uf, pais, piperun_deals_history`;

      // Tentativa 1: piperun_id do lead (indice direto)
      let { data } = await (supabase as any).from('lia_attendances').select(fields)
        .eq('piperun_id', dealId.trim())
        .is('merged_into', null)  // SEMPRE — regra absoluta
        .limit(1).maybeSingle();

      // Tentativa 2: deal_id dentro do JSONB
      if (!data) {
        const { data: d2 } = await (supabase as any).from('lia_attendances').select(fields)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: dealId.trim() }]))
          .is('merged_into', null)
          .limit(1).maybeSingle();
        data = d2;
      }

      if (!data) {
        setError('Deal não encontrado. Verifique o ID e tente novamente.');
        return;
      }

      const history: PiperunDeal[] = data.piperun_deals_history ?? [];
      const matchedDeal =
        history.find((d: PiperunDeal) => d.deal_id === dealId.trim()) ??
        history.find(isDealGanho) ??
        history[0];

      setResult({ ...data, lead_id: data.id, piperun_deals_history: history, matched_deal: matchedDeal! });
    } catch {
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

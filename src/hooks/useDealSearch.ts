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

    const errors: string[] = [];

    try {
      let data: any = null;

      // T1: piperun_id (coluna text)
      const r1 = await (supabase as any).from('lia_attendances')
        .select(FIELDS)
        .eq('piperun_id', id)
        .is('merged_into', null)
        .limit(1);
      if (r1.error) errors.push(`T1: ${r1.error.message}`);
      if (!r1.error && r1.data?.length) data = r1.data[0];

      // T2: pessoa_piperun_id (coluna int4)
      if (!data && /^\d+$/.test(id)) {
        const r2 = await (supabase as any).from('lia_attendances')
          .select(FIELDS)
          .eq('pessoa_piperun_id', Number(id))
          .is('merged_into', null)
          .limit(1);
        if (r2.error) errors.push(`T2: ${r2.error.message}`);
        if (!r2.error && r2.data?.length) data = r2.data[0];
      }

      // T3: JSONB contains deal_id string
      if (!data) {
        const r3 = await (supabase as any).from('lia_attendances')
          .select(FIELDS)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: id }]))
          .is('merged_into', null)
          .limit(1);
        if (r3.error) errors.push(`T3: ${r3.error.message}`);
        if (!r3.error && r3.data?.length) data = r3.data[0];
      }

      // T4: JSONB contains deal_id number
      if (!data && /^\d+$/.test(id)) {
        const r4 = await (supabase as any).from('lia_attendances')
          .select(FIELDS)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: Number(id) }]))
          .is('merged_into', null)
          .limit(1);
        if (r4.error) errors.push(`T4: ${r4.error.message}`);
        if (!r4.error && r4.data?.length) data = r4.data[0];
      }

      if (!data) {
        const detail = errors.length > 0
          ? `Erros: ${errors.join(' | ')}`
          : 'Nenhum registro com esse ID. Verifique se é o Deal ID correto.';
        setError(detail);
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

      setResult({ ...data, lead_id: data.id, piperun_deals_history: history, matched_deal: matchedDeal });
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

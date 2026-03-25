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
    const id = dealId.trim();
    setLoading(true); setError(null); setResult(null);
    try {
      const fields = `id, nome, email, telefone_normalized,
        piperun_id, pessoa_piperun_id, especialidade, area_atuacao,
        buyer_type, empresa_cnpj, cidade, uf, pais, piperun_deals_history`;

      let data: any = null;

      // Tentativa 1: piperun_id do lead (string match — coluna text)
      if (!data) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .eq('piperun_id', id)
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T1 piperun_id:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 2: pessoa_piperun_id (coluna integer)
      if (!data && /^\d+$/.test(id)) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .eq('pessoa_piperun_id', Number(id))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T2 pessoa_piperun_id:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 3: deal_id dentro do JSONB como string
      if (!data) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: id }]))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T3 JSONB string:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 4: deal_id como numero no JSONB
      if (!data && /^\d+$/.test(id)) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .contains('piperun_deals_history', JSON.stringify([{ deal_id: Number(id) }]))
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T4 JSONB number:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 5: busca textual no JSONB (deal_id como valor string no JSON)
      if (!data) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .like('piperun_deals_history::text', `%"deal_id":"${id}"%`)
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T5 text like quoted:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
      }

      // Tentativa 6: busca textual (deal_id numerico no JSON)
      if (!data && /^\d+$/.test(id)) {
        const res = await (supabase as any).from('lia_attendances').select(fields)
          .like('piperun_deals_history::text', `%"deal_id":${id},%`)
          .is('merged_into', null)
          .limit(1);
        console.log('[DealSearch] T6 text like numeric:', { data: res.data?.length, error: res.error?.message });
        if (!res.error && res.data?.length) data = res.data[0];
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

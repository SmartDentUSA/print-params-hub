import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useZernioSync() {
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-posts-sync', { method: 'POST' });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Resposta inesperada da função de sincronização');
      const upserted = Number(data?.upserted ?? 0);
      toast.success(`${upserted} post${upserted === 1 ? '' : 's'} sincronizado${upserted === 1 ? '' : 's'}`);
      await qc.invalidateQueries({ queryKey: ['social-posts-bank'] });
      await qc.refetchQueries({ queryKey: ['social-posts-bank'] });
      // Fire-and-forget: dispara posts novos para os grupos WA configurados.
      supabase.functions
        .invoke('social-post-auto-blast', { method: 'POST', body: {} })
        .then(({ data, error }) => {
          if (error) return console.warn('[auto-blast] falhou', error);
          const n = Number((data as any)?.dispatched_campaigns ?? 0);
          if (n > 0) toast.success(`${n} campanha${n === 1 ? '' : 's'} de grupo enfileirada${n === 1 ? '' : 's'}`);
        })
        .catch((e) => console.warn('[auto-blast] erro', e));
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return { sync, syncing };
}
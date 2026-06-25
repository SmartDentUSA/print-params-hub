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
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return { sync, syncing };
}
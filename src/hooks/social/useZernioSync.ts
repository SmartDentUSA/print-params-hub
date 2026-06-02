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
      const { data, error } = await supabase.functions.invoke('social-posts-sync', { body: {} });
      if (error) throw error;
      const count = (data as any)?.synced ?? (data as any)?.count ?? 0;
      toast.success(`${count} posts sincronizados`);
      qc.invalidateQueries({ queryKey: ['social-posts-bank'] });
      qc.invalidateQueries({ queryKey: ['social-metrics'] });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes('ZERNIO_API_KEY') || msg.includes('401') || msg.includes('unauthorized')) {
        toast.error('Configure ZERNIO_API_KEY em Settings → Edge Functions → Secrets');
      } else {
        toast.error(`Erro ao sincronizar: ${msg}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  return { sync, syncing };
}
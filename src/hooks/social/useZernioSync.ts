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
      const [metricsRes, accountsRes] = await Promise.all([
        supabase.functions.invoke('zernio-metrics-sync', { body: {} }),
        supabase.functions.invoke('zernio-accounts-sync', { body: {} }),
      ]);
      if (metricsRes.error) throw metricsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      const postsCount =
        (metricsRes.data as any)?.updated ??
        (metricsRes.data as any)?.synced ??
        (metricsRes.data as any)?.count ?? 0;
      const accountsCount = (accountsRes.data as any)?.synced ?? 0;
      toast.success(`${postsCount} posts atualizados • ${accountsCount} contas`);
      qc.invalidateQueries({ queryKey: ['social-posts-bank'] });
      qc.invalidateQueries({ queryKey: ['social-metrics'] });
      qc.invalidateQueries({ queryKey: ['social-calendar-posts'] });
      qc.invalidateQueries({ queryKey: ['social-analytics'] });
      qc.invalidateQueries({ queryKey: ['social-zernio-accounts'] });
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
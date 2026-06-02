import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ZernioAccount {
  id: string;
  zernio_account_id: string;
  zernio_profile_id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  active: boolean;
}

export function useZernioAccounts(platform?: string) {
  return useQuery({
    queryKey: ['social-zernio-accounts', platform ?? 'all'],
    queryFn: async (): Promise<ZernioAccount[]> => {
      let q = supabase
        .from('social_zernio_accounts' as any)
        .select('*')
        .eq('active', true)
        .order('platform');
      if (platform) q = q.eq('platform', platform);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ZernioAccount[];
    },
    staleTime: 60_000,
  });
}
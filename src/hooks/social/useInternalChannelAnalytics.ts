import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InternalInstance {
  name: string | null;
  instance: string;
  phone: string | null;
  active: boolean;
  provider: string | null;
  health_status: string | null;
  consecutive_errors: number | null;
  last_success_at: string | null;
  last_error_at: string | null;
  sent: number;
  sent_ok: number;
  sent_fail: number;
  group_sent: number;
  group_ok: number;
}

export interface InternalChannels {
  days: number;
  instances: InternalInstance[];
  wa_daily: Array<{ date: string; count: number }>;
  lia: {
    interactions: number;
    sessions: number;
    unanswered: number;
    avg_similarity: number | null;
    avg_judge: number | null;
    total_sessions: number;
    human_takeover: number;
    handoffs: number;
  };
  lia_daily: Array<{ date: string; count: number; unanswered: number }>;
}

export function useInternalChannelAnalytics(days: number) {
  return useQuery({
    queryKey: ['social-internal-channels', days],
    queryFn: async (): Promise<InternalChannels> => {
      const { data, error } = await supabase.rpc('fn_social_internal_analytics' as any, { p_days: days });
      if (error) throw error;
      return data as unknown as InternalChannels;
    },
    staleTime: 2 * 60_000,
  });
}
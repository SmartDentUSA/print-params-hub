import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventArtAsset {
  kind: string;
  label: string;
  url: string;
  width: number;
  height: number;
}

export interface EventArtGroup {
  eventId: string;
  eventName: string;
  startDate: string | null;
  assets: EventArtAsset[];
}

async function fetchEventArts(): Promise<EventArtGroup[]> {
  const { data, error } = await supabase
    .from('smartops_events')
    .select('id, name, start_date, marketing_assets')
    .not('marketing_assets', 'is', null)
    .order('start_date', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? [])
    .map((row: any) => {
      const raw = Array.isArray(row.marketing_assets) ? row.marketing_assets : [];
      const assets = raw
        .filter((a: any) => a && typeof a.url === 'string')
        .map((a: any) => ({
          kind: String(a.kind ?? 'arte'),
          label: String(a.label ?? 'Arte'),
          url: a.url as string,
          width: Number(a.width ?? 0),
          height: Number(a.height ?? 0),
        })) as EventArtAsset[];
      return {
        eventId: row.id as string,
        eventName: (row.name as string) ?? 'Evento',
        startDate: (row.start_date as string) ?? null,
        assets,
      };
    })
    .filter((g) => g.assets.length > 0);
}

export function useEventMarketingAssets(enabled = true) {
  return useQuery({
    queryKey: ['event-marketing-assets'],
    queryFn: fetchEventArts,
    enabled,
    staleTime: 60_000,
  });
}

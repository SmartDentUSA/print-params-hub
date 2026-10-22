import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackContentEvent } from '@/hooks/usePageTracking';
import { isPandaPlayMessage, pandaEmbedIdentity } from '@/lib/pandaVideoTracking';

type VideoMetrics = { id: string; title: string; pandavideo_id: string | null; embed_url: string | null; analytics_views: number | null; analytics_last_sync: string | null };

export function usePandaVideoTracking(src: string | null | undefined, formId?: string | null) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [metrics, setMetrics] = useState<VideoMetrics | null>(null);
  const metricsRef = useRef<VideoMetrics | null>(null);
  const played = useRef(false);

  useEffect(() => {
    let cancelled = false;
    played.current = false;
    metricsRef.current = null;
    setMetrics(null);
    const identity = pandaEmbedIdentity(src);
    if (!identity) return;
    const load = async () => {
      // Match by embed identity, NOT Panda's internal API UUID. Bounded public read.
      const { data, error } = await supabase.from('knowledge_videos')
        .select('id,title,pandavideo_id,embed_url,analytics_views,analytics_last_sync')
        .ilike('embed_url', `%${identity.embedId}%`).limit(20);
      const match = data?.find(video => {
        const saved = pandaEmbedIdentity(video.embed_url);
        return saved?.embedId === identity.embedId && saved.origin === identity.origin;
      }) ?? null;
      if (!cancelled && !error) { metricsRef.current = match; setMetrics(match); }
    };
    void load();
    // Only a visible player refreshes its stored snapshot; no calls to Panda from browsers.
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    const onMessage = (event: MessageEvent) => {
      if (played.current || !isPandaPlayMessage(event, identity.origin, frameRef.current?.contentWindow)) return;
      played.current = true; // pause/resume is not another visualization
      const video = metricsRef.current;
      void trackContentEvent({
        action: 'play', contentType: 'video',
        title: `Reproduziu vídeo: ${video?.title || 'Vídeo do produto'}`,
        path: window.location.pathname,
        extra: { video_id: video?.id ?? null, pandavideo_id: video?.pandavideo_id ?? null, embed_id: identity.embedId, form_id: formId ?? null, player_event: 'panda_play' },
      });
    };
    window.addEventListener('message', onMessage);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('message', onMessage); };
  }, [src, formId]);

  return { frameRef, metrics };
}
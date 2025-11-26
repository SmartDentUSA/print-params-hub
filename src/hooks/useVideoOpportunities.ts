import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type VideoRow = {
  id: string;
  title: string;
  pandavideo_id: string;
  analytics_views: number;
  analytics_unique_views: number;
  analytics_plays: number;
  analytics_unique_plays: number;
  analytics_avg_retention: number;
  analytics_play_rate: number;
  relevance_score: number;
  content_id: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
};

export type VideoWithContent = VideoRow & {
  content_title?: string;
};

export type Summary = {
  totalVideos: number;
  withContent: number;
  noContent: number;
  analyticsSynced: boolean;
  lastSync?: string;
};

export function useVideoOpportunities() {
  const [summary, setSummary] = useState<Summary>({
    totalVideos: 0,
    withContent: 0,
    noContent: 0,
    analyticsSynced: false,
  });
  const [topOpportunities, setTopOpportunities] = useState<VideoRow[]>([]);
  const [existingContents, setExistingContents] = useState<VideoWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  async function fetchAnalyticsSummary() {
    try {
      // Total de vídeos
      const { count: total } = await supabase
        .from('knowledge_videos')
        .select('*', { count: 'exact', head: true })
        .not('pandavideo_id', 'is', null);

      // Com conteúdo
      const { count: withContent } = await supabase
        .from('knowledge_videos')
        .select('*', { count: 'exact', head: true })
        .not('pandavideo_id', 'is', null)
        .not('content_id', 'is', null);

      // Sem conteúdo
      const { count: noContent } = await supabase
        .from('knowledge_videos')
        .select('*', { count: 'exact', head: true })
        .not('pandavideo_id', 'is', null)
        .is('content_id', null);

      // Último sync
      const { data: lastSyncData } = await supabase
        .from('knowledge_videos')
        .select('analytics_last_sync')
        .not('analytics_last_sync', 'is', null)
        .order('analytics_last_sync', { ascending: false })
        .limit(1)
        .single();

      const lastSync = lastSyncData?.analytics_last_sync 
        ? new Date(lastSyncData.analytics_last_sync).toLocaleString('pt-BR')
        : undefined;

      return {
        totalVideos: total || 0,
        withContent: withContent || 0,
        noContent: noContent || 0,
        analyticsSynced: !!lastSyncData?.analytics_last_sync,
        lastSync,
      };
    } catch (error) {
      console.error('Error fetching summary:', error);
      return {
        totalVideos: 0,
        withContent: 0,
        noContent: 0,
        analyticsSynced: false,
      };
    }
  }

  async function fetchTopOpportunities() {
    try {
      const { data, error } = await supabase
        .from('knowledge_videos')
        .select('*')
        .not('pandavideo_id', 'is', null)
        .is('content_id', null)
        .order('relevance_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      return [];
    }
  }

  async function fetchExistingContents() {
    try {
      const { data: videos, error } = await supabase
        .from('knowledge_videos')
        .select('*')
        .not('pandavideo_id', 'is', null)
        .not('content_id', 'is', null)
        .order('relevance_score', { ascending: false });

      if (error) throw error;

      if (!videos || videos.length === 0) return [];

      // Buscar títulos dos conteúdos
      const contentIds = videos.map(v => v.content_id).filter(Boolean);
      const { data: contents } = await supabase
        .from('knowledge_contents')
        .select('id, title')
        .in('id', contentIds);

      const contentsMap = new Map(contents?.map(c => [c.id, c.title]) || []);

      return videos.map(v => ({
        ...v,
        content_title: v.content_id ? contentsMap.get(v.content_id) : undefined,
      })) as VideoWithContent[];
    } catch (error) {
      console.error('Error fetching existing contents:', error);
      return [];
    }
  }

  async function fetchData() {
    setIsLoading(true);
    try {
      const [summaryData, opportunities, existing] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchTopOpportunities(),
        fetchExistingContents(),
      ]);

      setSummary(summaryData);
      setTopOpportunities(opportunities);
      setExistingContents(existing);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function syncAnalytics() {
    setIsSyncing(true);
    let totalUpdated = 0;
    let batchCount = 0;
    
    try {
      let hasMore = true;
      
      toast({
        title: '🔄 Iniciando sincronização...',
        description: 'Processando vídeos em batches de 50.',
      });
      
      while (hasMore) {
        batchCount++;
        console.log(`🔄 Batch ${batchCount} starting...`);
        
        const { data, error } = await supabase.functions.invoke('sync-video-analytics', {
          body: { limit: 50 }
        });
        
        if (error) throw error;
        
        totalUpdated += data.updated || 0;
        hasMore = (data.remaining || 0) > 0;
        
        // Atualizar UI progressivamente
        toast({
          title: `✅ Batch ${batchCount} concluído`,
          description: `${data.updated} vídeos sincronizados. ${data.remaining > 0 ? `${data.remaining} restantes...` : 'Finalizado!'}`,
        });
        
        // Refresh data to show progress
        await fetchData();
        
        // Small delay to prevent rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      toast({
        title: '🎉 Sincronização completa!',
        description: `${totalUpdated} vídeos atualizados em ${batchCount} batches.`,
      });
    } catch (error: any) {
      console.error('Error syncing analytics:', error);
      toast({
        title: '❌ Erro na sincronização',
        description: error.message || 'Erro ao sincronizar analytics do PandaVideo',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return {
    summary,
    topOpportunities,
    existingContents,
    isLoading,
    isSyncing,
    syncAnalytics,
    refreshData: fetchData,
  };
}

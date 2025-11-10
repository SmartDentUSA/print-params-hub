import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface VideoStats {
  matched: number;
  not_found: number;
  pending: number;
  total: number;
}

export const AdminVideoProductLinks = () => {
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_videos')
        .select('product_match_status');

      if (error) throw error;

      const matched = data.filter(v => v.product_match_status === 'matched').length;
      const not_found = data.filter(v => v.product_match_status === 'not_found').length;
      const pending = data.filter(v => v.product_match_status === 'pending').length;

      setStats({
        matched,
        not_found,
        pending,
        total: data.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({ title: 'Erro ao carregar estatísticas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRelink = async () => {
    setRelinking(true);
    try {
      const { error } = await supabase.functions.invoke('sync-pandavideo');
      
      if (error) throw error;
      
      toast({ title: '✅ Re-vinculação iniciada com sucesso!' });
      await fetchStats();
    } catch (error) {
      console.error('Relink error:', error);
      toast({ title: 'Erro ao re-vincular vídeos', variant: 'destructive' });
    } finally {
      setRelinking(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return <div className="text-muted-foreground">Carregando estatísticas...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vinculação Vídeo → Produto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Vinculados</span>
            </div>
            <p className="text-2xl font-bold">{stats.matched}</p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium">Não Encontrados</span>
            </div>
            <p className="text-2xl font-bold">{stats.not_found}</p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium">Pendentes</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {stats.pending > 0 
              ? `${stats.pending} vídeo(s) aguardando vinculação`
              : 'Todos os vídeos foram processados'
            }
          </p>
          <Button 
            onClick={handleRelink}
            disabled={relinking}
            variant="default"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${relinking ? 'animate-spin' : ''}`} />
            Re-vincular Vídeos Pendentes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

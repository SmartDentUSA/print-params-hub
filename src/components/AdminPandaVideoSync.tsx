import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface SyncResult {
  success: boolean;
  summary?: {
    folders: number;
    videos: number;
    total_videos: number;
  };
  error?: string;
  timestamp?: string;
}

export function AdminPandaVideoSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-pandavideo');

      if (error) throw error;
      setResult(data as SyncResult);
    } catch (error) {
      console.error('Sync error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔄 Sincronização PandaVideo
        </CardTitle>
        <CardDescription>
          Importar todos os vídeos e pastas da sua conta PandaVideo para o banco de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleSync}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Agora
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-2">
              {result.success ? (
                <Badge className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Sucesso
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Erro
                </Badge>
              )}
            </div>

            {result.success && result.summary && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Sincronização concluída:
                </p>
                <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <li>📁 {result.summary.folders} pastas sincronizadas</li>
                  <li>📹 {result.summary.videos} vídeos sincronizados</li>
                  <li>📊 Total disponível: {result.summary.total_videos} vídeos</li>
                </ul>
                {result.timestamp && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                    {new Date(result.timestamp).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}

            {!result.success && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">Erro:</p>
                <p className="text-sm text-red-800 dark:text-red-200">{result.error}</p>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 mt-4 border-t pt-4">
          <p>💡 <strong>Dica:</strong> Execute esta sincronização sempre que adicionar novos vídeos no PandaVideo.</p>
          <p>⏱️ O processo pode levar alguns minutos dependendo da quantidade de vídeos.</p>
          <p>🔄 Os vídeos sincronizados ficam disponíveis para serem associados a artigos da Base de Conhecimento.</p>
        </div>
      </CardContent>
    </Card>
  );
}

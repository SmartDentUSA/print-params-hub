import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, CheckCircle, XCircle, Pause } from 'lucide-react';

interface SyncSummary {
  folders: number;
  processed: number;
  updated: number;
  skipped: number;
  pages_processed: number;
  current_page: number;
  total_videos: number;
}

interface SyncResult {
  success: boolean;
  summary?: SyncSummary;
  error?: string;
  timestamp?: string;
}

export function AdminPandaVideoSync() {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  
  // Accumulated counters
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  const syncPage = async (page: number, onlyMissing: boolean = false) => {
    const { data, error } = await supabase.functions.invoke('sync-pandavideo', {
      body: {
        startPage: page,
        maxPages: 1,
        limit: 50,
        onlyMissingCustomFields: onlyMissing,
      },
    });

    if (error) throw error;
    return data as SyncResult;
  };

  const handleSyncAll = async () => {
    setLoading(true);
    setCancelled(false);
    setResult(null);
    setTotalProcessed(0);
    setTotalUpdated(0);
    setTotalSkipped(0);
    setTotalPages(0);
    setCurrentPage(1);
    setEstimatedTotal(0);

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore && !cancelled) {
        setCurrentPage(page);
        
        const pageResult = await syncPage(page, false);
        
        if (!pageResult.success) {
          setResult(pageResult);
          break;
        }

        if (pageResult.summary) {
          setTotalProcessed(prev => prev + pageResult.summary!.processed);
          setTotalUpdated(prev => prev + pageResult.summary!.updated);
          setTotalSkipped(prev => prev + pageResult.summary!.skipped);
          setTotalPages(prev => prev + 1);
          setEstimatedTotal(pageResult.summary.total_videos);

          // Check if there are more pages
          if (pageResult.summary.processed < 50) {
            hasMore = false;
          }
        }

        page++;
      }

      setResult({
        success: true,
        summary: {
          folders: 0,
          processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalSkipped,
          pages_processed: totalPages,
          current_page: page - 1,
          total_videos: estimatedTotal,
        },
        timestamp: new Date().toISOString(),
      });

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

  const handleReprocessPending = async () => {
    setLoading(true);
    setCancelled(false);
    setResult(null);
    setTotalProcessed(0);
    setTotalUpdated(0);
    setTotalSkipped(0);
    setTotalPages(0);
    setCurrentPage(1);
    setEstimatedTotal(0);

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore && !cancelled) {
        setCurrentPage(page);
        
        const pageResult = await syncPage(page, true); // onlyMissingCustomFields=true
        
        if (!pageResult.success) {
          setResult(pageResult);
          break;
        }

        if (pageResult.summary) {
          setTotalProcessed(prev => prev + pageResult.summary!.processed);
          setTotalUpdated(prev => prev + pageResult.summary!.updated);
          setTotalSkipped(prev => prev + pageResult.summary!.skipped);
          setTotalPages(prev => prev + 1);
          setEstimatedTotal(pageResult.summary.total_videos);

          // Check if there are more pages
          if (pageResult.summary.processed < 50) {
            hasMore = false;
          }
        }

        page++;
      }

      setResult({
        success: true,
        summary: {
          folders: 0,
          processed: totalProcessed,
          updated: totalUpdated,
          skipped: totalSkipped,
          pages_processed: totalPages,
          current_page: page - 1,
          total_videos: estimatedTotal,
        },
        timestamp: new Date().toISOString(),
      });

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

  const handleCancel = () => {
    setCancelled(true);
  };

  const progressPercentage = estimatedTotal > 0 
    ? Math.min(100, (totalProcessed / estimatedTotal) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔄 Sincronização PandaVideo
        </CardTitle>
        <CardDescription>
          Importar vídeos e pastas da sua conta PandaVideo com controle de progresso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={handleSyncAll}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Tudo
              </>
            )}
          </Button>

          <Button
            onClick={handleReprocessPending}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reprocessando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reprocessar Pendentes
              </>
            )}
          </Button>

          {loading && (
            <Button
              onClick={handleCancel}
              variant="destructive"
              size="icon"
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <Progress value={progressPercentage} className="w-full" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded">
                <p className="text-xs text-blue-600 dark:text-blue-400">Página Atual</p>
                <p className="font-semibold">{currentPage}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950 p-2 rounded">
                <p className="text-xs text-green-600 dark:text-green-400">Processados</p>
                <p className="font-semibold">{totalProcessed} / {estimatedTotal || '?'}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 p-2 rounded">
                <p className="text-xs text-purple-600 dark:text-purple-400">Atualizados</p>
                <p className="font-semibold">{totalUpdated}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">Ignorados</p>
                <p className="font-semibold">{totalSkipped}</p>
              </div>
            </div>
          </div>
        )}

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
                  <li>📄 {result.summary.pages_processed} páginas processadas</li>
                  <li>📹 {result.summary.processed} vídeos processados</li>
                  <li>✅ {result.summary.updated} vídeos atualizados</li>
                  <li>⏭️ {result.summary.skipped} vídeos ignorados</li>
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
          <p>💡 <strong>Sincronizar Tudo:</strong> Processa todos os vídeos do início, atualizando dados existentes.</p>
          <p>🔄 <strong>Reprocessar Pendentes:</strong> Processa apenas vídeos sem custom_fields preenchidos.</p>
          <p>⏱️ O processo mostra progresso em tempo real e pode ser cancelado a qualquer momento.</p>
        </div>
      </CardContent>
    </Card>
  );
}

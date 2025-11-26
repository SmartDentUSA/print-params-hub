import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Play, Key, Video, BarChart3, Folder } from 'lucide-react';

export function AdminPandaVideoTest() {
  const [loading, setLoading] = useState(false);
  const [videoId, setVideoId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [lastAction, setLastAction] = useState<string>('');

  const callAPI = async (action: string, options?: { extraParams?: Record<string, any>, rawPath?: string }) => {
    setLoading(true);
    setLastAction(action);
    try {
      const { data, error } = await supabase.functions.invoke('pandavideo-test', {
        body: { 
          action, 
          videoId: videoId || undefined, 
          limit: 10,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          extraParams: options?.extraParams,
          rawPath: options?.rawPath,
        }
      });

      if (error) throw error;
      setResponse(data);
    } catch (error) {
      console.error('Error calling PandaVideo API:', error);
      setResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const detectStructure = (data: any) => {
    const insights: string[] = [];
    
    if (data?.videos && Array.isArray(data.videos)) {
      insights.push(`✅ Array "videos" com ${data.videos.length} items`);
      
      if (data.videos.length > 0) {
        const firstVideo = data.videos[0];
        if (firstVideo.id) insights.push(`✅ Campo "id" detectado`);
        if (firstVideo.title) insights.push(`✅ Campo "title" detectado`);
        if (firstVideo.thumbnail) insights.push(`✅ Campo "thumbnail" detectado`);
        if (firstVideo.duration) insights.push(`✅ Campo "duration" detectado (${firstVideo.duration}s)`);
        if (firstVideo.embed_url) insights.push(`✅ Campo "embed_url" detectado`);
      }
    }
    
    if (data?.total) {
      insights.push(`✅ Total de vídeos disponíveis: ${data.total}`);
    }
    
    if (data?.id) {
      insights.push(`✅ Vídeo único com ID: ${data.id}`);
    }
    
    if (data?.title) {
      insights.push(`✅ Título: "${data.title}"`);
    }
    
    if (data?.folders && Array.isArray(data.folders)) {
      insights.push(`✅ ${data.folders.length} pasta(s) encontrada(s)`);
    }

    // Detectar custom_fields em diferentes formatos conhecidos
    if (data?.custom_fields) insights.push('✅ Campo "custom_fields" presente na raiz');
    if (data?.data?.custom_fields) insights.push('✅ Campo "custom_fields" presente em data.custom_fields');
    if (Array.isArray(data?.videos) && data.videos[0]?.custom_fields) insights.push('✅ Campo "custom_fields" presente nos itens de videos');
    
    return insights;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Teste da API PandaVideo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use esta interface para testar e explorar a API REST do PandaVideo
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input para Video ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Video ID (opcional)</label>
            <Input
              placeholder="Ex: aed5f013-281f-49db-99cb-408fdf80376d"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Necessário para "Detalhes do Vídeo" e "Analytics". Use o campo "video_external_id" da lista.
            </p>
          </div>

          {/* Inputs para Analytics Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Período para Analytics (opcional)</label>
            <div className="flex gap-2 max-w-md">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Data inicial"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Data final"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se não informado, usa últimos 30 dias
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={() => callAPI('test_auth')}
              disabled={loading}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'test_auth' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Key className="h-5 w-5" />
              )}
              <span className="text-sm">Testar Auth</span>
            </Button>

            <Button
              onClick={() => callAPI('list_videos')}
              disabled={loading}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'list_videos' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
              <span className="text-sm">Listar Vídeos</span>
            </Button>

            <Button
              onClick={() => callAPI('get_video')}
              disabled={loading || !videoId}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'get_video' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              <span className="text-sm">Detalhes do Vídeo</span>
            </Button>

            <Button
              onClick={() => callAPI('get_analytics')}
              disabled={loading || !videoId}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'get_analytics' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BarChart3 className="h-5 w-5" />
              )}
              <span className="text-sm">Analytics</span>
            </Button>

            <Button
              onClick={() => callAPI('get_general_analytics')}
              disabled={loading || !videoId}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'get_general_analytics' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BarChart3 className="h-5 w-5 text-blue-500" />
              )}
              <span className="text-sm">Métricas Gerais</span>
            </Button>

            <Button
              onClick={() => callAPI('get_retention')}
              disabled={loading || !videoId}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'get_retention' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="text-2xl">📈</span>
              )}
              <span className="text-sm">Retenção</span>
            </Button>

            <Button
              onClick={() => callAPI('list_folders')}
              disabled={loading}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'list_folders' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Folder className="h-5 w-5" />
              )}
              <span className="text-sm">Listar Pastas</span>
            </Button>

            <Button
              onClick={() => callAPI('get_subtitles_info')}
              disabled={loading || !videoId}
              variant="outline"
              className="h-20 flex-col gap-2"
            >
              {loading && lastAction === 'get_subtitles_info' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="text-2xl">📝</span>
              )}
              <span className="text-sm">Info Legendas</span>
            </Button>
          </div>

          {/* Legendas por idioma */}
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Baixar Legendas por Idioma (requer Video ID)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button
                onClick={() => callAPI('get_subtitle', { extraParams: { srclang: 'pt-BR' } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16 flex items-center gap-2"
              >
                🇧🇷 Português (pt-BR)
              </Button>

              <Button
                onClick={() => callAPI('get_subtitle', { extraParams: { srclang: 'en' } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16 flex items-center gap-2"
              >
                🇺🇸 English (en)
              </Button>

              <Button
                onClick={() => callAPI('get_subtitle', { extraParams: { srclang: 'es' } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16 flex items-center gap-2"
              >
                🇪🇸 Español (es)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Retorna o conteúdo das legendas em formato VTT ou SRT. Use "Info Legendas" primeiro para ver idiomas disponíveis.
            </p>
          </div>

          {/* Variações para custom_fields */}
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Variações para obter custom_fields</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button
                onClick={() => callAPI('get_video_with_params', { extraParams: { custom_fields: true } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16"
              >
                ?custom_fields=true
              </Button>

              <Button
                onClick={() => callAPI('get_video_with_params', { extraParams: { include_custom_fields: true } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16"
              >
                ?include_custom_fields=true
              </Button>

              <Button
                onClick={() => callAPI('get_video_with_params', { extraParams: { expand: 'custom_fields' } })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16"
              >
                ?expand=custom_fields
              </Button>

              <Button
                onClick={() => callAPI('get_video_metadata')}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16"
              >
                /videos/{'{'}id{'}'}/metadata
              </Button>

              <Button
                onClick={() => callAPI('raw_get', { rawPath: `videos/${videoId}/custom-fields` })}
                disabled={loading || !videoId}
                variant="outline"
                className="h-16"
              >
                /videos/{'{'}id{'}'}/custom-fields
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Informe um Video ID acima e teste cada variação para identificar qual retorna custom_fields.</p>
          </div>

          {/* Resposta */}
          {response && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-2 flex-wrap">
                {response.success ? (
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
                <Badge variant="outline">
                  Status: {response.status}
                </Badge>
                {response.action && (
                  <Badge variant="secondary">
                    {response.action}
                  </Badge>
                )}
                {response.timestamp && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(response.timestamp).toLocaleTimeString('pt-BR')}
                  </Badge>
                )}
              </div>

              {response.description && (
                <p className="text-sm text-muted-foreground">
                  {response.description}
                </p>
              )}

              {/* JSON Response */}
              <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs font-mono">
                  {formatJSON(response)}
                </pre>
              </div>

              {/* Análise da Estrutura */}
              {response.success && response.data && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <strong className="text-sm font-semibold text-blue-900">
                    💡 Estrutura detectada:
                  </strong>
                  <ul className="mt-2 space-y-1 text-sm text-blue-800">
                    {detectStructure(response.data).map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                    {detectStructure(response.data).length === 0 && (
                      <li className="text-muted-foreground">
                        Nenhuma estrutura padrão detectada
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Error Details */}
              {!response.success && response.error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <strong className="text-sm font-semibold text-red-900">
                    ❌ Erro:
                  </strong>
                  <p className="mt-1 text-sm text-red-800">{response.error}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

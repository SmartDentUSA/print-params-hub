import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Video, Flame, CheckCircle2, AlertTriangle, ExternalLink, Loader2, Save } from 'lucide-react';
import { useVideoOpportunities, VideoRow } from '@/hooks/useVideoOpportunities';
import { AdminVideosList } from './AdminVideosList';

export function AdminVideoAnalyticsDashboard() {
  const {
    summary,
    topOpportunities,
    existingContents,
    products,
    resins,
    isLoading,
    isSyncing,
    isSaving,
    syncAnalytics,
    updateVideoLink,
  } = useVideoOpportunities();

  // Estado para rastrear edições pendentes por vídeo
  const [pendingEdits, setPendingEdits] = useState<Record<string, { productId: string | null; resinId: string | null }>>({});

  // Mapear produtos e resinas por ID para lookup rápido
  const productsMap = new Map(products.map(p => [p.id, p]));
  const resinsMap = new Map(resins.map(r => [r.id, r]));

  // Obter nome do produto/resina vinculado
  const getLinkedName = (video: VideoRow) => {
    if (video.product_id && productsMap.has(video.product_id)) {
      return productsMap.get(video.product_id)?.name || 'Produto';
    }
    if (video.resin_id && resinsMap.has(video.resin_id)) {
      const resin = resinsMap.get(video.resin_id);
      return `${resin?.manufacturer} - ${resin?.name}`;
    }
    return null;
  };

  // Obter valor atual do select (considerando edições pendentes)
  const getCurrentValue = (video: VideoRow): string => {
    const pending = pendingEdits[video.id];
    if (pending) {
      if (pending.productId) return `product:${pending.productId}`;
      if (pending.resinId) return `resin:${pending.resinId}`;
      return 'none';
    }
    if (video.product_id) return `product:${video.product_id}`;
    if (video.resin_id) return `resin:${video.resin_id}`;
    return 'none';
  };

  // Handler para mudança de seleção
  const handleSelectChange = (videoId: string, value: string) => {
    if (value === 'none') {
      setPendingEdits(prev => ({ ...prev, [videoId]: { productId: null, resinId: null } }));
    } else if (value.startsWith('product:')) {
      const productId = value.replace('product:', '');
      setPendingEdits(prev => ({ ...prev, [videoId]: { productId, resinId: null } }));
    } else if (value.startsWith('resin:')) {
      const resinId = value.replace('resin:', '');
      setPendingEdits(prev => ({ ...prev, [videoId]: { productId: null, resinId } }));
    }
  };

  // Handler para salvar
  const handleSave = async (videoId: string) => {
    const pending = pendingEdits[videoId];
    if (!pending) return;

    const success = await updateVideoLink(videoId, pending.productId, pending.resinId);
    if (success) {
      setPendingEdits(prev => {
        const newState = { ...prev };
        delete newState[videoId];
        return newState;
      });
    }
  };

  // Verificar se há edição pendente para um vídeo
  const hasPendingEdit = (video: VideoRow): boolean => {
    const pending = pendingEdits[video.id];
    if (!pending) return false;
    
    const currentProductId = video.product_id || null;
    const currentResinId = video.resin_id || null;
    
    return pending.productId !== currentProductId || pending.resinId !== currentResinId;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4" />
              Total de Vídeos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalVideos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No PandaVideo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Com Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.withContent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Artigos publicados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.noContent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vídeos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Analytics
              <Badge variant={summary.analyticsSynced ? 'default' : 'destructive'}>
                {summary.analyticsSynced ? 'Sincronizado' : 'Pendente'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground mb-3">
              {summary.lastSync ? `Último: ${summary.lastSync}` : 'Nunca sincronizado'}
            </div>
            {isSyncing && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processando em batches de 50...</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 animate-pulse"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={syncAnalytics}
              disabled={isSyncing || isLoading}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Sincronizar
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Oportunidades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Oportunidades – Vídeos sem Conteúdo
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Vídeos de alta performance sem artigo publicado
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : topOpportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {summary.analyticsSynced 
                ? 'Nenhuma oportunidade encontrada. Todos os vídeos já têm conteúdo!'
                : 'Sincronize os analytics para ver as oportunidades.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead className="min-w-[220px]">Produto Vinculado</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Plays</TableHead>
                    <TableHead className="text-right">Play Rate</TableHead>
                    <TableHead className="text-right">Retenção</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOpportunities.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{v.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={getCurrentValue(v)}
                            onValueChange={(value) => handleSelectChange(v.id, value)}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Nenhum</span>
                              </SelectItem>
                              
                              {resins.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Resinas ({resins.length})</SelectLabel>
                                  {resins.map(r => (
                                    <SelectItem key={r.id} value={`resin:${r.id}`}>
                                      {r.manufacturer} - {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              
                              {products.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Produtos ({products.length})</SelectLabel>
                                  {products.slice(0, 50).map(p => (
                                    <SelectItem key={p.id} value={`product:${p.id}`}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                  {products.length > 50 && (
                                    <SelectItem value="product:more" disabled>
                                      ... e mais {products.length - 50} produtos
                                    </SelectItem>
                                  )}
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {hasPendingEdit(v) && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSave(v.id)}
                              disabled={isSaving}
                              className="h-8 px-2"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.analytics_views?.toLocaleString('pt-BR') || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.analytics_plays?.toLocaleString('pt-BR') || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.analytics_play_rate?.toFixed(1) || 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          (v.analytics_avg_retention || 0) < 30 
                            ? 'text-red-500' 
                            : (v.analytics_avg_retention || 0) < 50 
                              ? 'text-yellow-500' 
                              : 'text-green-500'
                        }>
                          {v.analytics_avg_retention?.toFixed(1) || 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={
                            (v.relevance_score || 0) >= 70 
                              ? 'default' 
                              : (v.relevance_score || 0) >= 50 
                                ? 'secondary' 
                                : 'outline'
                          }
                        >
                          {v.relevance_score?.toFixed(1) || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.embed_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a 
                              href={v.embed_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              Ver Vídeo
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conteúdos existentes */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Conteúdos com Vídeo
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Performance dos vídeos já vinculados a artigos
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : existingContents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum conteúdo vinculado a vídeos ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artigo</TableHead>
                    <TableHead>Vídeo</TableHead>
                    <TableHead className="min-w-[220px]">Produto Vinculado</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Retenção</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingContents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">
                          {c.content_title || 'Sem título'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm text-muted-foreground">
                          {c.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={getCurrentValue(c)}
                            onValueChange={(value) => handleSelectChange(c.id, value)}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Nenhum</span>
                              </SelectItem>
                              
                              {resins.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Resinas ({resins.length})</SelectLabel>
                                  {resins.map(r => (
                                    <SelectItem key={r.id} value={`resin:${r.id}`}>
                                      {r.manufacturer} - {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              
                              {products.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Produtos ({products.length})</SelectLabel>
                                  {products.slice(0, 50).map(p => (
                                    <SelectItem key={p.id} value={`product:${p.id}`}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                  {products.length > 50 && (
                                    <SelectItem value="product:more" disabled>
                                      ... e mais {products.length - 50} produtos
                                    </SelectItem>
                                  )}
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {hasPendingEdit(c) && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSave(c.id)}
                              disabled={isSaving}
                              className="h-8 px-2"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.analytics_views?.toLocaleString('pt-BR') || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.analytics_avg_retention?.toFixed(1) || 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {c.relevance_score?.toFixed(1) || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(c.analytics_avg_retention || 0) < 40 ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> 
                            Melhorar
                          </Badge>
                        ) : (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Bom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.embed_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a 
                              href={c.embed_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              Ver Vídeo
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista completa de vídeos */}
      <AdminVideosList />
    </div>
  );
}

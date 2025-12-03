import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllVideos, VIDEO_CONTENT_TYPES, VideoContentType } from '@/hooks/useAllVideos';
import { Search, ChevronLeft, ChevronRight, Video, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function AdminVideosList() {
  const {
    videos,
    loading,
    saving,
    totalCount,
    currentPage,
    totalPages,
    searchTerm,
    contentTypeFilter,
    linkStatusFilter,
    setCurrentPage,
    setSearchTerm,
    setContentTypeFilter,
    setLinkStatusFilter,
    updateContentType,
  } = useAllVideos({ pageSize: 50 });

  const [pendingChanges, setPendingChanges] = useState<Record<string, VideoContentType>>({});

  const handleContentTypeChange = (videoId: string, value: string) => {
    const newType = value === 'null' ? null : value as VideoContentType;
    setPendingChanges(prev => ({ ...prev, [videoId]: newType }));
  };

  const handleSave = async (videoId: string) => {
    const newType = pendingChanges[videoId];
    if (newType === undefined) return;

    const success = await updateContentType(videoId, newType);
    if (success) {
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[videoId];
        return next;
      });
      toast({ title: 'Tipo atualizado com sucesso' });
    } else {
      toast({ title: 'Erro ao atualizar tipo', variant: 'destructive' });
    }
  };

  const getCurrentValue = (video: { id: string; content_type: VideoContentType }) => {
    if (pendingChanges[video.id] !== undefined) {
      return pendingChanges[video.id] === null ? 'null' : pendingChanges[video.id]!;
    }
    return video.content_type === null ? 'null' : video.content_type;
  };

  const hasPendingChange = (videoId: string) => pendingChanges[videoId] !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Lista Completa de Vídeos ({totalCount})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select
            value={contentTypeFilter === null ? 'null' : contentTypeFilter}
            onValueChange={(v) => setContentTypeFilter(v === 'null' ? null : v === 'all' ? 'all' : v as VideoContentType)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de vídeo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {VIDEO_CONTENT_TYPES.map(type => (
                <SelectItem key={type.value ?? 'null'} value={type.value ?? 'null'}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={linkStatusFilter}
            onValueChange={(v) => setLinkStatusFilter(v as typeof linkStatusFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status de vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with_product">Com produto</SelectItem>
              <SelectItem value="without_product">Sem produto</SelectItem>
              <SelectItem value="with_article">Com artigo</SelectItem>
              <SelectItem value="without_article">Sem artigo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Nome</TableHead>
                <TableHead>Produto Vinculado</TableHead>
                <TableHead>Conteúdo Vinculado</TableHead>
                <TableHead className="w-[180px]">Tipo de Vídeo</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : videos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum vídeo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                videos.map(video => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt="" 
                            className="w-16 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                            <Video className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate max-w-[200px]" title={video.title}>
                            {video.title}
                          </span>
                          {video.embed_url && (
                            <a 
                              href={video.embed_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              Assistir <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {video.product_name ? (
                        <Badge variant="secondary" className="truncate max-w-[150px]" title={video.product_name}>
                          {video.product_name}
                        </Badge>
                      ) : video.resin_name ? (
                        <Badge variant="outline" className="truncate max-w-[150px]" title={video.resin_name}>
                          {video.resin_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {video.content_title ? (
                        <Badge className="truncate max-w-[150px]" title={video.content_title}>
                          {video.content_title}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getCurrentValue(video)}
                        onValueChange={(v) => handleContentTypeChange(video.id, v)}
                      >
                        <SelectTrigger className={hasPendingChange(video.id) ? 'border-primary' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VIDEO_CONTENT_TYPES.map(type => (
                            <SelectItem key={type.value ?? 'null'} value={type.value ?? 'null'}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {hasPendingChange(video.id) && (
                        <Button
                          size="sm"
                          onClick={() => handleSave(video.id)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

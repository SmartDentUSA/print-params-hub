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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllVideos, VIDEO_CONTENT_TYPES, VideoContentType, VideoWithDetails } from '@/hooks/useAllVideos';
import { Search, ChevronLeft, ChevronRight, Video, ExternalLink, Loader2, Sparkles, FileText, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { VideoContentGeneratorModal } from './VideoContentGeneratorModal';
import { cn } from '@/lib/utils';

const CONTENT_CATEGORIES = [
  { letter: 'A', name: 'Vídeos Tutoriais' },
  { letter: 'B', name: 'Falhas, como resolver' },
  { letter: 'C', name: 'Ciência e tecnologia' },
  { letter: 'D', name: 'Casos Clínicos' },
  { letter: 'E', name: 'Ebooks e Guias' },
];

interface PendingChanges {
  contentType?: VideoContentType;
  category?: string | null;
  subcategory?: string | null;
  productId?: string | null;
}

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
    categories,
    subcategories,
    products,
    setCurrentPage,
    setSearchTerm,
    setContentTypeFilter,
    setLinkStatusFilter,
    updateVideoFields,
    refetch,
  } = useAllVideos({ pageSize: 50 });

  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChanges>>({});
  const [selectedGenerateCategory, setSelectedGenerateCategory] = useState<Record<string, string>>({});
  const [productPopoverOpen, setProductPopoverOpen] = useState<Record<string, boolean>>({});
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithDetails | null>(null);
  const [selectedCategoryLetter, setSelectedCategoryLetter] = useState('A');

  const handleContentTypeChange = (videoId: string, value: string) => {
    const newType = value === 'null' ? null : value as VideoContentType;
    setPendingChanges(prev => ({
      ...prev,
      [videoId]: { ...prev[videoId], contentType: newType },
    }));
  };

  const handleCategoryChange = (videoId: string, value: string) => {
    const newCategory = value === '_none_' ? null : value;
    setPendingChanges(prev => ({
      ...prev,
      [videoId]: { ...prev[videoId], category: newCategory },
    }));
  };

  const handleSubcategoryChange = (videoId: string, value: string) => {
    const newSubcategory = value === '_none_' ? null : value;
    setPendingChanges(prev => ({
      ...prev,
      [videoId]: { ...prev[videoId], subcategory: newSubcategory },
    }));
  };

  const handleProductChange = (videoId: string, productId: string | null) => {
    setPendingChanges(prev => ({
      ...prev,
      [videoId]: { ...prev[videoId], productId },
    }));
    setProductPopoverOpen(prev => ({ ...prev, [videoId]: false }));
  };

  const handleSave = async (videoId: string) => {
    const changes = pendingChanges[videoId];
    if (!changes) return;

    const updates: Record<string, any> = {};
    if (changes.contentType !== undefined) updates.content_type = changes.contentType;
    if (changes.category !== undefined) updates.product_category = changes.category;
    if (changes.subcategory !== undefined) updates.product_subcategory = changes.subcategory;
    if (changes.productId !== undefined) updates.product_id = changes.productId;

    const success = await updateVideoFields(videoId, updates);
    if (success) {
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[videoId];
        return next;
      });
      toast({ title: 'Alterações salvas' });
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const getCurrentContentType = (video: VideoWithDetails) => {
    const pending = pendingChanges[video.id]?.contentType;
    if (pending !== undefined) return pending === null ? 'null' : pending;
    return video.content_type === null ? 'null' : video.content_type;
  };

  const getCurrentCategory = (video: VideoWithDetails) => {
    const pending = pendingChanges[video.id]?.category;
    if (pending !== undefined) return pending || '_none_';
    return video.product_category || '_none_';
  };

  const getCurrentSubcategory = (video: VideoWithDetails) => {
    const pending = pendingChanges[video.id]?.subcategory;
    if (pending !== undefined) return pending || '_none_';
    return video.product_subcategory || '_none_';
  };

  const getCurrentProductId = (video: VideoWithDetails) => {
    const pending = pendingChanges[video.id]?.productId;
    if (pending !== undefined) return pending;
    return video.product_id;
  };

  const getCurrentProductName = (video: VideoWithDetails) => {
    const pending = pendingChanges[video.id]?.productId;
    if (pending !== undefined) {
      if (!pending) return null;
      const product = products.find(p => p.id === pending);
      return product?.name || null;
    }
    return video.product_name;
  };

  const hasPendingChange = (videoId: string) => {
    return pendingChanges[videoId] !== undefined;
  };

  const handleOpenGenerateModal = (video: VideoWithDetails) => {
    const categoryLetter = selectedGenerateCategory[video.id] || 'A';
    setSelectedVideo(video);
    setSelectedCategoryLetter(categoryLetter);
    setModalOpen(true);
  };

  const handleGenerateSuccess = async (contentId: string) => {
    await refetch();
    toast({
      title: '✅ Vídeo vinculado ao novo artigo',
      description: 'O conteúdo foi criado e vinculado automaticamente',
    });
  };

  const handleVideoTitleUpdate = async (videoId: string, newTitle: string) => {
    const success = await updateVideoFields(videoId, { title: newTitle });
    if (success) {
      toast({ title: '✅ Nome do vídeo atualizado na lista' });
    }
  };

  return (
    <>
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
                  <TableHead className="w-[250px]">Nome</TableHead>
                  <TableHead className="w-[140px]">Categoria</TableHead>
                  <TableHead className="w-[160px]">Subcategoria</TableHead>
                  <TableHead className="w-[180px]">Produto</TableHead>
                  <TableHead className="w-[150px]">Tipo de Vídeo</TableHead>
                  <TableHead className="w-[150px]">Conteúdo</TableHead>
                  <TableHead className="w-[200px]">Gerar Conteúdo</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum vídeo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  videos.map(video => (
                    <TableRow key={video.id}>
                      {/* Nome */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {video.thumbnail_url ? (
                            <img 
                              src={video.thumbnail_url} 
                              alt="" 
                              className="w-12 h-8 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                              <Video className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-xs truncate max-w-[160px]" title={video.title}>
                              {video.title}
                            </span>
                            <div className="flex items-center gap-1">
                              {video.embed_url && (
                                <a 
                                  href={video.embed_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                >
                                  Assistir <ExternalLink className="h-2 w-2" />
                                </a>
                              )}
                              {video.has_transcript && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  <FileText className="h-2 w-2 mr-0.5" />
                                  Trans.
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Categoria */}
                      <TableCell>
                        <Select
                          value={getCurrentCategory(video)}
                          onValueChange={(v) => handleCategoryChange(video.id, v)}
                        >
                          <SelectTrigger className={cn(
                            "h-8 text-xs",
                            pendingChanges[video.id]?.category !== undefined && "border-primary"
                          )}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">— Nenhuma</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Subcategoria */}
                      <TableCell>
                        <Select
                          value={getCurrentSubcategory(video)}
                          onValueChange={(v) => handleSubcategoryChange(video.id, v)}
                        >
                          <SelectTrigger className={cn(
                            "h-8 text-xs",
                            pendingChanges[video.id]?.subcategory !== undefined && "border-primary"
                          )}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">— Nenhuma</SelectItem>
                            {subcategories.map(sub => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Produto (Combobox with search) */}
                      <TableCell>
                        <Popover
                          open={productPopoverOpen[video.id] || false}
                          onOpenChange={(open) => setProductPopoverOpen(prev => ({ ...prev, [video.id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "h-8 w-full justify-between text-xs px-2",
                                pendingChanges[video.id]?.productId !== undefined && "border-primary"
                              )}
                            >
                              <span className="truncate">
                                {getCurrentProductName(video) || "— Nenhum"}
                              </span>
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar produto..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                                <CommandItem
                                  value="_none_"
                                  onSelect={() => handleProductChange(video.id, null)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      !getCurrentProductId(video) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  — Nenhum
                                </CommandItem>
                                {products.map(product => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => handleProductChange(video.id, product.id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        getCurrentProductId(video) === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate">{product.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      {/* Tipo de Vídeo */}
                      <TableCell>
                        <Select
                          value={getCurrentContentType(video)}
                          onValueChange={(v) => handleContentTypeChange(video.id, v)}
                        >
                          <SelectTrigger className={cn(
                            "h-8 text-xs",
                            pendingChanges[video.id]?.contentType !== undefined && "border-primary"
                          )}>
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

                      {/* Conteúdo Vinculado */}
                      <TableCell>
                        {video.content_title ? (
                          <Badge variant="default" className="text-[10px] truncate max-w-[130px]" title={video.content_title}>
                            {video.content_title}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Gerar Conteúdo */}
                      <TableCell>
                        {!video.content_id ? (
                          <div className="flex items-center gap-1">
                            <Select
                              value={selectedGenerateCategory[video.id] || 'A'}
                              onValueChange={(v) => setSelectedGenerateCategory(prev => ({ ...prev, [video.id]: v }))}
                            >
                              <SelectTrigger className="h-8 text-xs w-[90px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTENT_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.letter} value={cat.letter}>
                                    {cat.letter} • {cat.name.substring(0, 12)}...
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => handleOpenGenerateModal(video)}
                            >
                              <Sparkles className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Vinculado</span>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell>
                        {hasPendingChange(video.id) && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSave(video.id)}
                            disabled={saving}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
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

      {/* Generate Content Modal */}
      <VideoContentGeneratorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        video={selectedVideo}
        selectedCategoryLetter={selectedCategoryLetter}
        onSuccess={handleGenerateSuccess}
        onVideoTitleUpdate={handleVideoTitleUpdate}
      />
    </>
  );
}

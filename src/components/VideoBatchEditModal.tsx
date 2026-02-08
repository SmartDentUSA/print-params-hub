import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Sparkles,
  Check,
  ChevronsUpDown,
  Save,
  Pause,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  SkipForward,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { VideoWithDetails, VideoContentType, ProductOption } from '@/hooks/useAllVideos';
import { VIDEO_CONTENT_TYPES } from '@/hooks/useAllVideos';

const CONTENT_CATEGORIES = [
  { id: '45243aad-7143-4bc8-a649-05f741992e07', letter: 'A', name: 'Vídeos Tutoriais' },
  { id: '83d0b6ea-59d7-4d98-80a1-ac7df83b697a', letter: 'B', name: 'Falhas, como resolver' },
  { id: 'fc493982-ad8c-417f-9579-82786a97925a', letter: 'C', name: 'Ciência e tecnologia' },
  { id: '67b81704-64f8-4739-b79f-24f46f70752c', letter: 'D', name: 'Casos Clínicos' },
  { id: 'ff524477-c553-4518-868e-8435e16a5c57', letter: 'E', name: 'Ebooks e Guias' },
];

type GenerationStatus = 'waiting' | 'processing' | 'success' | 'error' | 'skipped';

interface GenerationLog {
  videoId: string;
  videoTitle: string;
  status: GenerationStatus;
  generatedTitle?: string;
  error?: string;
}

interface VideoBatchEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVideos: VideoWithDetails[];
  categories: string[];
  subcategories: string[];
  products: ProductOption[];
  onBatchUpdate: (videoIds: string[], updates: Record<string, any>) => Promise<{ success: number; failed: number }>;
  onRefetch: () => void;
}

export function VideoBatchEditModal({
  open,
  onOpenChange,
  selectedVideos,
  categories,
  subcategories,
  products,
  onBatchUpdate,
  onRefetch,
}: VideoBatchEditModalProps) {
  // Metadata fields
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [contentType, setContentType] = useState<string>('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  // Content generation
  const [contentCategory, setContentCategory] = useState<string>('');
  const [isApplyingMetadata, setIsApplyingMetadata] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  // Progress
  const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const selectedProductName = productId ? products.find(p => p.id === productId)?.name : null;

  const handleApplyMetadata = async () => {
    const updates: Record<string, any> = {};
    if (category) updates.product_category = category === '_none_' ? null : category;
    if (subcategory) updates.product_subcategory = subcategory === '_none_' ? null : subcategory;
    if (productId) updates.product_id = productId === '_none_' ? null : productId;
    if (contentType) updates.content_type = contentType === 'null' ? null : contentType;

    if (Object.keys(updates).length === 0) {
      toast({ title: 'Selecione pelo menos um campo para aplicar', variant: 'destructive' });
      return;
    }

    setIsApplyingMetadata(true);
    const videoIds = selectedVideos.map(v => v.id);
    const result = await onBatchUpdate(videoIds, updates);

    toast({
      title: `✅ Metadados aplicados em ${result.success} vídeos`,
      description: result.failed > 0 ? `${result.failed} falharam` : undefined,
    });
    setIsApplyingMetadata(false);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 80);
  };

  const getCategoryContentType = (letter: string) => {
    const mapping: Record<string, string> = {
      'A': 'passo_a_passo',
      'B': 'tecnico',
      'C': 'educacional',
      'D': 'cases_sucesso',
      'E': 'educacional',
    };
    return mapping[letter] || null;
  };

  const handleGenerateContent = async () => {
    const selectedCat = CONTENT_CATEGORIES.find(c => c.letter === contentCategory);
    if (!selectedCat) return;

    const videosToProcess = selectedVideos.filter(v => !v.content_id);
    const skipped = selectedVideos.filter(v => v.content_id);

    // Initialize logs
    const initialLogs: GenerationLog[] = [
      ...skipped.map(v => ({
        videoId: v.id,
        videoTitle: v.title,
        status: 'skipped' as GenerationStatus,
      })),
      ...videosToProcess.map(v => ({
        videoId: v.id,
        videoTitle: v.title,
        status: 'waiting' as GenerationStatus,
      })),
    ];

    setGenerationLogs(initialLogs);
    setProcessedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setSkippedCount(skipped.length);
    setIsGenerating(true);
    setIsPaused(false);
    pauseRef.current = false;
    cancelRef.current = false;

    let successTotal = 0;
    let errorTotal = 0;

    for (let i = 0; i < videosToProcess.length; i++) {
      // Check cancel
      if (cancelRef.current) break;

      // Wait while paused
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const video = videosToProcess[i];

      // Update status to processing
      setGenerationLogs(prev => prev.map(l =>
        l.videoId === video.id ? { ...l, status: 'processing' } : l
      ));

      try {
        // Step 1: Generate title + excerpt via AI
        const contextParts = [
          video.video_transcript?.substring(0, 3000) || null,
          `Título original do vídeo: ${video.title}`,
          video.product_name ? `Produto relacionado: ${video.product_name}` : null,
          video.product_category ? `Categoria: ${video.product_category}` : null,
        ].filter(Boolean).join('\n\n');

        const metadataRes = await fetch(
          `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/ai-metadata-generator`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk`,
            },
            body: JSON.stringify({
              contentHTML: contextParts,
              title: video.title,
              regenerate: { title: true, excerpt: true },
            }),
          }
        );

        if (!metadataRes.ok) throw new Error(`Metadata HTTP ${metadataRes.status}`);
        const metadata = await metadataRes.json();
        const generatedTitle = metadata.title || video.title;
        const generatedExcerpt = metadata.excerpt || `Conteúdo sobre ${generatedTitle}`;

        // Step 2: Generate HTML via AI orchestrator
        const hasTranscript = video.has_transcript && video.video_transcript;
        const orchestratorPayload = {
          title: generatedTitle,
          excerpt: generatedExcerpt,
          contentType: video.content_type || getCategoryContentType(selectedCat.letter),
          activeSources: {
            rawText: !hasTranscript,
            pdfTranscription: false,
            videoTranscription: !!hasTranscript,
            relatedPdfs: false,
          },
          selectedResinIds: [],
          selectedProductIds: video.product_id ? [video.product_id] : [],
          sources: {
            rawText: !hasTranscript ? `Título: ${generatedTitle}\nResumo: ${generatedExcerpt}` : null,
            pdfTranscription: null,
            videoTranscription: hasTranscript ? video.video_transcript : null,
            relatedPdfs: [],
          },
          aiPrompt: '',
        };

        const contentRes = await fetch(
          `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/ai-orchestrate-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk`,
            },
            body: JSON.stringify(orchestratorPayload),
          }
        );

        if (!contentRes.ok) throw new Error(`Content HTTP ${contentRes.status}`);
        const contentData = await contentRes.json();
        if (!contentData?.html) throw new Error('Nenhum HTML gerado');

        // Step 3: Save article to knowledge_contents
        const { data: maxOrderData } = await supabase
          .from('knowledge_contents')
          .select('order_index')
          .eq('category_id', selectedCat.id)
          .order('order_index', { ascending: false })
          .limit(1);

        const nextOrder = ((maxOrderData?.[0]?.order_index || 0) + 1);
        const slug = generateSlug(generatedTitle);

        const { data: newContent, error: insertErr } = await supabase
          .from('knowledge_contents')
          .insert({
            title: generatedTitle,
            slug,
            excerpt: generatedExcerpt,
            content_html: contentData.html,
            category_id: selectedCat.id,
            order_index: nextOrder,
            active: true,
            recommended_products: video.product_id ? [video.product_id] : [],
            content_image_url: video.thumbnail_url || null,
            og_image_url: video.thumbnail_url || null,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;

        // Step 4: Link video to content
        await supabase
          .from('knowledge_videos')
          .update({
            content_id: newContent.id,
            content_type: video.content_type || getCategoryContentType(selectedCat.letter),
          })
          .eq('id', video.id);

        successTotal++;
        setSuccessCount(s => s + 1);
        setGenerationLogs(prev => prev.map(l =>
          l.videoId === video.id
            ? { ...l, status: 'success', generatedTitle }
            : l
        ));
      } catch (err: any) {
        errorTotal++;
        setErrorCount(e => e + 1);
        setGenerationLogs(prev => prev.map(l =>
          l.videoId === video.id
            ? { ...l, status: 'error', error: err.message }
            : l
        ));
      }

      setProcessedCount(i + 1);

      // Rate limit: 2s delay between requests
      if (i < videosToProcess.length - 1 && !cancelRef.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsGenerating(false);
    onRefetch();
    toast({
      title: `Geração concluída`,
      description: `✅ ${successTotal} sucesso, ❌ ${errorTotal} erros, ⏭ ${skipped.length} ignorados`,
    });
  };

  const handlePauseToggle = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
  };

  const handleCancel = () => {
    cancelRef.current = true;
    pauseRef.current = false;
  };

  const totalToProcess = selectedVideos.filter(v => !v.content_id).length;
  const progressPercent = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;

  const getStatusIcon = (status: GenerationStatus) => {
    switch (status) {
      case 'waiting': return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'processing': return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'success': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'error': return <XCircle className="h-3 w-3 text-destructive" />;
      case 'skipped': return <SkipForward className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isGenerating) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Edição em Lote — {selectedVideos.length} vídeos
          </DialogTitle>
          <DialogDescription>
            Aplique metadados e gere conteúdo para os vídeos selecionados
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-2">
            {/* Section 1: Metadata */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Save className="h-4 w-4" />
                Metadados
              </h3>
              <p className="text-xs text-muted-foreground">
                Apenas os campos preenchidos serão aplicados. Campos vazios não sobrescrevem dados existentes.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Categoria */}
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="— Não alterar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">— Remover</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategoria */}
                <div className="space-y-1">
                  <Label className="text-xs">Subcategoria</Label>
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="— Não alterar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">— Remover</SelectItem>
                      {subcategories.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Produto */}
                <div className="space-y-1">
                  <Label className="text-xs">Produto</Label>
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 w-full justify-between text-xs px-2"
                      >
                        <span className="truncate">
                          {productId === '_none_' ? '— Remover' : selectedProductName || '— Não alterar'}
                        </span>
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar produto..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                          <CommandItem value="_none_" onSelect={() => { setProductId('_none_'); setProductPopoverOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", productId === '_none_' ? "opacity-100" : "opacity-0")} />
                            — Remover
                          </CommandItem>
                          {products.map(product => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => { setProductId(product.id); setProductPopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", productId === product.id ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{product.name}</span>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Tipo de Vídeo */}
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Vídeo</Label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="— Não alterar" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_CONTENT_TYPES.map(type => (
                        <SelectItem key={type.value ?? 'null'} value={type.value ?? 'null'}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleApplyMetadata}
                disabled={isApplyingMetadata || isGenerating}
                className="w-full gap-2"
                variant="outline"
              >
                {isApplyingMetadata ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando...</>
                ) : (
                  <><Save className="h-4 w-4" /> Aplicar Metadados em {selectedVideos.length} vídeos</>
                )}
              </Button>
            </div>

            <Separator />

            {/* Section 2: Content Generation */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Geração de Conteúdo
              </h3>

              <div className="space-y-2">
                <Label className="text-xs">Categoria de Conteúdo (para o artigo)</Label>
                <Select value={contentCategory} onValueChange={setContentCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione para habilitar geração" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.letter} value={cat.letter}>
                        {cat.letter} • {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {contentCategory && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {totalToProcess} vídeos sem artigo serão processados. {selectedVideos.length - totalToProcess} já possuem artigo (serão ignorados).
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateContent}
                  disabled={!contentCategory || isGenerating || totalToProcess === 0}
                  className="flex-1 gap-2"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Gerar Conteúdo ({totalToProcess})</>
                  )}
                </Button>

                {isGenerating && (
                  <>
                    <Button variant="outline" size="icon" onClick={handlePauseToggle}>
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleCancel}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Progress */}
              {generationLogs.length > 0 && (
                <div className="space-y-3">
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex gap-3 text-xs">
                    <span>Total: {totalToProcess}</span>
                    <span className="text-green-600">✅ {successCount}</span>
                    <span className="text-destructive">❌ {errorCount}</span>
                    <span className="text-muted-foreground">⏭ {skippedCount}</span>
                    {isPaused && <Badge variant="outline" className="text-[10px]">Pausado</Badge>}
                  </div>

                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-1">
                      {generationLogs.map(log => (
                        <div
                          key={log.videoId}
                          className={cn(
                            "flex items-center gap-2 text-xs py-1 px-2 rounded",
                            log.status === 'processing' && "bg-primary/5",
                            log.status === 'error' && "bg-destructive/5",
                            log.status === 'success' && "bg-green-50",
                          )}
                        >
                          {getStatusIcon(log.status)}
                          <span className="truncate flex-1" title={log.videoTitle}>
                            {log.videoTitle}
                          </span>
                          {log.generatedTitle && (
                            <span className="text-green-600 truncate max-w-[150px]" title={log.generatedTitle}>
                              → {log.generatedTitle}
                            </span>
                          )}
                          {log.error && (
                            <span className="text-destructive truncate max-w-[150px]" title={log.error}>
                              {log.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

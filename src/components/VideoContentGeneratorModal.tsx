import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, Video, FileText, Package, AlertCircle, Wand2, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { VideoWithDetails } from '@/hooks/useAllVideos';

interface ContentCategory {
  id: string;
  letter: string;
  name: string;
}

interface VideoContentGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: VideoWithDetails | null;
  selectedCategoryLetter: string;
  onSuccess: (contentId: string) => void;
  onVideoTitleUpdate?: (videoId: string, newTitle: string) => Promise<void>;
}

const CONTENT_CATEGORIES: ContentCategory[] = [
  { id: '45243aad-7143-4bc8-a649-05f741992e07', letter: 'A', name: 'Vídeos Tutoriais' },
  { id: '83d0b6ea-59d7-4d98-80a1-ac7df83b697a', letter: 'B', name: 'Falhas, como resolver' },
  { id: 'fc493982-ad8c-417f-9579-82786a97925a', letter: 'C', name: 'Ciência e tecnologia' },
  { id: '67b81704-64f8-4739-b79f-24f46f70752c', letter: 'D', name: 'Casos Clínicos' },
  { id: 'ff524477-c553-4518-868e-8435e16a5c57', letter: 'E', name: 'Ebooks e Guias' },
];

export function VideoContentGeneratorModal({
  open,
  onOpenChange,
  video,
  selectedCategoryLetter,
  onSuccess,
  onVideoTitleUpdate,
}: VideoContentGeneratorModalProps) {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [useTranscript, setUseTranscript] = useState(true);
  const [updateVideoTitle, setUpdateVideoTitle] = useState(true);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'preview' | 'saving'>('form');
  const [forceTestimonialMode, setForceTestimonialMode] = useState(false);

  // Modo depoimento: ativado automaticamente OU manualmente
  const isTestimonialMode = video?.content_type === 'depoimentos' || forceTestimonialMode;

  const selectedCategory = CONTENT_CATEGORIES.find(c => c.letter === selectedCategoryLetter);

  // Reset form when video changes
  useEffect(() => {
    if (video && open) {
      // Generate suggested title from video name
      const suggestedTitle = video.title
        .replace(/\s*-\s*BLZ\s*Dental.*$/i, '')
        .replace(/\s*\|\s*.*$/i, '')
        .trim();
      setTitle(suggestedTitle);
      setExcerpt('');
      setGeneratedHTML(null);
      setStep('form');
      setUseTranscript(video.has_transcript);
      setUpdateVideoTitle(true);
      setIsGeneratingMetadata(false);
      setForceTestimonialMode(false);
    }
  }, [video, open]);

  // Generate title and excerpt using AI
  const handleGenerateMetadata = async () => {
    if (!video) return;

    setIsGeneratingMetadata(true);
    try {
      // Build context for AI from video info
      const contextParts = [
        video.video_transcript 
          ? video.video_transcript.substring(0, 3000) 
          : null,
        `Título original do vídeo: ${video.title}`,
        video.product_name ? `Produto relacionado: ${video.product_name}` : null,
        video.product_category ? `Categoria: ${video.product_category}` : null,
        video.product_subcategory ? `Subcategoria: ${video.product_subcategory}` : null,
      ].filter(Boolean).join('\n\n');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-metadata-generator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            contentHTML: contextParts,
            title: video.title,
            regenerate: { title: true, excerpt: true },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.title) {
        setTitle(data.title);
      }
      if (data.excerpt) {
        setExcerpt(data.excerpt);
      }

      // Update video title in the list if checkbox is checked
      if (updateVideoTitle && data.title && onVideoTitleUpdate) {
        await onVideoTitleUpdate(video.id, data.title);
      }

      toast({
        title: '✅ Título e resumo gerados!',
        description: updateVideoTitle ? 'Nome do vídeo também atualizado na lista' : undefined,
      });
    } catch (error: any) {
      console.error('❌ Erro ao gerar metadados:', error);
      toast({
        title: 'Erro ao gerar título/resumo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingMetadata(false);
    }
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

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({ title: 'Digite um título', variant: 'destructive' });
      return;
    }

    if (!video) return;

    setIsGenerating(true);

    try {
      // Build context for generation
      const hasValidTranscript = useTranscript && video.has_transcript && video.video_transcript;
      
      // If no transcript, use title/excerpt/product info as rawText
      let rawTextContent: string | null = null;
      if (!hasValidTranscript) {
        const parts = [
          `Título do vídeo: ${video.title}`,
          excerpt.trim() ? `Resumo: ${excerpt.trim()}` : null,
          video.product_name ? `Produto relacionado: ${video.product_name}` : null,
          video.product_category ? `Categoria: ${video.product_category}` : null,
          video.product_subcategory ? `Subcategoria: ${video.product_subcategory}` : null,
        ].filter(Boolean);
        rawTextContent = parts.join('\n');
      }

      const orchestratorPayload = {
        title: title.trim(),
        excerpt: excerpt.trim() || `Conteúdo sobre ${title.trim()}`,
        // Usa modo depoimento se ativado (automático ou manual)
        contentType: isTestimonialMode ? 'depoimentos' : (video.content_type || undefined),
        activeSources: {
          rawText: !hasValidTranscript && !!rawTextContent,
          pdfTranscription: false,
          videoTranscription: !!hasValidTranscript,
          relatedPdfs: false,
        },
        selectedResinIds: [],
        selectedProductIds: video.product_id ? [video.product_id] : [],
        sources: {
          rawText: rawTextContent,
          pdfTranscription: null,
          videoTranscription: hasValidTranscript ? video.video_transcript : null,
          relatedPdfs: [],
        },
        aiPrompt: '',
      };

      console.log('📤 Gerando conteúdo para vídeo:', {
        videoTitle: video.title,
        category: selectedCategory?.name,
        hasTranscript: video.has_transcript,
        usingTranscript: useTranscript && video.has_transcript,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-orchestrate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(orchestratorPayload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data?.html) {
        throw new Error('Nenhum HTML foi gerado pela IA');
      }

      setGeneratedHTML(data.html);
      setStep('preview');

      toast({
        title: '✅ Conteúdo gerado!',
        description: 'Revise e clique em "Salvar Artigo"',
      });
    } catch (error: any) {
      console.error('❌ Erro ao gerar conteúdo:', error);
      toast({
        title: 'Erro ao gerar conteúdo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedHTML || !video || !selectedCategory) return;

    setStep('saving');

    try {
      // Get max order_index for the category
      const { data: maxOrderData } = await supabase
        .from('knowledge_contents')
        .select('order_index')
        .eq('category_id', selectedCategory.id)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrderIndex = ((maxOrderData?.[0]?.order_index || 0) + 1);

      // Create the content
      const slug = generateSlug(title);
      const { data: newContent, error: insertError } = await supabase
        .from('knowledge_contents')
        .insert({
          title: title.trim(),
          slug,
          excerpt: excerpt.trim() || `Conteúdo sobre ${title.trim()}`,
          content_html: generatedHTML,
          category_id: selectedCategory.id,
          order_index: nextOrderIndex,
          active: true,
          recommended_products: video.product_id ? [video.product_id] : [],
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link the video to the content
      const { error: linkError } = await supabase
        .from('knowledge_videos')
        .update({ 
          content_id: newContent.id,
          // Also set content_type based on category if not set
          content_type: video.content_type || getCategoryContentType(selectedCategory.letter),
        })
        .eq('id', video.id);

      if (linkError) throw linkError;

      toast({
        title: '✅ Artigo criado com sucesso!',
        description: `"${title}" foi criado na categoria ${selectedCategory.letter} • ${selectedCategory.name}`,
      });

      onSuccess(newContent.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('❌ Erro ao salvar artigo:', error);
      toast({
        title: 'Erro ao salvar artigo',
        description: error.message,
        variant: 'destructive',
      });
      setStep('preview');
    }
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

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Conteúdo a partir de Vídeo
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'form' && (
            <div className="space-y-6 py-4">
              {/* Video Info */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="w-32 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-32 h-20 bg-muted rounded flex items-center justify-center">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{video.title}</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {video.product_category && (
                      <Badge variant="secondary">{video.product_category}</Badge>
                    )}
                    {video.product_subcategory && (
                      <Badge variant="outline">{video.product_subcategory}</Badge>
                    )}
                    {video.product_name && (
                      <Badge className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {video.product_name}
                      </Badge>
                    )}
                  </div>
                  {video.has_transcript && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Transcrição disponível ({video.video_transcript?.length.toLocaleString()} caracteres)
                    </p>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <Label>Categoria do Artigo</Label>
                <div className="mt-2 p-3 border rounded-lg bg-primary/5">
                  <span className="font-semibold text-primary">
                    {selectedCategory?.letter} • {selectedCategory?.name}
                  </span>
                </div>
              </div>

              {/* Modo Depoimento - Toggle Manual */}
              <div className={`flex items-center justify-between p-3 border rounded-lg ${isTestimonialMode ? 'bg-amber-50 border-amber-200' : 'bg-muted/30'}`}>
                <div className="flex items-center gap-2">
                  <MessageCircle className={`h-4 w-4 ${isTestimonialMode ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <div>
                    <span className={`text-sm font-medium ${isTestimonialMode ? 'text-amber-700' : ''}`}>
                      Modo Depoimento (Falácia Verdadeira)
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Gera conteúdo com técnica de concordância progressiva
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isTestimonialMode}
                  onCheckedChange={(checked) => {
                    // Se o vídeo já é depoimento, não pode desativar
                    if (video?.content_type === 'depoimentos') return;
                    setForceTestimonialMode(checked);
                  }}
                  disabled={video?.content_type === 'depoimentos'}
                />
              </div>
              {video?.content_type === 'depoimentos' && (
                <p className="text-xs text-amber-600 -mt-4 ml-6">
                  ✓ Ativado automaticamente (vídeo classificado como depoimento)
                </p>
              )}

              {/* Title */}
              <div>
                <Label htmlFor="title">Título do Artigo *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Como calibrar sua impressora 3D"
                  className="mt-1"
                />
              </div>

              {/* Excerpt */}
              <div>
                <Label htmlFor="excerpt">Resumo (opcional)</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Breve descrição do conteúdo..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* AI Generate Metadata Button */}
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGenerateMetadata}
                  disabled={isGeneratingMetadata}
                >
                  {isGeneratingMetadata ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando com IA...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      ✨ Gerar Título + Resumo com IA
                    </>
                  )}
                </Button>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateVideoTitle"
                    checked={updateVideoTitle}
                    onCheckedChange={(checked) => setUpdateVideoTitle(checked === true)}
                  />
                  <label
                    htmlFor="updateVideoTitle"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Também atualizar o nome do vídeo na lista
                  </label>
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-3">
                <Label>Fontes para Geração</Label>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <span>Usar transcrição do vídeo</span>
                  </div>
                  <Switch
                    checked={useTranscript}
                    onCheckedChange={setUseTranscript}
                    disabled={!video.has_transcript}
                  />
                </div>

                {!video.has_transcript && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span>Este vídeo não possui transcrição. O conteúdo será gerado com base no título e produto vinculado.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'preview' && generatedHTML && (
            <div className="py-4">
              <Label className="mb-2 block">Preview do Conteúdo Gerado</Label>
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: generatedHTML }}
                />
              </ScrollArea>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Salvando artigo...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || !title.trim()}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar com IA
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Voltar
              </Button>
              <Button onClick={handleSave}>
                Salvar Artigo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

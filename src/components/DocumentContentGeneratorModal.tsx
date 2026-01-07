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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Loader2, 
  Sparkles, 
  FileText, 
  Package, 
  Wand2, 
  ChevronDown,
  ExternalLink,
  Globe,
  BookOpen,
  Image,
  RefreshCw,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { DocumentWithDetails } from '@/hooks/useAllDocuments';

interface ContentCategory {
  id: string;
  letter: string;
  name: string;
}

interface DocumentContentGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentWithDetails | null;
  onSuccess: (contentId: string) => void;
}

const CONTENT_CATEGORIES: ContentCategory[] = [
  { id: '45243aad-7143-4bc8-a649-05f741992e07', letter: 'A', name: 'Vídeos Tutoriais' },
  { id: '83d0b6ea-59d7-4d98-80a1-ac7df83b697a', letter: 'B', name: 'Falhas, como resolver' },
  { id: 'fc493982-ad8c-417f-9579-82786a97925a', letter: 'C', name: 'Ciência e tecnologia' },
  { id: '67b81704-64f8-4739-b79f-24f46f70752c', letter: 'D', name: 'Casos Clínicos' },
  { id: 'ff524477-c553-4518-868e-8435e16a5c57', letter: 'E', name: 'Ebooks e Guias' },
];

// Mapeamento de tipos de documento para perfis de publicação
const DOCUMENT_TYPE_MAPPING: Record<string, {
  profile: string;
  profileEmoji: string;
  suggestedCategoryLetter: string;
  description: string;
}> = {
  'perfil_tecnico': {
    profile: 'Artigo Científico',
    profileEmoji: '🔬',
    suggestedCategoryLetter: 'C',
    description: 'Tom acadêmico, rigor técnico, autoridade científica'
  },
  'fds': {
    profile: 'Guia de Segurança',
    profileEmoji: '🛡️',
    suggestedCategoryLetter: 'E',
    description: 'Educativo, preventivo, sem alarmar'
  },
  'ifu': {
    profile: 'Tutorial Prático',
    profileEmoji: '🧠',
    suggestedCategoryLetter: 'A',
    description: 'Passo-a-passo, didático, aplicável'
  },
  'laudo': {
    profile: 'Laudo Interpretado',
    profileEmoji: '🧪',
    suggestedCategoryLetter: 'C',
    description: 'Fidelidade ao laudo, explicação técnica'
  },
  'catalogo': {
    profile: 'Comparativo Técnico',
    profileEmoji: '📊',
    suggestedCategoryLetter: 'C',
    description: 'Neutro, baseado em critérios técnicos'
  },
  'guia': {
    profile: 'Guia Prático',
    profileEmoji: '📘',
    suggestedCategoryLetter: 'E',
    description: 'Educativo, claro, orientativo'
  },
  'certificado': {
    profile: 'Certificação Interpretada',
    profileEmoji: '🧾',
    suggestedCategoryLetter: 'C',
    description: 'Explicativo, sem promoção, autoridade'
  },
};

export function DocumentContentGeneratorModal({
  open,
  onOpenChange,
  document,
  onSuccess,
}: DocumentContentGeneratorModalProps) {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [selectedCategoryLetter, setSelectedCategoryLetter] = useState('C');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [generatedFAQs, setGeneratedFAQs] = useState<Array<{ question: string; answer: string }> | null>(null);
  const [step, setStep] = useState<'form' | 'preview' | 'saving'>('form');
  const [showExtractedText, setShowExtractedText] = useState(false);
  
  // OG Image Generation states
  const [isGeneratingOG, setIsGeneratingOG] = useState(false);
  const [generatedOGImage, setGeneratedOGImage] = useState<string | null>(null);
  const [generatedOGAlt, setGeneratedOGAlt] = useState<string | null>(null);

  const selectedCategory = CONTENT_CATEGORIES.find(c => c.letter === selectedCategoryLetter);
  const documentTypeInfo = document?.document_type ? DOCUMENT_TYPE_MAPPING[document.document_type] : null;

  // Reset form when document changes
  useEffect(() => {
    if (document && open) {
      // Generate suggested title from document name
      const suggestedTitle = document.document_name
        .replace(/\.(pdf|PDF)$/i, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .trim();
      setTitle(suggestedTitle);
      setExcerpt('');
      setGeneratedHTML(null);
      setGeneratedFAQs(null);
      setStep('form');
      setShowExtractedText(false);
      setGeneratedOGImage(null);
      setGeneratedOGAlt(null);
      
      // Auto-select category based on document type
      if (documentTypeInfo) {
        setSelectedCategoryLetter(documentTypeInfo.suggestedCategoryLetter);
      }
    }
  }, [document, open, documentTypeInfo]);

  // Generate title and excerpt using AI
  const handleGenerateMetadata = async () => {
    if (!document || !document.extracted_text) {
      toast({
        title: 'Texto não disponível',
        description: 'Este documento ainda não foi extraído',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingMetadata(true);
    try {
      // Build context for AI from document info
      const contextParts = [
        document.extracted_text.substring(0, 4000),
        `Nome do documento: ${document.document_name}`,
        document.linked_name ? `Produto/Resina: ${document.linked_name}` : null,
        document.document_type ? `Tipo de documento: ${document.document_type}` : null,
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
            title: document.document_name,
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

      toast({
        title: '✅ Título e resumo gerados!',
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

  // Generate OG Image using AI (with real product image when available)
  const handleGenerateOGImage = async () => {
    if (!document) return;

    setIsGeneratingOG(true);
    try {
      // Buscar imagem do produto vinculado do catálogo (via linked_id)
      let productImageUrl: string | null = null;
      
      if (document.source_type === 'catalog' && document.linked_id) {
        const { data: catalogProduct } = await supabase
          .from('system_a_catalog')
          .select('image_url')
          .eq('id', document.linked_id)
          .single();
        
        productImageUrl = catalogProduct?.image_url || null;
        
        if (productImageUrl) {
          console.log('🖼️ Usando imagem real do produto:', document.linked_name);
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-og-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title: title || document.document_name,
            productName: document.linked_name || null,
            documentType: document.document_type || null,
            category: selectedCategory?.name || null,
            extractedTextPreview: document.extracted_text?.substring(0, 500) || null,
            productImageUrl, // Imagem real do produto para edição
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.og_image_url) {
        setGeneratedOGImage(data.og_image_url);
        setGeneratedOGAlt(data.og_image_alt || null);
        toast({
          title: data.mode === 'edit' ? '✅ Imagem editada com produto real!' : '✅ Imagem OG gerada!',
          description: data.mode === 'edit' 
            ? `${document.linked_name} em ambiente profissional`
            : 'Otimizada para LinkedIn, WhatsApp e Google Discover',
        });
      } else {
        throw new Error(data.error || 'Nenhuma imagem foi gerada');
      }
    } catch (error: any) {
      console.error('❌ Erro ao gerar OG Image:', error);
      toast({
        title: 'Erro ao gerar imagem OG',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingOG(false);
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

    if (!document || !document.extracted_text) {
      toast({ 
        title: 'Documento sem texto extraído', 
        description: 'Primeiro extraia o texto do PDF',
        variant: 'destructive' 
      });
      return;
    }

    setIsGenerating(true);

    try {
      const orchestratorPayload = {
        title: title.trim(),
        excerpt: excerpt.trim() || `Conteúdo sobre ${title.trim()}`,
        documentType: document.document_type || undefined,
        activeSources: {
          rawText: false,
          pdfTranscription: true,
          videoTranscription: false,
          relatedPdfs: false,
        },
        selectedResinIds: document.source_type === 'resin' ? [document.linked_id] : [],
        selectedProductIds: document.source_type === 'catalog' ? [document.linked_id] : [],
        sources: {
          rawText: null,
          pdfTranscription: document.extracted_text,
          videoTranscription: null,
          relatedPdfs: [],
        },
        aiPrompt: '',
      };

      console.log('📤 Gerando publicação a partir de documento:', {
        documentName: document.document_name,
        documentType: document.document_type,
        category: selectedCategory?.name,
        extractedTextLength: document.extracted_text.length,
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
      
      // Capturar FAQs geradas pela IA
      if (data.faqs && Array.isArray(data.faqs)) {
        setGeneratedFAQs(data.faqs);
        console.log(`✅ ${data.faqs.length} FAQs geradas`);
      }
      
      setStep('preview');

      toast({
        title: '✅ Conteúdo gerado!',
        description: `Revise e clique em "Salvar Publicação"${data.faqs?.length ? ` • ${data.faqs.length} FAQs` : ''}`,
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
    if (!generatedHTML || !document || !selectedCategory) return;

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
      
      // Determine recommended products/resins based on source type
      const recommendedProducts = document.source_type === 'catalog' ? [document.linked_id] : [];
      const recommendedResins = document.source_type === 'resin' ? [document.linked_id] : [];

      // Vincular o PDF fonte automaticamente (Princípio-Mãe: PDF é fonte da verdade)
      const sourcePdfId = document.id;

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
          recommended_products: recommendedProducts,
          recommended_resins: recommendedResins,
          selected_pdf_ids_pt: [sourcePdfId], // PDF fonte vinculado automaticamente
          faqs: generatedFAQs || [], // FAQs geradas automaticamente
          og_image_url: generatedOGImage, // OG Image gerada por IA
          og_image_alt: generatedOGAlt, // Alt-text SEO otimizado
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      toast({
        title: '✅ Publicação criada com sucesso!',
        description: `"${title}" criada em ${selectedCategory.letter} com ${generatedFAQs?.length || 0} FAQs`,
      });

      onSuccess(newContent.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('❌ Erro ao salvar publicação:', error);
      toast({
        title: 'Erro ao salvar publicação',
        description: error.message,
        variant: 'destructive',
      });
      setStep('preview');
    }
  };

  const getLanguageFlag = (lang: string | null) => {
    switch (lang) {
      case 'pt': return '🇧🇷';
      case 'en': return '🇺🇸';
      case 'es': return '🇪🇸';
      default: return '🌐';
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Gerar Publicação a partir de Documento
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'form' && (
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-6 py-4 pr-4">
                {/* Document Info */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{document.document_name}</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {document.source_type && (
                          <Badge variant="secondary" className={document.source_type === 'resin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                            {document.source_type === 'resin' ? 'Resina' : 'Catálogo'}
                          </Badge>
                        )}
                        {document.language && (
                          <Badge variant="outline">
                            {getLanguageFlag(document.language)} {document.language.toUpperCase()}
                          </Badge>
                        )}
                        {document.extraction_status === 'completed' && (
                          <Badge variant="default" className="bg-green-600">
                            ✅ Extraído
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {document.linked_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>Vinculado a: <strong>{document.linked_name}</strong></span>
                    </div>
                  )}

                  {document.file_url && (
                    <a 
                      href={document.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir PDF original
                    </a>
                  )}

                  {document.extracted_text && (
                    <p className="text-xs text-muted-foreground">
                      📝 {document.extracted_text.length.toLocaleString()} caracteres extraídos
                    </p>
                  )}
                </div>

                {/* Publication Profile (based on document type) */}
                {documentTypeInfo && (
                  <div className="p-3 border rounded-lg bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{documentTypeInfo.profileEmoji}</span>
                      <div>
                        <span className="font-medium text-primary">
                          {documentTypeInfo.profile}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {documentTypeInfo.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!document.document_type && (
                  <div className="p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">
                        Tipo de documento não definido - será usado prompt genérico
                      </span>
                    </div>
                  </div>
                )}

                {/* Category Selector */}
                <div>
                  <Label>Categoria da Publicação</Label>
                  <Select value={selectedCategoryLetter} onValueChange={setSelectedCategoryLetter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.letter} value={cat.letter}>
                          <span className="font-semibold">{cat.letter}</span> • {cat.name}
                          {documentTypeInfo?.suggestedCategoryLetter === cat.letter && (
                            <span className="ml-2 text-xs text-primary">(sugerido)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div>
                  <Label htmlFor="title">Título da Publicação *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Guia de Segurança para Resinas Fotopolimerizáveis"
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
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleGenerateMetadata}
                    disabled={isGeneratingMetadata || !document.extracted_text}
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
                </div>

                {/* OG Image Generation */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-blue-600" />
                        Imagem OG (Redes Sociais)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Otimizada para LinkedIn, WhatsApp e Google Discover (1200x630px)
                      </p>
                    </div>
                  </div>

                  {generatedOGImage ? (
                    <div className="space-y-2">
                      <div className="relative aspect-[1200/630] rounded-lg overflow-hidden border">
                        <img 
                          src={generatedOGImage} 
                          alt={generatedOGAlt || 'OG Preview'}
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 left-2 bg-green-600">
                          ✨ Gerada com IA
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={handleGenerateOGImage}
                          disabled={isGeneratingOG}
                        >
                          <RefreshCw className={`h-4 w-4 ${isGeneratingOG ? 'animate-spin' : ''}`} />
                          Regenerar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive"
                          onClick={() => {
                            setGeneratedOGImage(null);
                            setGeneratedOGAlt(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleGenerateOGImage}
                      disabled={isGeneratingOG || !title.trim()}
                    >
                      {isGeneratingOG ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando imagem...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          🖼️ Gerar Imagem OG com IA
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Extracted Text Preview (Collapsible) */}
                {document.extracted_text && (
                  <Collapsible open={showExtractedText} onOpenChange={setShowExtractedText}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          📝 Preview do texto extraído
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showExtractedText ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg max-h-[200px] overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {document.extracted_text.substring(0, 2000)}
                          {document.extracted_text.length > 2000 && '...'}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </ScrollArea>
          )}

          {step === 'preview' && generatedHTML && (
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-4 py-4 pr-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Preview do Conteúdo</h3>
                  <Button variant="outline" size="sm" onClick={() => setStep('form')}>
                    Voltar
                  </Button>
                </div>
                <div 
                  className="prose prose-sm max-w-none p-4 bg-white border rounded-lg"
                  dangerouslySetInnerHTML={{ __html: generatedHTML }}
                />
              </div>
            </ScrollArea>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center h-[300px] gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Salvando publicação...</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !title.trim() || !document.extracted_text}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    ⚡ Gerar Publicação
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Editar
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <BookOpen className="h-4 w-4" />
                💾 Salvar Publicação
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, UserCircle, Upload, X, ExternalLink, AlertCircle, Loader2, Video, Search, Check, Sparkles, HelpCircle } from 'lucide-react';
import { useKnowledge, getVideoEmbedUrl } from '@/hooks/useKnowledge';
import { KnowledgeEditor } from '@/components/KnowledgeEditor';
import { ProductCTAMultiSelect } from '@/components/ProductCTAMultiSelect';
import { ImageUpload } from '@/components/ImageUpload';
import { PDFTranscription } from '@/components/PDFTranscription';
import { Badge } from '@/components/ui/badge';
import { VideoSelector } from '@/components/VideoSelector';
import { useAuthors } from '@/hooks/useAuthors';
import { generateAuthorSignatureHTML } from '@/utils/authorSignatureHTML';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { useToast } from '@/hooks/use-toast';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { BlogPreviewFrame } from '@/components/BlogPreviewFrame';
import { useExternalLinks } from '@/hooks/useExternalLinks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { validateFileSize } from '@/utils/security';
import { AdminLinkBuildingValidator } from '@/components/AdminLinkBuildingValidator';

export function AdminKnowledge() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('A');
  const [contents, setContents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [videoSelectorOpen, setVideoSelectorOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<{[key: string]: string}>({});
  const [contentEditorMode, setContentEditorMode] = useState<'visual' | 'html'>('html');
  const [authors, setAuthors] = useState<any[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const ogFileRef = useRef<HTMLInputElement>(null);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [promptEdited, setPromptEdited] = useState(false);
  const { toast } = useToast();
  
  // AI Generation states
  const [rawTextInput, setRawTextInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Orchestrator states
  const [useOrchestrator, setUseOrchestrator] = useState(false);
  
  // Sistema de seleção de fontes para o orquestrador
  const [orchestratorActiveSources, setOrchestratorActiveSources] = useState({
    rawText: false,
    pdfTranscription: false,
    videoTranscription: false,
    relatedPdfs: false
  });
  
  // Dados extraídos automaticamente de cada fonte
  const [orchestratorExtractedData, setOrchestratorExtractedData] = useState<{
    rawText: string;
    pdfTranscription: string;
    videoTranscription: string;
    relatedPdfs: Array<{ id: string; name: string; content: string }>;
  }>({
    rawText: '',
    pdfTranscription: '',
    videoTranscription: '',
    relatedPdfs: []
  });
  
  // Manter orchestratorSources por compatibilidade (deprecated)
  const [orchestratorSources, setOrchestratorSources] = useState({
    technicalSheet: '',
    transcript: '',
    manual: '',
    testimonials: ''
  });
  
  // Multilingual states
  const [showEditorES, setShowEditorES] = useState(false);
  const [showEditorEN, setShowEditorEN] = useState(false);
  const [contentES, setContentES] = useState('');
  const [contentEN, setContentEN] = useState('');
  const [titleES, setTitleES] = useState('');
  const [titleEN, setTitleEN] = useState('');
  const [excerptES, setExcerptES] = useState('');
  const [excerptEN, setExcerptEN] = useState('');
  const [faqsES, setFaqsES] = useState<Array<{ question: string; answer: string }>>([]);
  const [faqsEN, setFaqsEN] = useState<Array<{ question: string; answer: string }>>([]);
  const [translating, setTranslating] = useState(false);
  const [translatingLanguage, setTranslatingLanguage] = useState<'es' | 'en' | null>(null);
  
  // Editor mode states for ES/EN
  const [contentEditorModeES, setContentEditorModeES] = useState<'visual' | 'html'>('html');
  const [contentEditorModeEN, setContentEditorModeEN] = useState<'visual' | 'html'>('html');
  const editorRefES = useRef<Editor | null>(null);
  const editorRefEN = useRef<Editor | null>(null);
  
  // PDF transcription states
  const [transcribingPdfId, setTranscribingPdfId] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  // Destino padrão para inserção de PDFs (PT, ES, EN)
  const [insertTargetLang, setInsertTargetLang] = useState<'pt' | 'es' | 'en'>('pt');
  
  // Auto-apply and auto-save states
  const [autoApplyIA, setAutoApplyIA] = useState(() => {
    const stored = localStorage.getItem('adminKnowledge_autoApplyIA');
    return stored !== null ? stored === 'true' : true;
  });
  const [autoSaveAfterGen, setAutoSaveAfterGen] = useState(() => {
    const stored = localStorage.getItem('adminKnowledge_autoSaveAfterGen');
    return stored !== null ? stored === 'true' : false;
  });
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [previousHTML, setPreviousHTML] = useState<string | null>(null);
  
  // Metadata generation states
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [generatedFAQs, setGeneratedFAQs] = useState<Array<{ question: string; answer: string }> | null>(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const { keywords, documents, updateKeywordUrl, loading } = useExternalLinks();
  
  // Keyword editing states
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [savingKeywordId, setSavingKeywordId] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  
  // PDF search states
  const [pdfSearchPT, setPdfSearchPT] = useState('');
  const [pdfSearchES, setPdfSearchES] = useState('');
  const [pdfSearchEN, setPdfSearchEN] = useState('');
  
  // Estados para busca/transcrição de PDFs no orquestrador
  const [pdfSearchOrchestrator, setPdfSearchOrchestrator] = useState('');
  const [transcribingOrchestratorPdfs, setTranscribingOrchestratorPdfs] = useState<Set<string>>(new Set());
  const [orchestratorPdfProgress, setOrchestratorPdfProgress] = useState<{[key: string]: string}>({});
  
  const DEFAULT_AI_PROMPT = `Você é um especialista em SEO e formatação de conteúdo para blog odontológico.

Receba o texto bruto abaixo e:
1. Estruture em HTML semântico (<h2>, <h3>, <p>, <ul>, <blockquote>)
2. Adicione classes CSS apropriadas (content-card, benefit-card, cta-panel)
3. Otimize para SEO (use palavras-chave naturalmente)
4. Insira links internos automaticamente quando encontrar palavras-chave relevantes
5. Mantenha tom profissional e didático`;
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content_html: '',
    icon_color: 'blue',
    file_url: '',
    file_name: '',
    meta_description: '',
    og_image_url: '',
    content_image_url: '',
    content_image_alt: '',
    canva_template_url: '',
    author_id: null as string | null,
    keywords: [] as string[],
    faqs: [] as Array<{ question: string; answer: string }>,
    order_index: 0,
    active: true,
    recommended_resins: [] as string[],
    recommended_products: [] as string[],
    aiPromptTemplate: '',
    selected_pdf_ids_pt: [] as string[],
    selected_pdf_ids_es: [] as string[],
    selected_pdf_ids_en: [] as string[]
  });
  
  const { 
    fetchCategories, 
    fetchContentsByCategory,
    fetchVideosByContent,
    updateCategory,
    insertContent,
    updateContent,
    deleteContent,
    insertVideo,
    deleteVideo
  } = useKnowledge();

  const { fetchAuthors } = useAuthors();

  // Helper function to add timeout to Supabase function calls
  const invokeWithTimeout = async (functionName: string, body: any, timeoutMs: number = 60000) => {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: A geração está demorando muito. Tente novamente.')), timeoutMs)
    );
    
    const invokePromise = supabase.functions.invoke(functionName, { body });
    
    return Promise.race([invokePromise, timeoutPromise]);
  };

  // Filter documents by search term
  const filterDocuments = (searchTerm: string) => {
    if (!searchTerm.trim()) return documents;
    
    const search = searchTerm.toLowerCase();
    return documents.filter(doc => 
      doc.document_name.toLowerCase().includes(search) ||
      doc.product_name.toLowerCase().includes(search) ||
      (doc.manufacturer && doc.manufacturer.toLowerCase().includes(search))
    );
  };

  useEffect(() => {
    loadCategories();
    loadAuthors();
  }, []);

  useEffect(() => {
    console.log('📄 Documents loaded:', documents.length);
    console.log('📄 Selected PDFs PT:', formData.selected_pdf_ids_pt);
  }, [documents, formData.selected_pdf_ids_pt]);

  const downloadPdfAsBase64 = async (fileUrl: string): Promise<string> => {
    try {
      const filePath = fileUrl.includes('supabase.co') 
        ? fileUrl.split('/storage/v1/object/public/')[1]
        : fileUrl;
      
      const bucketName = filePath.split('/')[0];
      const fileParts = filePath.split('/').slice(1).join('/');
      
      const { data: fileBlob, error } = await supabase.storage
        .from(bucketName)
        .download(fileParts);
      
      if (error) throw error;
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileBlob);
      });
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      throw error;
    }
  };

  const handleTranscribeExistingPdf = async (doc: any) => {
    if (transcribingPdfId) {
      toast({
        title: '⚠️ Transcrição em andamento',
        description: 'Aguarde o término da transcrição atual',
        variant: 'destructive'
      });
      return;
    }
    
    setTranscribingPdfId(doc.id);
    setTranscriptionProgress('Baixando PDF do storage...');
    
    try {
      const pdfBase64 = await downloadPdfAsBase64(doc.file_url);
      
      setTranscriptionProgress('Enviando para IA (pode levar até 2 min)...');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 120000)
      );
      
      const invokePromise = supabase.functions.invoke('ai-enrich-pdf-content', {
        body: { pdfBase64 }
      });
      
      const result = await Promise.race([invokePromise, timeoutPromise]) as any;
      const { data, error } = result;
      
      if (error) throw error;
      
      const extractedText = data.enrichedText || data.rawText;
      
      if (!extractedText) {
        throw new Error('Nenhum texto foi extraído do PDF');
      }
      
      setRawTextInput(extractedText);
      
      toast({
        title: '✅ PDF transcrito com sucesso!',
        description: `${doc.document_name} - Revise o texto e clique em "Gerar por IA"`,
        duration: 5000
      });
      
    } catch (error: any) {
      console.error('Erro ao transcrever PDF:', error);
      
      let errorMessage = 'Verifique se o arquivo está acessível e tente novamente';
      
      if (error.message === 'Timeout') {
        errorMessage = 'Tempo limite excedido (2 min). Tente um PDF menor.';
      }
      
      toast({
        title: '❌ Erro ao transcrever PDF',
        description: error.message || errorMessage,
        variant: 'destructive'
      });
    } finally {
      setTranscribingPdfId(null);
      setTranscriptionProgress('');
    }
  };

  const handleGenerateWithOrchestrator = async () => {
    console.log('🎯 Iniciando geração com orquestrador...');
    console.log('📊 Estado atual:', {
      temTitulo: !!formData.title,
      temResumo: !!formData.excerpt,
      fontesAtivas: orchestratorActiveSources,
      dadosExtraidos: {
        rawText: orchestratorExtractedData.rawText?.length || 0,
        pdfTranscription: orchestratorExtractedData.pdfTranscription?.length || 0,
        videoTranscription: orchestratorExtractedData.videoTranscription?.length || 0,
        relatedPdfs: orchestratorExtractedData.relatedPdfs.length
      }
    });
    
    // Validações
    const hasAnySources = Object.values(orchestratorActiveSources).some(v => v);
    if (!hasAnySources) {
      toast({
        title: '⚠️ Nenhuma fonte selecionada',
        description: 'Selecione pelo menos uma fonte de conteúdo',
        variant: 'destructive'
      });
      return;
    }
    
    // ✅ NOVO: Validar que fontes ativas têm conteúdo
    const emptyActiveSources: string[] = [];
    if (orchestratorActiveSources.rawText && !orchestratorExtractedData.rawText) {
      emptyActiveSources.push('Texto Colado');
    }
    if (orchestratorActiveSources.pdfTranscription && !orchestratorExtractedData.pdfTranscription) {
      emptyActiveSources.push('Upload de PDF');
    }
    if (orchestratorActiveSources.videoTranscription && !orchestratorExtractedData.videoTranscription) {
      emptyActiveSources.push('Transcrição de Vídeo');
    }
    if (orchestratorActiveSources.relatedPdfs && orchestratorExtractedData.relatedPdfs.length === 0) {
      emptyActiveSources.push('PDFs da Base');
    }
    
    if (emptyActiveSources.length > 0) {
      toast({
        title: '⚠️ Fontes vazias detectadas',
        description: `As seguintes fontes estão marcadas mas sem conteúdo: ${emptyActiveSources.join(', ')}. Desmarque-as ou adicione conteúdo.`,
        variant: 'destructive',
        duration: 8000
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Preparar dados para a edge function
      const orchestratorPayload = {
        title: formData.title,
        excerpt: formData.excerpt || '',
        activeSources: orchestratorActiveSources,
        // ✅ NOVO: Enviar produtos/resinas selecionados para priorização comercial
        selectedResinIds: formData.recommended_resins || [],
        selectedProductIds: formData.recommended_products || [],
        sources: {
          rawText: orchestratorExtractedData.rawText || null,
          pdfTranscription: orchestratorExtractedData.pdfTranscription || null,
          videoTranscription: orchestratorExtractedData.videoTranscription || null,
          relatedPdfs: orchestratorExtractedData.relatedPdfs.map(pdf => ({
            name: pdf.name,
            content: pdf.content
          }))
        },
        aiPrompt: formData.aiPromptTemplate || '' // prompt configurável
      };
      
      console.log('📤 Payload para ai-orchestrate-content:', {
        title: orchestratorPayload.title,
        activeSources: orchestratorPayload.activeSources,
        sourcesLength: {
          rawText: orchestratorPayload.sources.rawText?.length || 0,
          pdfTranscription: orchestratorPayload.sources.pdfTranscription?.length || 0,
          videoTranscription: orchestratorPayload.sources.videoTranscription?.length || 0,
          relatedPdfs: orchestratorPayload.sources.relatedPdfs.length,
          relatedPdfsTotalChars: orchestratorPayload.sources.relatedPdfs.reduce((sum, pdf) => sum + pdf.content.length, 0)
        }
      });
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-orchestrate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify(orchestratorPayload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status, errorText);
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data?.html) {
        console.error('❌ Resposta inválida:', data);
        throw new Error('Nenhum HTML foi gerado pela IA');
      }
      
      console.log('✅ HTML gerado com sucesso:', data.html.length, 'caracteres');
      
      setGeneratedHTML(data.html);
      
      toast({
        title: '✅ Conteúdo gerado!',
        description: 'Revise o preview abaixo e clique em "Inserir e Salvar"'
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao gerar conteúdo:', error);
      toast({
        title: 'Erro ao gerar conteúdo',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ NOVO: Função de injeção de links prioritários (post-processing)
  const injectPriorityLinks = async (html: string, productIds: string[]): Promise<string> => {
    if (!productIds || productIds.length === 0) return html;
    
    try {
      // Buscar dados dos produtos selecionados
      const { data: products, error } = await supabase
        .from('system_a_catalog')
        .select('id, name, slug, canonical_url')
        .in('id', productIds);
      
      if (error || !products) {
        console.warn('⚠️ Erro ao buscar produtos para link building:', error);
        return html;
      }
      
      let modifiedHTML = html;
      
      // Para cada produto, garantir pelo menos 2 links no HTML
      for (const product of products) {
        const productUrl = product.canonical_url || `/produtos/${product.slug}`;
        const linkRegex = new RegExp(`<a[^>]*href=["']${productUrl}["'][^>]*>`, 'gi');
        const existingLinksCount = (modifiedHTML.match(linkRegex) || []).length;
        
        // Se já existem 2 ou mais links, pular
        if (existingLinksCount >= 2) continue;
        
        // Criar link HTML
        const linkHTML = `<a href="${productUrl}" class="product-link priority" data-product-id="${product.id}">${product.name}</a>`;
        
        // Inserir link adicional na primeira menção após <h2>
        const h2Regex = /<h2[^>]*>.*?<\/h2>/gi;
        const h2Matches = modifiedHTML.match(h2Regex);
        
        if (h2Matches && h2Matches.length > 0) {
          const firstH2Index = modifiedHTML.indexOf(h2Matches[0]);
          const nextParagraphIndex = modifiedHTML.indexOf('<p>', firstH2Index);
          
          if (nextParagraphIndex !== -1) {
            const insertionPoint = modifiedHTML.indexOf('</p>', nextParagraphIndex);
            if (insertionPoint !== -1) {
              modifiedHTML = modifiedHTML.slice(0, insertionPoint) + 
                            ` Saiba mais sobre ${linkHTML}.` + 
                            modifiedHTML.slice(insertionPoint);
            }
          }
        }
      }
      
      console.log('✅ Links prioritários injetados');
      return modifiedHTML;
    } catch (error) {
      console.error('❌ Erro ao injetar links prioritários:', error);
      return html;
    }
  };

  // ✅ NOVO: Paralelização completa - chama 3 edge functions simultaneamente
  const handleGenerateCompleteArticle = async () => {
    console.log('🚀 Iniciando geração paralela completa...');
    
    // Validações
    const hasAnySources = Object.values(orchestratorActiveSources).some(v => v);
    if (!hasAnySources) {
      toast({
        title: '⚠️ Nenhuma fonte selecionada',
        description: 'Selecione pelo menos uma fonte de conteúdo',
        variant: 'destructive'
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Preparar dados para orchestrator
      const orchestratorPayload = {
        title: formData.title,
        excerpt: formData.excerpt || '',
        activeSources: orchestratorActiveSources,
        selectedResinIds: formData.recommended_resins || [],
        selectedProductIds: formData.recommended_products || [],
        // ✅ NOVO: Enviar expansionWarning para controle de temperatura
        expansionWarning: orchestratorExtractedData.pdfTranscription && 
                         orchestratorExtractedData.pdfTranscription.length > 10000,
        sources: {
          rawText: orchestratorExtractedData.rawText || null,
          pdfTranscription: orchestratorExtractedData.pdfTranscription || null,
          videoTranscription: orchestratorExtractedData.videoTranscription || null,
          relatedPdfs: orchestratorExtractedData.relatedPdfs.map(pdf => ({
            name: pdf.name,
            content: pdf.content
          }))
        },
        aiPrompt: formData.aiPromptTemplate || ''
      };

      // 🚀 Paralelização: 3 chamadas simultâneas
      console.log('🔄 Disparando 3 edge functions em paralelo...');
      const [orchestratorResult, metadataResult] = await Promise.allSettled([
        // H: Orchestrator (Pro) - Artigo completo + FAQs
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-orchestrate-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify(orchestratorPayload)
        }),
        
        // F: Metadata Generator (Flash Lite) - SEO Title + Meta Desc. + Keywords (SEM FAQs)
        formData.content_html ? fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-metadata-generator`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            title: formData.title,
            contentHTML: formData.content_html,
            regenerate: { title: false, metaDescription: true, keywords: true }
          })
        }) : Promise.resolve({ ok: false })
      ]);
      
      // Processar resultado do Orchestrator
      let orchestratorData = null;
      if (orchestratorResult.status === 'fulfilled' && orchestratorResult.value.ok) {
        orchestratorData = await orchestratorResult.value.json();
        console.log('✅ Orchestrator: HTML gerado', orchestratorData.html?.length, 'caracteres');
      } else {
        console.error('❌ Orchestrator falhou:', orchestratorResult);
        throw new Error('Falha ao gerar conteúdo principal');
      }
      
      // Processar resultado do Metadata Generator
      let metadataData = null;
      if (metadataResult.status === 'fulfilled' && metadataResult.value.ok) {
        // Verificar se é uma Response real antes de chamar .json()
        if ('json' in metadataResult.value) {
          metadataData = await metadataResult.value.json();
          console.log('✅ Metadata Generator: Meta description e keywords gerados');
        }
      }
      
      // ✅ Unificar FAQs: Usar APENAS as do Orchestrator
      const unifiedFAQs = orchestratorData?.faqs || [];
      setGeneratedFAQs(unifiedFAQs);
      console.log(`✅ FAQs unificadas: ${unifiedFAQs.length} perguntas`);
      
      // ✅ Injetar links prioritários no HTML (post-processing)
      const finalHTML = await injectPriorityLinks(
        orchestratorData?.html || '', 
        formData.recommended_products || []
      );
      setGeneratedHTML(finalHTML);
      
      // ✅ Metadados: Do Metadata Generator
      if (metadataData) {
        setFormData(prev => ({
          ...prev,
          meta_description: metadataData.metaDescription || prev.meta_description,
          keywords: metadataData.keywords || prev.keywords
        }));
      }
      
      toast({
        title: '✅ Geração completa em paralelo!',
        description: `HTML + ${unifiedFAQs.length} FAQs + Metadados prontos. Tempo reduzido em ~60%!`,
        duration: 6000
      });
      
    } catch (error: any) {
      console.error('❌ Erro na geração paralela:', error);
      toast({
        title: 'Erro na geração paralela',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertGeneratedHTML = async () => {
    if (!generatedHTML) return;
    
    try {
      console.log('💾 Salvando HTML + FAQs geradas...');
      
      // Atualizar formData com HTML + FAQs
      const updates: any = {
        content_html: generatedHTML,
      };

      // Salvar FAQs se foram geradas
      if (generatedFAQs && generatedFAQs.length > 0) {
        updates.faqs = generatedFAQs;
      }
      
      setFormData(prev => ({ ...prev, ...updates }));
      
      // Se for edição, salvar direto no banco
      if (editingContent?.id) {
        const { error } = await supabase
          .from('knowledge_contents')
          .update(updates)
          .eq('id', editingContent.id);
        
        if (error) throw error;
        
        toast({
          title: '✅ Conteúdo atualizado!',
          description: `HTML inserido + ${generatedFAQs?.length || 0} FAQs salvas`
        });
        
        // Recarregar dados
        loadContents();
      } else {
        toast({
          title: '✅ HTML e FAQs inseridos!',
          description: `Lembre-se de salvar o artigo para persistir. ${generatedFAQs?.length || 0} FAQs prontas.`
        });
      }
      
      // Limpar preview
      setGeneratedHTML(null);
      setGeneratedFAQs(null);
      
    } catch (error: any) {
      console.error('❌ Erro ao inserir HTML:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleTranscribePdfForOrchestrator = async (doc: any) => {
    // Verificar se já está transcrito
    if (orchestratorExtractedData.relatedPdfs.some(pdf => pdf.id === doc.id)) {
      toast({
        title: 'ℹ️ PDF já adicionado',
        description: 'Este PDF já foi transcrito e está nas fontes',
        variant: 'default'
      });
      return;
    }

    // Verificar se já está em transcrição
    if (transcribingOrchestratorPdfs.has(doc.id)) {
      toast({
        title: '⚠️ Transcrição em andamento',
        description: 'Aguarde o término da transcrição deste PDF',
        variant: 'destructive'
      });
      return;
    }
    
    setTranscribingOrchestratorPdfs(prev => new Set([...prev, doc.id]));
    setOrchestratorPdfProgress(prev => ({ ...prev, [doc.id]: 'Verificando cache...' }));
    
    try {
      // Usar nova edge function com cache
      const documentType = doc.product_id ? 'catalog' : 'resin';
      
      setOrchestratorPdfProgress(prev => ({ ...prev, [doc.id]: 'Extraindo texto (pode usar cache)...' }));
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 120000)
      );
      
      const invokePromise = supabase.functions.invoke('extract-and-cache-pdf', {
        body: { 
          documentId: doc.id,
          documentType,
          forceReExtract: false
        }
      });
      
      const result = await Promise.race([invokePromise, timeoutPromise]) as any;
      const { data, error } = result;
      
      if (error) {
        console.error('❌ Erro ao chamar extract-and-cache-pdf:', error);
        throw new Error(`Falha na extração: ${error.message || 'Função não encontrada'}`);
      }
      
      const extractedText = data.text;
      
      if (!extractedText) {
        throw new Error('Nenhum texto foi extraído do PDF');
      }
      
      // Adicionar aos dados do orquestrador
      setOrchestratorExtractedData(prev => ({
        ...prev,
        relatedPdfs: [
          ...prev.relatedPdfs,
          {
            id: doc.id,
            name: doc.document_name,
            content: extractedText,
            cached: data.cached
          }
        ]
      }));
      
      console.log('✅ PDF transcrito para orquestrador:', {
        id: doc.id,
        name: doc.document_name,
        contentLength: extractedText.length,
        cached: data.cached
      });
      
      toast({
        title: data.cached ? '⚡ PDF carregado do cache!' : '✅ PDF processado e salvo!',
        description: `${doc.document_name} ${data.cached ? '(instantâneo)' : `(${data.tokens || 0} tokens)`}`,
        duration: 5000
      });
      
    } catch (error: any) {
      console.error('Erro ao transcrever PDF:', error);
      
      let errorMessage = 'Verifique se o arquivo está acessível e tente novamente';
      
      if (error.message === 'Timeout') {
        errorMessage = 'Tempo limite excedido (2 min). Tente um PDF menor.';
      }
      
      toast({
        title: '❌ Erro ao transcrever PDF',
        description: error.message || errorMessage,
        variant: 'destructive'
      });
    } finally {
      setTranscribingOrchestratorPdfs(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
      setOrchestratorPdfProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[doc.id];
        return newProgress;
      });
    }
  };

  const handleRemovePdfFromOrchestrator = (pdfId: string) => {
    setOrchestratorExtractedData(prev => ({
      ...prev,
      relatedPdfs: prev.relatedPdfs.filter(pdf => pdf.id !== pdfId)
    }));
    
    toast({
      title: 'PDF removido das fontes',
      variant: 'default'
    });
  };

  useEffect(() => {
    if (selectedCategory) {
      loadContents();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    const data = await fetchCategories();
    setCategories(data);
    
    // Inicializar estado de edição
    const namesMap: {[key: string]: string} = {};
    data.forEach(cat => {
      namesMap[cat.id] = cat.name;
    });
    setEditingCategoryName(namesMap);
  };

  const loadContents = async () => {
    const data = await fetchContentsByCategory(selectedCategory);
    setContents(data);
  };

  const loadAuthors = async () => {
    const data = await fetchAuthors();
    setAuthors(data);
  };

  const handleOpenEdit = async (content: any) => {
    setEditingContent(content);
    setContentEditorMode('html');
    setPromptEdited(false);
    setGeneratedHTML(null);
    setGeneratedFAQs(null);
    setRawTextInput('');
    setPendingAutoSave(false);
    setPreviousHTML(null);
    setFormData({
      title: content.title,
      slug: content.slug,
      excerpt: content.excerpt,
      content_html: content.content_html || '',
      icon_color: content.icon_color,
      file_url: content.file_url || '',
      file_name: content.file_name || '',
      meta_description: content.meta_description || '',
      og_image_url: content.og_image_url || '',
      canva_template_url: content.canva_template_url || '',
      author_id: content.author_id || null,
      keywords: content.keywords || [],
      faqs: content.faqs || [],
      order_index: content.order_index,
      active: content.active,
      recommended_resins: content.recommended_resins || [],
      recommended_products: content.recommended_products || [],
      content_image_url: (content as any).content_image_url || '',
      content_image_alt: (content as any).content_image_alt || '',
      aiPromptTemplate: (content as any).ai_prompt_template || '',
      selected_pdf_ids_pt: content.selected_pdf_ids_pt || [],
      selected_pdf_ids_es: content.selected_pdf_ids_es || [],
      selected_pdf_ids_en: content.selected_pdf_ids_en || []
    });
    
    // Load multilingual content
    setContentES(content.content_html_es || '');
    setContentEN(content.content_html_en || '');
    setTitleES(content.title_es || '');
    setTitleEN(content.title_en || '');
    setExcerptES(content.excerpt_es || '');
    setExcerptEN(content.excerpt_en || '');
    setFaqsES(content.faqs_es || []);
    setFaqsEN(content.faqs_en || []);
    
    // Expand editors if content exists
    setShowEditorES(!!content.content_html_es);
    setShowEditorEN(!!content.content_html_en);
    
    const vids = await fetchVideosByContent(content.id);
    setVideos(vids);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingContent(null);
    setContentEditorMode('html');
    setPromptEdited(false);
    setGeneratedHTML(null);
    setGeneratedFAQs(null);
    setRawTextInput('');
    setPendingAutoSave(false);
    setPreviousHTML(null);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content_html: '',
      icon_color: 'blue',
      file_url: '',
      file_name: '',
      meta_description: '',
      og_image_url: '',
      content_image_url: '',
      content_image_alt: '',
      canva_template_url: '',
      author_id: null,
      keywords: [],
      faqs: [],
      order_index: contents.length,
      active: true,
      recommended_resins: [],
      recommended_products: [],
      aiPromptTemplate: '',
      selected_pdf_ids_pt: [],
      selected_pdf_ids_es: [],
      selected_pdf_ids_en: []
    });
    
    // Reset multilingual states
    setContentES('');
    setContentEN('');
    setTitleES('');
    setTitleEN('');
    setExcerptES('');
    setExcerptEN('');
    setFaqsES([]);
    setFaqsEN([]);
    setShowEditorES(false);
    setShowEditorEN(false);
    
    setVideos([]);
    setModalOpen(true);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleGenerateTitleAndExcerpt = async () => {
    if (!formData.content_html) {
      toast({
        title: '⚠️ Campo obrigatório',
        description: 'Preencha o Conteúdo antes de gerar Título e Resumo',
        variant: 'destructive'
      });
      return;
    }
    
    setIsGeneratingMetadata(true);
    
    try {
      const { data, error } = await invokeWithTimeout('ai-metadata-generator', {
        title: formData.title || 'Título Temporário',
        contentHTML: formData.content_html,
        regenerate: {
          title: true,
          excerpt: true
        }
      }) as any;
      
      if (error) throw error;
      
      if (data.title) {
        setFormData(prev => ({
          ...prev,
          title: data.title,
          excerpt: data.excerpt || ''
        }));
        
        toast({
          title: '✅ Título + Resumo gerados!',
          description: 'Campos atualizados com conteúdo gerado por IA',
        });
      }
    } catch (err: any) {
      console.error('❌ Erro ao gerar título e resumo:', err);
      toast({
        title: '❌ Erro na geração',
        description: err.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const handleSaveContent = async () => {
    if (!formData.title || !formData.excerpt) {
      toast({
        title: "⚠️ Campos obrigatórios",
        description: "Preencha Título e Resumo antes de salvar.",
        variant: "destructive"
      });
      return;
    }

    try {
      const categoryId = categories.find(c => c.letter === selectedCategory)?.id;
      
      const contentData = {
        title: formData.title,
        title_es: titleES || null,
        title_en: titleEN || null,
        slug: formData.slug || generateSlug(formData.title),
        excerpt: formData.excerpt,
        excerpt_es: excerptES || null,
        excerpt_en: excerptEN || null,
        content_html: formData.content_html,
        content_html_es: contentES || null,
        content_html_en: contentEN || null,
        icon_color: formData.icon_color,
        meta_description: formData.meta_description,
        og_image_url: formData.og_image_url,
        content_image_url: formData.content_image_url,
        content_image_alt: formData.content_image_alt,
        canva_template_url: formData.canva_template_url,
        file_url: formData.file_url,
        file_name: formData.file_name,
        author_id: formData.author_id,
        keywords: formData.keywords?.length > 0 ? formData.keywords : null,
        faqs: formData.faqs,
        faqs_es: faqsES.length > 0 ? faqsES : null,
        faqs_en: faqsEN.length > 0 ? faqsEN : null,
        order_index: formData.order_index,
        active: formData.active,
        ai_prompt_template: formData.aiPromptTemplate || null,
        category_id: categoryId,
        recommended_resins: formData.recommended_resins?.length > 0 ? formData.recommended_resins : null,
        recommended_products: formData.recommended_products?.length > 0 ? formData.recommended_products : null,
        selected_pdf_ids_pt: formData.selected_pdf_ids_pt || [],
        selected_pdf_ids_es: formData.selected_pdf_ids_es || [],
        selected_pdf_ids_en: formData.selected_pdf_ids_en || [],
      };

      console.log('💾 Saving content with PDFs:', {
        pt: contentData.selected_pdf_ids_pt,
        es: contentData.selected_pdf_ids_es,
        en: contentData.selected_pdf_ids_en
      });

      if (editingContent) {
        await updateContent(editingContent.id, contentData);
        
        // UPSERT inteligente de vídeos: atualiza órfãos ou insere novos
        const existingVids = await fetchVideosByContent(editingContent.id);
        
        // 1. Deletar vídeos que não estão mais na lista
        for (const vid of existingVids) {
          const stillPresent = videos.find(v => {
            // Type narrowing para PandaVideo
            if (v.video_type === 'pandavideo' && vid.video_type === 'pandavideo') {
              return v.pandavideo_id === vid.pandavideo_id;
            }
            // Type narrowing para YouTube
            if (v.video_type === 'youtube' && vid.video_type === 'youtube') {
              return v.url === vid.url;
            }
            // Fallback por ID
            return v.id === vid.id;
          });
          if (!stillPresent) {
            await deleteVideo(vid.id);
          }
        }
        
        // 2. Inserir ou atualizar vídeos
        for (const video of videos) {
          // Se o vídeo é PandaVideo, verificar se já existe no banco (pode ser órfão)
          if (video.video_type === 'pandavideo') {
            const { data: existingOrphan } = await supabase
              .from('knowledge_videos')
              .select('id, content_id')
              .eq('pandavideo_id', video.pandavideo_id)
              .maybeSingle();
            
            if (existingOrphan) {
              // Atualizar content_id do vídeo existente (recupera órfãos)
              const updateData: any = { 
                content_id: editingContent.id,
                title: video.title,
                order_index: video.order_index
              };
              if (video.description) updateData.description = video.description;
              
              await supabase
                .from('knowledge_videos')
                .update(updateData)
                .eq('id', existingOrphan.id);
            } else {
              // Inserir novo vídeo
              await insertVideo({ ...video, content_id: editingContent.id });
            }
          } else {
            // Vídeo YouTube: verificar se já existe por URL
            if (video.id && existingVids.find(v => v.id === video.id)) {
              // Já existe, não fazer nada
              continue;
            }
            // Inserir novo
            await insertVideo({ ...video, content_id: editingContent.id });
          }
        }
        
        toast({ title: "✅ Conteúdo atualizado!" });
      } else {
        const newContent = await insertContent(contentData);
        if (newContent) {
          for (const video of videos) {
            await insertVideo({ ...video, content_id: newContent.id });
          }
        }
        toast({ title: "✅ Conteúdo criado!" });
      }
      
      setPromptEdited(false);
      setPendingAutoSave(false);
      await loadContents();
      
      // ✅ CORREÇÃO: Aguardar 1 tick antes de fechar o modal
      // Garante que setPendingAutoSave(false) seja propagado antes de onOpenChange verificar
      setTimeout(() => {
        setModalOpen(false);
      }, 0);
    } catch (error: any) {
      console.error('❌ Erro ao salvar:', error);
      toast({
        title: "❌ Erro ao salvar",
        description: error?.message || "Verifique os campos e tente novamente.",
        variant: "destructive"
      });
    }
  };
  
  // Translate content function
  const translateContent = async (targetLanguage: 'es' | 'en') => {
    if (!formData.content_html) {
      toast({
        title: '⚠️ Conteúdo vazio',
        description: 'Preencha o conteúdo em português primeiro',
        variant: 'destructive'
      });
      return;
    }
    
    setTranslating(true);
    setTranslatingLanguage(targetLanguage);
    
    try {
      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: {
          title: formData.title,
          excerpt: formData.excerpt,
          htmlContent: formData.content_html,
          faqs: formData.faqs.length > 0 ? formData.faqs : null,
          targetLanguage
        }
      });
      
      if (error) throw error;
      
      const languageEmoji = targetLanguage === 'es' ? '🇪🇸' : '🇺🇸';
      const languageName = targetLanguage === 'es' ? 'Espanhol' : 'Inglês';
      
      if (targetLanguage === 'es') {
        setTitleES(data.translatedTitle || '');
        setExcerptES(data.translatedExcerpt || '');
        setContentES(data.translatedHTML || '');
        if (data.translatedFAQs) setFaqsES(data.translatedFAQs);
        setShowEditorES(true);
      } else {
        setTitleEN(data.translatedTitle || '');
        setExcerptEN(data.translatedExcerpt || '');
        setContentEN(data.translatedHTML || '');
        if (data.translatedFAQs) setFaqsEN(data.translatedFAQs);
        setShowEditorEN(true);
      }
      
      toast({
        title: `${languageEmoji} Tradução concluída!`,
        description: `Título, resumo e conteúdo traduzidos para ${languageName}.`
      });
    } catch (error: any) {
      console.error('Translation error:', error);
      toast({
        title: '❌ Erro na tradução',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive'
      });
    } finally {
      setTranslating(false);
      setTranslatingLanguage(null);
    }
  };

  // Função para limpar conteúdo em Espanhol
  const clearSpanishContent = () => {
    if (!confirm('⚠️ Tem certeza que deseja excluir toda a versão em Espanhol?')) {
      return;
    }
    
    setTitleES('');
    setExcerptES('');
    setContentES('');
    setFaqsES([]);
    setShowEditorES(false);
    
    toast({
      title: '🗑️ Versão em Espanhol removida',
      description: 'Clique em "Salvar" para persistir as mudanças'
    });
  };

  // Função para limpar conteúdo em Inglês
  const clearEnglishContent = () => {
    if (!confirm('⚠️ Are you sure you want to delete the entire English version?')) {
      return;
    }
    
    setTitleEN('');
    setExcerptEN('');
    setContentEN('');
    setFaqsEN([]);
    setShowEditorEN(false);
    
    toast({
      title: '🗑️ English version removed',
      description: 'Click "Save" to persist changes'
    });
  };

  // Função para refazer tradução em Espanhol
  const retranslateSpanish = async () => {
    if (!formData.content_html) {
      toast({
        title: '⚠️ Conteúdo vazio',
        description: 'Preencha o conteúdo em português primeiro',
        variant: 'destructive'
      });
      return;
    }

    const confirmed = confirm(
      '🔄 Refazer tradução?\n\n' +
      'Isso irá substituir TODA a versão em Espanhol (título, resumo, conteúdo e FAQs) ' +
      'pela nova tradução automática.\n\n' +
      '⚠️ As alterações manuais serão perdidas!'
    );
    
    if (!confirmed) return;
    
    // Limpa conteúdo atual antes de retraduzir
    setTitleES('');
    setExcerptES('');
    setContentES('');
    setFaqsES([]);
    
    // Chama a tradução
    await translateContent('es');
  };

  // Função para refazer tradução em Inglês
  const retranslateEnglish = async () => {
    if (!formData.content_html) {
      toast({
        title: '⚠️ Empty content',
        description: 'Fill the Portuguese content first',
        variant: 'destructive'
      });
      return;
    }

    const confirmed = confirm(
      '🔄 Retranslate content?\n\n' +
      'This will replace the ENTIRE English version (title, excerpt, content and FAQs) ' +
      'with a new automatic translation.\n\n' +
      '⚠️ Manual changes will be lost!'
    );
    
    if (!confirmed) return;
    
    // Limpa conteúdo atual antes de retraduzir
    setTitleEN('');
    setExcerptEN('');
    setContentEN('');
    setFaqsEN([]);
    
    // Chama a tradução
    await translateContent('en');
  };

  const handleDeleteContent = async (id: string) => {
    if (confirm('Excluir este artigo?')) {
      await deleteContent(id);
      loadContents();
    }
  };

  const handleInsertAuthorSignature = () => {
    if (!formData.author_id) return;
    
    const author = authors.find(a => a.id === formData.author_id);
    if (!author) {
      toast({
        title: "Erro",
        description: "Autor não encontrado",
        variant: "destructive"
      });
      return;
    }
    
    if (contentEditorMode === 'visual' && editorRef.current) {
      // Inserir marcador no editor TipTap
      editorRef.current.commands.focus('end');
      editorRef.current.commands.insertContent({
        type: 'paragraph',
        content: [{ type: 'text', text: AUTHOR_SIGNATURE_TOKEN }]
      });
    } else {
      // Modo HTML: concatenar marcador ao final
      setFormData({
        ...formData,
        content_html: formData.content_html + '\n\n' + AUTHOR_SIGNATURE_TOKEN + '\n\n'
      });
    }
    
    toast({
      title: "Sucesso",
      description: "Assinatura do autor inserida no final do conteúdo"
    });
  };

  const handleInsertPDFViewer = (doc: any) => {
    console.log('📄 handleInsertPDFViewer chamado:', {
      doc: doc.document_name,
      modePT: contentEditorMode,
      modeES: contentEditorModeES,
      modeEN: contentEditorModeEN,
      target: insertTargetLang,
      hasEditorPT: !!editorRef.current,
      hasEditorES: !!editorRefES.current,
      hasEditorEN: !!editorRefEN.current,
    });

    // HTML do PDF viewer embedded
    const pdfViewerHTML = `
    <div class="pdf-viewer-container" style="margin: 32px 0; border: 2px solid #f59e0b; border-radius: 12px; overflow: hidden; background: #fffbeb;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 16px; color: white;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">📄</span>
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${doc.document_name}</h3>
            <p class="pdf-subtitle" style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">
              ${doc.resin_name} - ${doc.manufacturer}
            </p>
          </div>
        </div>
      </div>
      
      <iframe 
        src="${doc.file_url}" 
        style="width: 100%; height: 600px; border: none; display: block;"
        title="${doc.document_name}"
        loading="lazy"
      ></iframe>
      
      <div style="padding: 12px; background: #fef3c7; border-top: 1px solid #f59e0b;">
        <a 
          href="${doc.file_url}" 
          target="_blank" 
          rel="noopener noreferrer"
          style="display: inline-flex; align-items: center; gap: 8px; color: #92400e; text-decoration: none; font-size: 14px; font-weight: 500;"
        >
          <span>📥</span>
          Baixar PDF completo
          <span style="font-size: 12px;">→</span>
        </a>
      </div>
    </div>
  `;

    console.log('📄 HTML gerado (primeiros 200 chars):', pdfViewerHTML.substring(0, 200));

    const appendToPT = () => {
      const current = formData.content_html || '';
      setFormData({
        ...formData,
        content_html: current + '\n\n' + pdfViewerHTML + '\n\n'
      });
      if (contentEditorMode === 'visual') {
        // Mudar para HTML para o usuário visualizar o bloco inserido
        setContentEditorMode('html');
        toast({ title: 'PDF inserido no PT', description: 'Mudamos para o modo HTML para você visualizar o bloco.' });
      }
    };

    const appendToES = () => {
      const current = contentES || '';
      setContentES(current + '\n\n' + pdfViewerHTML + '\n\n');
      if (contentEditorModeES === 'visual') {
        setContentEditorModeES('html');
        toast({ title: 'PDF inserido no ES', description: 'Mudamos para o modo HTML para você visualizar o bloco.' });
      }
    };

    const appendToEN = () => {
      const current = contentEN || '';
      setContentEN(current + '\n\n' + pdfViewerHTML + '\n\n');
      if (contentEditorModeEN === 'visual') {
        setContentEditorModeEN('html');
        toast({ title: 'PDF inserido no EN', description: 'Mudamos para o modo HTML para você visualizar o bloco.' });
      }
    };

    switch (insertTargetLang) {
      case 'pt':
        appendToPT();
        break;
      case 'es':
        appendToES();
        break;
      case 'en':
        appendToEN();
        break;
    }

    toast({ 
      title: '✅ PDF inserido!', 
      description: `${doc.document_name} foi adicionado ao conteúdo (${insertTargetLang.toUpperCase()})`,
      variant: 'default'
    });

    console.log('✅ handleInsertPDFViewer concluído');
  };

  const handleUploadOgImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Arquivo inválido', 
        description: 'Selecione uma imagem.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!validateFileSize(file, 10)) {
      toast({ 
        title: 'Imagem muito grande', 
        description: 'Máximo 10MB.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setUploadingOg(true);
      const ext = file.name.split('.').pop();
      const slug = formData.slug || generateSlug(formData.title) || 'og-image';
      const path = `knowledge-og/${slug}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('model-images')
        .getPublicUrl(path);

      setFormData({ ...formData, og_image_url: data.publicUrl });
      
      toast({ 
        title: 'Imagem OG enviada', 
        description: 'Upload concluído!' 
      });
    } catch (err) {
      console.error(err);
      toast({ 
        title: 'Erro no upload', 
        description: 'Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setUploadingOg(false);
      if (ogFileRef.current) ogFileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Base de Conhecimento</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-2">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.letter}>
                {cat.letter} • {cat.name}
              </TabsTrigger>
            ))}
            <TabsTrigger value="link-validator">
              🔗 Validador
            </TabsTrigger>
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.letter} className="space-y-4">
              {/* Category Settings */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Nome da Categoria</Label>
                    <Input 
                      value={editingCategoryName[cat.id] || cat.name}
                      onChange={(e) => {
                        // Apenas atualiza estado local
                        setEditingCategoryName({
                          ...editingCategoryName,
                          [cat.id]: e.target.value
                        });
                      }}
                      onBlur={async () => {
                        // Salva apenas quando sair do campo (onBlur)
                        if (editingCategoryName[cat.id] && editingCategoryName[cat.id] !== cat.name) {
                          await updateCategory(cat.id, { name: editingCategoryName[cat.id] });
                          await loadCategories();
                        }
                      }}
                      onKeyDown={(e) => {
                        // Salva ao pressionar Enter
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Habilitada</Label>
                    <div className="mt-2">
                      <Switch 
                        checked={cat.enabled}
                        onCheckedChange={(checked) => {
                          updateCategory(cat.id, { enabled: checked });
                          loadCategories();
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contents List */}
              <div className="space-y-3">
                {contents.map((content) => (
                  <div key={content.id} className="p-4 border border-border rounded-lg bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{content.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{content.excerpt}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenEdit(content)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeleteContent(content.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Button */}
                <Button 
                  onClick={handleOpenNew}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  ADICIONAR CONTEÚDO
                </Button>
              </div>
            </TabsContent>
          ))}
          
          {/* Link Building Validator Tab */}
          <TabsContent value="link-validator" className="space-y-4">
            <AdminLinkBuildingValidator />
          </TabsContent>
        </Tabs>

        {/* Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={(open) => {
          if (!open && pendingAutoSave) {
            if (confirm('Você tem alterações não salvas. Salvar agora?')) {
              handleSaveContent();
            } else {
              setPendingAutoSave(false);
            }
          }
          setModalOpen(open);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContent ? 'Editar' : 'Adicionar'} Conteúdo
              </DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="content">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="content">📝 Conteúdo</TabsTrigger>
                <TabsTrigger value="ai-generation">🤖 IA</TabsTrigger>
                <TabsTrigger value="seo">🔍 SEO</TabsTrigger>
                <TabsTrigger value="faqs">❓ FAQs</TabsTrigger>
                <TabsTrigger value="media">🎬 Mídias</TabsTrigger>
                <TabsTrigger value="conversion">💰 Conversão</TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input 
                    placeholder="Ex: Como Calibrar Impressora" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Resumo (max 160 chars)</Label>
                  <Textarea 
                    maxLength={160}
                    value={formData.excerpt}
                    onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
                  />
                </div>
                
                {/* Botão Gerar Título + Resumo por IA */}
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTitleAndExcerpt}
                    disabled={isGeneratingMetadata || !formData.content_html}
                    className="gap-2"
                  >
                    {isGeneratingMetadata ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        🪄 Gerar Título + Resumo por IA
                      </>
                    )}
                  </Button>
                </div>
                
                <div>
                  <Label>Autor</Label>
                  <Select 
                    value={formData.author_id || 'none'} 
                    onValueChange={(value) => setFormData({...formData, author_id: value === 'none' ? null : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um autor (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem autor</SelectItem>
                      {authors.map((author) => (
                        <SelectItem key={author.id} value={author.id}>
                          {author.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.author_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleInsertAuthorSignature}
                      className="mt-2"
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Inserir Assinatura do Autor
                    </Button>
                  )}
                </div>

                {/* Seleção de PDFs - PT */}
                <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                  <Label className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-3">
                    <span className="text-xl">📄</span>
                    PDFs Incorporados (PT) - aparecem no topo do artigo
                  </Label>
                  
                  {/* Campo de busca */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-600" />
                      <Input
                        type="text"
                        placeholder="Buscar PDF por nome, produto ou fabricante..."
                        value={pdfSearchPT}
                        onChange={(e) => setPdfSearchPT(e.target.value)}
                        className="pl-10 pr-10 bg-white dark:bg-gray-900 border-amber-300 focus:border-amber-500"
                      />
                      {pdfSearchPT && (
                        <button
                          onClick={() => setPdfSearchPT('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-amber-100 dark:hover:bg-amber-900 rounded p-1"
                          title="Limpar busca"
                        >
                          <X className="h-4 w-4 text-amber-600" />
                        </button>
                      )}
                    </div>
                    {pdfSearchPT && (
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-amber-600">
                          🔍 {filterDocuments(pdfSearchPT).length} resultado(s) encontrado(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[200px] w-full overflow-y-auto overflow-x-hidden border border-border/30 rounded p-2">
                    <div className="space-y-2">
                      {loading && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                          <span className="ml-2 text-sm text-amber-700 dark:text-amber-300">Carregando PDFs...</span>
                        </div>
                      )}
                      {!loading && documents.length === 0 && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 p-2">
                          Nenhum PDF disponível. Adicione documentos às resinas primeiro.
                        </p>
                      )}
                      {!loading && filterDocuments(pdfSearchPT).length === 0 && pdfSearchPT && documents.length > 0 && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 p-2">
                          Nenhum PDF encontrado para "{pdfSearchPT}"
                        </p>
                      )}
                      {filterDocuments(pdfSearchPT).map((doc) => (
                        <div key={doc.id} className="flex items-start gap-2 p-2 rounded hover:bg-amber-100/50 dark:hover:bg-amber-900/30">
                          <label className="flex items-start gap-3 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.selected_pdf_ids_pt.includes(doc.id)}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...formData.selected_pdf_ids_pt, doc.id]
                                  : formData.selected_pdf_ids_pt.filter(id => id !== doc.id);
                                console.log('📄 PDF checkbox changed:', doc.document_name, 'New IDs:', newIds);
                                setFormData({ ...formData, selected_pdf_ids_pt: newIds });
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1 text-sm">
                              <p className="font-medium text-amber-900 dark:text-amber-100">
                                {doc.document_name}
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                {doc.product_name}
                                {doc.manufacturer && ` - ${doc.manufacturer}`}
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900">
                                  {doc.source === 'resin' ? '🧪 Resina' : '📦 Catálogo'}
                                </span>
                              </p>
                            </div>
                          </label>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTranscribeExistingPdf(doc)}
                            disabled={transcribingPdfId === doc.id || isGenerating}
                            className="flex-shrink-0 h-8 px-2 text-xs"
                            title="Transcrever este PDF com IA"
                          >
                            {transcribingPdfId === doc.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                <span className="hidden sm:inline">Transcrevendo...</span>
                              </>
                            ) : (
                              <>
                                🤖 <span className="hidden sm:inline ml-1">Transcrever</span>
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {formData.selected_pdf_ids_pt.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      ✓ {formData.selected_pdf_ids_pt.length} PDF(s) selecionado(s)
                    </p>
                  )}
                  
                  {transcribingPdfId && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-blue-900 dark:text-blue-100">
                          {transcriptionProgress}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Conteúdo Principal</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={contentEditorMode === 'visual' ? 'default' : 'outline'}
                        onClick={() => setContentEditorMode('visual')}
                      >
                        📝 Visual
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={contentEditorMode === 'html' ? 'default' : 'outline'}
                        onClick={() => setContentEditorMode('html')}
                      >
                        🔧 HTML
                      </Button>
                    </div>
                  </div>
                  
                  {generatedHTML && (
                    <div className="mb-3 flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <span className="text-sm font-medium">🤖 Conteúdo gerado por IA</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setGeneratedHTML('');
                          toast({ 
                            title: '✓ Status removido', 
                            description: 'Marcado como editado manualmente' 
                          });
                        }}
                        className="ml-auto"
                      >
                        Marcar como editado
                      </Button>
                    </div>
                  )}
                  
                  {contentEditorMode === 'visual' ? (
                    <KnowledgeEditor 
                      content={formData.content_html}
                      onChange={(html) => setFormData({...formData, content_html: html})}
                      onEditorReady={(editor) => editorRef.current = editor}
                    />
                  ) : (
                    <div className="space-y-2">
                      <Textarea 
                        className="font-mono text-sm min-h-[400px] relative z-10 bg-card"
                        placeholder="<div>Insira HTML aqui...</div>"
                        value={formData.content_html}
                        onChange={(e) => setFormData({...formData, content_html: e.target.value})}
                      />
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          👁️ Preview HTML
                        </summary>
                        <div 
                          className="mt-2 p-4 border border-border rounded-lg bg-card"
                          dangerouslySetInnerHTML={{ 
                            __html: (() => {
                              const selectedAuthor = authors.find(a => a.id === formData.author_id);
                              return selectedAuthor 
                                ? renderAuthorSignaturePlaceholders(formData.content_html, selectedAuthor)
                                : formData.content_html;
                            })()
                          }}
                        />
                      </details>
                    </div>
                  )}
                  
                  {/* ========== EDITOR ESPANHOL ========== */}
                  <div className="mt-6 border-t pt-6">
                    {!showEditorES ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => translateContent('es')}
                        disabled={!formData.content_html || translating}
                        className="w-full"
                      >
                        {translating && translatingLanguage === 'es' ? (
                          <>⏳ Traduzindo para Espanhol...</>
                        ) : (
                          <>➕ Adicionar Versão em Espanhol (ES) 🇪🇸</>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-lg font-semibold">
                            🇪🇸 Versão em Espanhol
                          </Label>
                          <div className="flex gap-2">
                            {/* Botão Refazer Tradução */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={retranslateSpanish}
                              disabled={!formData.content_html || translating}
                            >
                              {translating && translatingLanguage === 'es' ? (
                                <>⏳ Traduzindo...</>
                              ) : (
                                <>🔄 Refazer Tradução</>
                              )}
                            </Button>
                            {/* Botão Excluir */}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={clearSpanishContent}
                            >
                              🗑️ Excluir
                            </Button>
                            {/* Botão Recolher */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowEditorES(false)}
                            >
                              ▲ Recolher
                            </Button>
                          </div>
                        </div>
                        
                        {/* Título e Resumo ES */}
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <Label className="text-sm">Título (ES)</Label>
                            <Input
                              value={titleES}
                              onChange={(e) => setTitleES(e.target.value)}
                              placeholder="Título traducido..."
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Resumo (ES) - max 160 chars</Label>
                            <Textarea
                              value={excerptES}
                              onChange={(e) => setExcerptES(e.target.value)}
                              maxLength={160}
                              placeholder="Resumen traducido..."
                              className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {excerptES.length}/160
                            </p>
                          </div>
                        </div>
                        
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            💡 <strong>Dica:</strong> O conteúdo foi traduzido automaticamente. 
                            Substitua apenas as imagens que contêm texto em português. 
                            Links e formatação foram mantidos automaticamente.
                          </AlertDescription>
                        </Alert>

                        {/* Seleção de PDFs - ES */}
                        <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                          <Label className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-3">
                            <span className="text-xl">📄</span>
                            PDFs Incorporados (ES) - aparecem no topo do artigo
                          </Label>
                          
                          {/* Campo de busca */}
                          <div className="mb-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-600" />
                              <Input
                                type="text"
                                placeholder="Buscar PDF por nombre, producto o fabricante..."
                                value={pdfSearchES}
                                onChange={(e) => setPdfSearchES(e.target.value)}
                                className="pl-10 pr-10 bg-white dark:bg-gray-900 border-amber-300 focus:border-amber-500"
                              />
                              {pdfSearchES && (
                                <button
                                  onClick={() => setPdfSearchES('')}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-amber-100 dark:hover:bg-amber-900 rounded p-1"
                                  title="Limpiar búsqueda"
                                >
                                  <X className="h-4 w-4 text-amber-600" />
                                </button>
                              )}
                            </div>
                            {pdfSearchES && (
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-amber-600">
                                  🔍 {filterDocuments(pdfSearchES).length} resultado(s) encontrado(s)
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="max-h-[200px] w-full overflow-y-auto overflow-x-hidden border border-border/30 rounded p-2">
                            <div className="space-y-2">
                              {filterDocuments(pdfSearchES).length === 0 && pdfSearchES && documents.length > 0 && (
                                <p className="text-sm text-amber-700 dark:text-amber-300 p-2">
                                  Ningún PDF encontrado para "{pdfSearchES}"
                                </p>
                              )}
                              {filterDocuments(pdfSearchES).map((doc) => (
                                <label key={doc.id} className="flex items-start gap-3 p-2 rounded hover:bg-amber-100/50 dark:hover:bg-amber-900/30 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.selected_pdf_ids_es.includes(doc.id)}
                                    onChange={(e) => {
                                      const newIds = e.target.checked
                                        ? [...formData.selected_pdf_ids_es, doc.id]
                                        : formData.selected_pdf_ids_es.filter(id => id !== doc.id);
                                      setFormData({ ...formData, selected_pdf_ids_es: newIds });
                                    }}
                                    className="mt-1"
                                  />
                                   <div className="flex-1 text-sm">
                                    <p className="font-medium text-amber-900 dark:text-amber-100">
                                      {doc.document_name}
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                      {doc.product_name}
                                      {doc.manufacturer && ` - ${doc.manufacturer}`}
                                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900">
                                        {doc.source === 'resin' ? '🧪 Resina' : '📦 Catálogo'}
                                      </span>
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                          {formData.selected_pdf_ids_es.length > 0 && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                              ✓ {formData.selected_pdf_ids_es.length} PDF(s) selecionado(s)
                            </p>
                          )}
                        </div>
                        
                        {/* Tabs Visual/HTML - ES */}
                        <div className="space-y-2">
                          <div className="flex gap-2 border-b border-border">
                            <Button
                              variant={contentEditorModeES === 'visual' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setContentEditorModeES('visual')}
                            >
                              📝 Visual
                            </Button>
                            <Button
                              variant={contentEditorModeES === 'html' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setContentEditorModeES('html')}
                            >
                              🔧 HTML
                            </Button>
                          </div>
                          
                          {contentEditorModeES === 'visual' ? (
                            <KnowledgeEditor
                              content={contentES}
                              onChange={setContentES}
                              onEditorReady={(editor) => {
                                editorRefES.current = editor;
                              }}
                            />
                          ) : (
                            <Textarea 
                              className="font-mono text-sm min-h-[400px] bg-card"
                              placeholder="<div>Conteúdo em espanhol...</div>"
                              value={contentES}
                              onChange={(e) => setContentES(e.target.value)}
                            />
                          )}
                          
                          {/* Preview HTML ES */}
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              👁️ Preview HTML (ES)
                            </summary>
                            <div className="mt-2 p-4 border border-border rounded-lg bg-card">
                              <BlogPreviewFrame 
                                htmlContent={contentES} 
                                deviceMode="desktop" 
                              />
                            </div>
                          </details>
                        </div>
                        
                        {/* FAQs ES */}
                        {faqsES.length > 0 && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs font-semibold mb-2">📋 FAQs traduzidos ({faqsES.length})</p>
                            <div className="space-y-2 text-xs">
                              {faqsES.map((faq, idx) => (
                                <div key={idx} className="p-2 bg-card rounded border">
                                  <p className="font-semibold">{faq.question}</p>
                                  <p className="text-muted-foreground">{faq.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ========== EDITOR INGLÊS ========== */}
                  <div className="mt-6 border-t pt-6">
                    {!showEditorEN ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => translateContent('en')}
                        disabled={!formData.content_html || translating || !showEditorES}
                        className="w-full"
                      >
                        {translating && translatingLanguage === 'en' ? (
                          <>⏳ Traduzindo para Inglês...</>
                        ) : (
                          <>
                            ➕ Adicionar Versão em Inglês (EN) 🇺🇸
                            {!showEditorES && <span className="ml-2 text-xs">(Adicione ES primeiro)</span>}
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-lg font-semibold">
                            🇺🇸 Versão em Inglês
                          </Label>
                          <div className="flex gap-2">
                            {/* Botão Refazer Tradução */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={retranslateEnglish}
                              disabled={!formData.content_html || translating}
                            >
                              {translating && translatingLanguage === 'en' ? (
                                <>⏳ Translating...</>
                              ) : (
                                <>🔄 Retranslate</>
                              )}
                            </Button>
                            {/* Botão Excluir */}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={clearEnglishContent}
                            >
                              🗑️ Delete
                            </Button>
                            {/* Botão Recolher */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowEditorEN(false)}
                            >
                              ▲ Collapse
                            </Button>
                          </div>
                        </div>
                        
                        {/* Título e Resumo EN */}
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <Label className="text-sm">Título (EN)</Label>
                            <Input
                              value={titleEN}
                              onChange={(e) => setTitleEN(e.target.value)}
                              placeholder="Translated title..."
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Resumo (EN) - max 160 chars</Label>
                            <Textarea
                              value={excerptEN}
                              onChange={(e) => setExcerptEN(e.target.value)}
                              maxLength={160}
                              placeholder="Translated excerpt..."
                              className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {excerptEN.length}/160
                            </p>
                          </div>
                        </div>
                        
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            💡 <strong>Tip:</strong> Content was automatically translated. 
                            Only replace images containing Portuguese text. 
                            Links and formatting were preserved automatically.
                          </AlertDescription>
                        </Alert>

                        {/* Seleção de PDFs - EN */}
                        <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                          <Label className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-3">
                            <span className="text-xl">📄</span>
                            PDFs Incorporados (EN) - aparecem no topo do artigo
                          </Label>
                          
                          {/* Campo de busca */}
                          <div className="mb-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-600" />
                              <Input
                                type="text"
                                placeholder="Search PDF by name, product or manufacturer..."
                                value={pdfSearchEN}
                                onChange={(e) => setPdfSearchEN(e.target.value)}
                                className="pl-10 pr-10 bg-white dark:bg-gray-900 border-amber-300 focus:border-amber-500"
                              />
                              {pdfSearchEN && (
                                <button
                                  onClick={() => setPdfSearchEN('')}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-amber-100 dark:hover:bg-amber-900 rounded p-1"
                                  title="Clear search"
                                >
                                  <X className="h-4 w-4 text-amber-600" />
                                </button>
                              )}
                            </div>
                            {pdfSearchEN && (
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-amber-600">
                                  🔍 {filterDocuments(pdfSearchEN).length} result(s) found
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="max-h-[200px] w-full overflow-y-auto overflow-x-hidden border border-border/30 rounded p-2">
                            <div className="space-y-2">
                              {filterDocuments(pdfSearchEN).length === 0 && pdfSearchEN && documents.length > 0 && (
                                <p className="text-sm text-amber-700 dark:text-amber-300 p-2">
                                  No PDF found for "{pdfSearchEN}"
                                </p>
                              )}
                              {filterDocuments(pdfSearchEN).map((doc) => (
                                <label key={doc.id} className="flex items-start gap-3 p-2 rounded hover:bg-amber-100/50 dark:hover:bg-amber-900/30 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.selected_pdf_ids_en.includes(doc.id)}
                                    onChange={(e) => {
                                      const newIds = e.target.checked
                                        ? [...formData.selected_pdf_ids_en, doc.id]
                                        : formData.selected_pdf_ids_en.filter(id => id !== doc.id);
                                      setFormData({ ...formData, selected_pdf_ids_en: newIds });
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 text-sm">
                                    <p className="font-medium text-amber-900 dark:text-amber-100">
                                      {doc.document_name}
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                      {doc.product_name}
                                      {doc.manufacturer && ` - ${doc.manufacturer}`}
                                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900">
                                        {doc.source === 'resin' ? '🧪 Resina' : '📦 Catálogo'}
                                      </span>
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                          {formData.selected_pdf_ids_en.length > 0 && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                              ✓ {formData.selected_pdf_ids_en.length} PDF(s) selecionado(s)
                            </p>
                          )}
                        </div>
                        
                        {/* Tabs Visual/HTML - EN */}
                        <div className="space-y-2">
                          <div className="flex gap-2 border-b border-border">
                            <Button
                              variant={contentEditorModeEN === 'visual' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setContentEditorModeEN('visual')}
                            >
                              📝 Visual
                            </Button>
                            <Button
                              variant={contentEditorModeEN === 'html' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setContentEditorModeEN('html')}
                            >
                              🔧 HTML
                            </Button>
                          </div>
                          
                          {contentEditorModeEN === 'visual' ? (
                            <KnowledgeEditor
                              content={contentEN}
                              onChange={setContentEN}
                              onEditorReady={(editor) => {
                                editorRefEN.current = editor;
                              }}
                            />
                          ) : (
                            <Textarea 
                              className="font-mono text-sm min-h-[400px] bg-card"
                              placeholder="<div>Content in English...</div>"
                              value={contentEN}
                              onChange={(e) => setContentEN(e.target.value)}
                            />
                          )}
                          
                          {/* Preview HTML EN */}
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              👁️ Preview HTML (EN)
                            </summary>
                            <div className="mt-2 p-4 border border-border rounded-lg bg-card">
                              <BlogPreviewFrame 
                                htmlContent={contentEN} 
                                deviceMode="desktop" 
                              />
                            </div>
                          </details>
                        </div>
                        
                        {/* FAQs EN */}
                        {faqsEN.length > 0 && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs font-semibold mb-2">📋 Translated FAQs ({faqsEN.length})</p>
                            <div className="space-y-2 text-xs">
                              {faqsEN.map((faq, idx) => (
                                <div key={idx} className="p-2 bg-card rounded border">
                                  <p className="font-semibold">{faq.question}</p>
                                  <p className="text-muted-foreground">{faq.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* AI Generation Tab */}
              <TabsContent value="ai-generation" className="space-y-4">
                {/* Auto-apply and Auto-save switches */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-apply-ia">Aplicar automaticamente no editor</Label>
                    <Switch
                      id="auto-apply-ia"
                      checked={autoApplyIA}
                      onCheckedChange={(checked) => {
                        setAutoApplyIA(checked);
                        localStorage.setItem('adminKnowledge_autoApplyIA', String(checked));
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-save-after-gen">Salvar automaticamente após gerar</Label>
                    <Switch
                      id="auto-save-after-gen"
                      checked={autoSaveAfterGen}
                      onCheckedChange={(checked) => {
                        setAutoSaveAfterGen(checked);
                        localStorage.setItem('adminKnowledge_autoSaveAfterGen', String(checked));
                      }}
                    />
                  </div>
                  {autoSaveAfterGen && (
                    <p className="text-xs text-muted-foreground">
                      ⚠️ O conteúdo será salvo automaticamente após gerar. Certifique-se de que Título e Resumo estão preenchidos.
                    </p>
                  )}
                </div>

                {/* Pending auto-save warning */}
                {pendingAutoSave && (
                  <div className="p-4 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg space-y-3">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      ⚠️ Alterações aplicadas e não salvas
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          handleSaveContent();
                        }}
                      >
                        💾 Salvar agora
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (previousHTML !== null) {
                            setFormData({ ...formData, content_html: previousHTML });
                            if (contentEditorMode === 'visual' && editorRef.current) {
                              editorRef.current.commands.setContent(previousHTML);
                            }
                          }
                          setPendingAutoSave(false);
                          setPreviousHTML(null);
                          toast({ title: '↩️ Desfeito', description: 'Conteúdo anterior restaurado' });
                        }}
                      >
                        ↩️ Desfazer
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Instruções visuais */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📝 Como usar a geração por IA:</h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-decimal">
                    <li>Configure o prompt abaixo (ou use o padrão)</li>
                    <li>Cole o texto bruto (Word, Gemini, Google Docs, etc.)</li>
                    <li>Clique em "🚀 Gerar por IA" e aguarde ~5-10 segundos</li>
                    <li>Revise o HTML gerado no preview</li>
                    <li>Clique em "💾 Inserir e Salvar" para aplicar automaticamente</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Prompt IA para padronização</Label>
                    {promptEdited && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">⚠️ Prompt alterado (clique em Salvar)</span>
                    )}
                  </div>
                  <Textarea
                    value={formData.aiPromptTemplate || DEFAULT_AI_PROMPT}
                    onChange={(e) => {
                      setFormData({...formData, aiPromptTemplate: e.target.value});
                      setPromptEdited(true);
                    }}
                    rows={8}
                    placeholder="Configure como a IA deve formatar..."
                     className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 <strong>Nota:</strong> A IA recebe automaticamente as palavras-chave aprovadas listadas abaixo e as usa para criar hyperlinks no conteúdo.
                  </p>
                  
                  {/* Botões Salvar Prompt e Restaurar */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!editingContent) return;
                        
                        setSavingPrompt(true);
                        try {
                          await updateContent(editingContent.id, {
                            ai_prompt_template: formData.aiPromptTemplate || null
                          } as any);
                          
                          setPromptEdited(false);
                          toast({
                            title: '✅ Prompt salvo!',
                            description: 'Será usado nas próximas gerações por IA'
                          });
                        } catch (error: any) {
                          toast({
                            title: '❌ Erro ao salvar',
                            description: error?.message || 'Tente novamente',
                            variant: 'destructive'
                          });
                        } finally {
                          setSavingPrompt(false);
                        }
                      }}
                      disabled={!promptEdited || !editingContent || savingPrompt}
                    >
                      {savingPrompt ? '⏳' : '💾'} Salvar Prompt
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({...formData, aiPromptTemplate: DEFAULT_AI_PROMPT});
                        setPromptEdited(true);
                      }}
                    >
                     🔄 Restaurar padrão
                    </Button>
                  </div>
                </div>

                {/* 🆕 Lista de Keywords Disponíveis */}
                <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">
                      🔗 Palavras-chave disponíveis para hyperlinks
                    </h4>
                    <Button size="sm" variant="ghost" onClick={() => setShowKeywords(!showKeywords)}>
                      {showKeywords ? '▼ Ocultar' : '▶ Mostrar'}
                    </Button>
                  </div>
                  
                  {showKeywords && (
                    <div className="space-y-2">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        A IA usará automaticamente estas palavras-chave para criar hyperlinks no conteúdo gerado:
                      </p>
                      
                      <ScrollArea className="h-[200px] w-full rounded-md border border-purple-300 dark:border-purple-700 p-3 bg-white dark:bg-card">
                        <div className="space-y-2">
                          {keywords.map((kw) => {
                            const isEditing = editingKeywordId === kw.id;
                            const isSaving = savingKeywordId === kw.id;
                            
                            return (
                              <div 
                                key={kw.id} 
                                className="group flex items-center gap-2 text-xs p-2 bg-purple-100 dark:bg-purple-900/30 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                              >
                                <span className="font-mono text-purple-900 dark:text-purple-100 font-semibold min-w-[150px]">
                                  {kw.name}
                                </span>
                                
                                <span className="text-purple-600 dark:text-purple-400">→</span>
                                
                                {isEditing ? (
                                  <>
                                    <Input
                                      type="url"
                                      value={editingUrl}
                                      onChange={(e) => setEditingUrl(e.target.value)}
                                      className="flex-1 h-7 text-xs"
                                      placeholder="https://exemplo.com"
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      disabled={isSaving}
                                      onClick={async () => {
                                        // Validar URL
                                        try {
                                          new URL(editingUrl);
                                        } catch {
                                          toast({
                                            title: '⚠️ URL inválida',
                                            description: 'Por favor, insira uma URL válida (ex: https://exemplo.com)',
                                            variant: 'destructive'
                                          });
                                          return;
                                        }
                                        
                                        setSavingKeywordId(kw.id);
                                        const success = await updateKeywordUrl(kw.id, editingUrl);
                                        setSavingKeywordId(null);
                                        
                                        if (success) {
                                          setEditingKeywordId(null);
                                          setEditingUrl('');
                                        }
                                      }}
                                    >
                                      {isSaving ? '⏳' : '✓'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      disabled={isSaving}
                                      onClick={() => {
                                        setEditingKeywordId(null);
                                        setEditingUrl('');
                                      }}
                                    >
                                      ✕
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <a 
                                      href={kw.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-purple-700 dark:text-purple-300 hover:underline truncate flex-1"
                                      title={kw.url}
                                    >
                                      {kw.url}
                                    </a>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => {
                                        setEditingKeywordId(kw.id);
                                        setEditingUrl(kw.url);
                                      }}
                                    >
                                      ✏️
                                    </Button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        📊 Total: <strong>{keywords.length} keywords aprovadas</strong> no sistema
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={useOrchestrator}
                      onCheckedChange={(checked) => {
                        setUseOrchestrator(checked);
                      if (checked) {
                        // Limpar campo único quando ativar orquestrador
                        setRawTextInput('');
                      } else {
                        // Limpar todas as fontes do orquestrador ao desativar
                        setOrchestratorActiveSources({
                          rawText: false,
                          pdfTranscription: false,
                          videoTranscription: false,
                          relatedPdfs: false
                        });
                        setOrchestratorExtractedData({
                          rawText: '',
                          pdfTranscription: '',
                          videoTranscription: '',
                          relatedPdfs: []
                        });
                      }
                      }}
                    />
                    <div>
                      <Label className="text-sm font-semibold cursor-pointer">
                        🎯 Modo Orquestrador Multi-Fonte
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {useOrchestrator 
                          ? '✅ Geração avançada com múltiplas fontes (ficha técnica + vídeo + manual + depoimentos)'
                          : '📄 Geração rápida com fonte única (texto ou PDF)'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={useOrchestrator ? "default" : "secondary"}>
                    {useOrchestrator ? 'Orquestrador' : 'Pipeline Rápido'}
                  </Badge>
                </div>

                {!useOrchestrator ? (
                  // Modo tradicional (fonte única)
                  <>
                    <div>
                      <Label>Cole o texto bruto aqui (Word, Gemini, Google Docs...)</Label>
                      <Textarea
                        value={rawTextInput}
                        onChange={(e) => setRawTextInput(e.target.value)}
                        rows={12}
                        placeholder="Cole aqui o texto que deseja formatar automaticamente..."
                      />
                    </div>

                    <PDFTranscription
                      onTextExtracted={(text) => {
                        setRawTextInput(text);
                        toast({ 
                          title: '✅ PDF transcrito!', 
                          description: 'Revise o texto e clique em "Gerar por IA"' 
                        });
                      }}
                      disabled={isGenerating}
                    />
                  </>
                ) : (
                  // Modo orquestrador (múltiplas fontes - NOVO SISTEMA)
                  <div className="space-y-4 border border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>🎯 Orquestrador Multi-Fonte:</strong> Selecione as fontes de conteúdo abaixo. 
                        A IA extrairá automaticamente as informações e gerará um único artigo coeso.
                        <br /><br />
                        <strong>✅ Fontes ativas:</strong> {Object.values(orchestratorActiveSources).filter(Boolean).length} / 4
                      </AlertDescription>
                    </Alert>

                    {/* =========== FONTE 1: TEXTO COLADO =========== */}
                    <div className="border rounded-lg p-4 space-y-3 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={orchestratorActiveSources.rawText}
                            onChange={(e) => {
                              setOrchestratorActiveSources(prev => ({
                                ...prev,
                                rawText: e.target.checked
                              }));
                              if (!e.target.checked) {
                                setOrchestratorExtractedData(prev => ({ ...prev, rawText: '' }));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          📝 Texto Colado
                        </Label>
                        {orchestratorActiveSources.rawText && (
                          <Badge variant="default">✓ Ativa</Badge>
                        )}
                      </div>
                      
                      {orchestratorActiveSources.rawText && (
                        <>
                          <Textarea
                            value={orchestratorExtractedData.rawText}
                            onChange={(e) => setOrchestratorExtractedData(prev => ({
                              ...prev,
                              rawText: e.target.value
                            }))}
                            rows={6}
                            placeholder="Cole aqui texto de Word, Gemini, Google Docs..."
                          />
                          <p className="text-xs text-muted-foreground">
                            {orchestratorExtractedData.rawText.length} caracteres
                          </p>
                        </>
                      )}
                    </div>

                    {/* =========== FONTE 2: PDF UPLOAD =========== */}
                    <div className="border rounded-lg p-4 space-y-3 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={orchestratorActiveSources.pdfTranscription}
                            onChange={(e) => {
                              setOrchestratorActiveSources(prev => ({
                                ...prev,
                                pdfTranscription: e.target.checked
                              }));
                              if (!e.target.checked) {
                                setOrchestratorExtractedData(prev => ({ ...prev, pdfTranscription: '' }));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          📄 Upload de PDF para Transcrição
                        </Label>
                        {orchestratorActiveSources.pdfTranscription && (
                          <Badge variant="default">✓ Ativa</Badge>
                        )}
                      </div>
                      
                      {orchestratorActiveSources.pdfTranscription && (
                        <>
                          <PDFTranscription
                            autoInsert={true}
                            onTextExtracted={(text) => {
                              console.log('🔍 PDF transcrito no orquestrador:', text.length, 'caracteres');
                              setOrchestratorExtractedData(prev => ({
                                ...prev,
                                pdfTranscription: text
                              }));
                              toast({ 
                                title: '✅ PDF transcrito para orquestrador!', 
                                description: `${text.length} caracteres adicionados às fontes` 
                              });
                            }}
                            disabled={isGenerating}
                          />
                          {orchestratorExtractedData.pdfTranscription && (
                            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                              <AlertDescription className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800 dark:text-green-200">
                                  {orchestratorExtractedData.pdfTranscription.length} caracteres extraídos
                                </span>
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      )}
                    </div>

                    {/* =========== FONTE 3: TRANSCRIÇÃO DE VÍDEO =========== */}
                    <div className="border rounded-lg p-4 space-y-3 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={orchestratorActiveSources.videoTranscription}
                            onChange={(e) => {
                              setOrchestratorActiveSources(prev => ({
                                ...prev,
                                videoTranscription: e.target.checked
                              }));
                              if (!e.target.checked) {
                                setOrchestratorExtractedData(prev => ({ ...prev, videoTranscription: '' }));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          🎬 Transcrição de Vídeo
                        </Label>
                        {orchestratorActiveSources.videoTranscription && (
                          <Badge variant="default">✓ Ativa</Badge>
                        )}
                      </div>
                      
                      {orchestratorActiveSources.videoTranscription && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setVideoSelectorOpen(true)}
                            className="w-full"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Selecionar Vídeo para Transcrever
                          </Button>
                          {orchestratorExtractedData.videoTranscription && (
                            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                              <AlertDescription className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800 dark:text-green-200">
                                  {orchestratorExtractedData.videoTranscription.length} caracteres extraídos
                                </span>
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      )}
                    </div>

                {/* =========== FONTE 4: PDFs JÁ EXISTENTES =========== */}
                <div className="border rounded-lg p-4 space-y-3 bg-background">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orchestratorActiveSources.relatedPdfs}
                        onChange={(e) => {
                          setOrchestratorActiveSources(prev => ({
                            ...prev,
                            relatedPdfs: e.target.checked
                          }));
                          if (!e.target.checked) {
                            setOrchestratorExtractedData(prev => ({ ...prev, relatedPdfs: [] }));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      📚 PDFs da Base de Conhecimento
                    </Label>
                    {orchestratorActiveSources.relatedPdfs && (
                      <Badge variant="default">✓ Ativa</Badge>
                    )}
                  </div>
                  
                  {orchestratorActiveSources.relatedPdfs && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Selecione PDFs já inseridos na base para usar como fonte complementar. 
                        Cada PDF será transcrito automaticamente pela IA.
                      </p>

                      {/* Feedback de PDFs transcritos */}
                      {orchestratorExtractedData.relatedPdfs.length > 0 && (
                        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <AlertDescription className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                {orchestratorExtractedData.relatedPdfs.length} PDF(s) transcritos
                              </span>
                            </div>
                            <div className="space-y-1 pl-6">
                              {orchestratorExtractedData.relatedPdfs.map(pdf => (
                                <div key={pdf.id} className="flex items-center justify-between text-xs text-green-700 dark:text-green-300">
                                  <span>• {pdf.name} ({pdf.content.length} caracteres)</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemovePdfFromOrchestrator(pdf.id)}
                                    className="h-6 px-2 text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Campo de busca */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome do PDF, produto ou fabricante..."
                          value={pdfSearchOrchestrator}
                          onChange={(e) => setPdfSearchOrchestrator(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {/* Lista de PDFs disponíveis */}
                      <ScrollArea className="h-80 border rounded-lg">
                        <div className="p-3 space-y-2">
                          {loading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : filterDocuments(pdfSearchOrchestrator).length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-8">
                              Nenhum PDF encontrado
                            </p>
                          ) : (
                            filterDocuments(pdfSearchOrchestrator).map(doc => {
                              const isTranscribing = transcribingOrchestratorPdfs.has(doc.id);
                              const isTranscribed = orchestratorExtractedData.relatedPdfs.some(pdf => pdf.id === doc.id);
                              
                              return (
                                <div 
                                  key={doc.id} 
                                  className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                                    isTranscribed 
                                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                                      : 'bg-background hover:bg-accent'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm font-medium truncate">
                                        {doc.document_name}
                                      </span>
                                      {isTranscribed && (
                                        <Badge variant="default" className="shrink-0 bg-green-600">
                                          ✓ Adicionado
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {doc.product_name}
                                      {doc.manufacturer && ` • ${doc.manufacturer}`}
                                    </p>
                                    {isTranscribing && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {orchestratorPdfProgress[doc.id] || 'Processando...'}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <Button
                                    size="sm"
                                    variant={isTranscribed ? "outline" : "default"}
                                    onClick={() => {
                                      if (isTranscribed) {
                                        handleRemovePdfFromOrchestrator(doc.id);
                                      } else {
                                        handleTranscribePdfForOrchestrator(doc);
                                      }
                                    }}
                                    disabled={isTranscribing}
                                    className="shrink-0"
                                  >
                                    {isTranscribing ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : isTranscribed ? (
                                      'Remover'
                                    ) : (
                                      'Adicionar'
                                    )}
                                  </Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>

                      {documents.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          💡 Dica: PDFs transcritos usarão créditos de IA. Selecione apenas os mais relevantes.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* =========== RESUMO DAS FONTES =========== */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3">📊 Resumo das Fontes Selecionadas</h4>
                  <div className="space-y-2 text-sm">
                    {orchestratorExtractedData.rawText && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>📝 Texto Colado: {orchestratorExtractedData.rawText.length} caracteres</span>
                      </div>
                    )}
                    {orchestratorExtractedData.pdfTranscription && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>📄 PDF Upload: {orchestratorExtractedData.pdfTranscription.length} caracteres</span>
                      </div>
                    )}
                    {orchestratorExtractedData.videoTranscription && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>🎬 Vídeo: {orchestratorExtractedData.videoTranscription.length} caracteres</span>
                      </div>
                    )}
                    {orchestratorExtractedData.relatedPdfs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>📚 PDFs da Base: {orchestratorExtractedData.relatedPdfs.length} PDF(s) • {
                          orchestratorExtractedData.relatedPdfs.reduce((sum, pdf) => sum + pdf.content.length, 0)
                        } caracteres</span>
                      </div>
                    )}
                    
                    {Object.values(orchestratorActiveSources).every(v => !v) && (
                      <p className="text-muted-foreground italic">Nenhuma fonte selecionada</p>
                    )}
                  </div>
                </div>

                {/* =========== BOTÃO GERAR POR IA (PARALELIZADO) =========== */}
                <Button
                  onClick={handleGenerateCompleteArticle}
                  disabled={
                    isGenerating || 
                    Object.values(orchestratorActiveSources).every(v => !v)
                  }
                  className="w-full mt-4"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando conteúdo em paralelo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      🚀 Gerar por IA (Otimizado - 60% mais rápido)
                    </>
                  )}
                </Button>

                {/* =========== PREVIEW DO HTML GERADO =========== */}
                {generatedHTML && (
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <h4 className="font-semibold">📱 Preview do Conteúdo Gerado</h4>
                    
                    {/* Device Mode Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'mobile' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('mobile')}
                      >
                        📱 Mobile
                      </Button>
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'tablet' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('tablet')}
                      >
                        📱 Tablet
                      </Button>
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'desktop' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('desktop')}
                      >
                        💻 Desktop
                      </Button>
                    </div>
                    
                    {/* Preview Frame */}
                    <div className="border rounded-lg bg-white dark:bg-card" style={{ height: '500px' }}>
                      <BlogPreviewFrame htmlContent={generatedHTML || ''} deviceMode={deviceMode} />
                    </div>
                    
                    {/* ✅ NOVO: Preview das FAQs separadas */}
                    {generatedFAQs && generatedFAQs.length > 0 && (
                      <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                          <HelpCircle className="w-5 h-5" />
                          📋 FAQs Geradas ({generatedFAQs.length})
                        </h3>
                        <ScrollArea className="h-60">
                          <div className="space-y-2 pr-4">
                            {generatedFAQs.map((faq, idx) => (
                              <div key={idx} className="p-3 bg-background rounded border">
                                <p className="font-medium text-sm mb-1">{idx + 1}. {faq.question}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{faq.answer}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                    
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleInsertGeneratedHTML}
                      >
                        ➕ Inserir HTML + FAQs
                      </Button>
                      
                      <Button 
                        onClick={() => {
                          setGeneratedHTML(null);
                          setGeneratedFAQs(null);
                        }}
                      >
                        🗑️ Descartar Preview
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* ========== ANTIGO CÓDIGO (NÃO USADO) ========== */}
                {false && generatedHTML && (
                  <div className="mt-4">
                    {/* Seletor de dispositivos */}
                    <div className="flex gap-2 mb-2">
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'mobile' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('mobile')}
                      >
                        📱 Mobile
                      </Button>
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'tablet' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('tablet')}
                      >
                        📱 Tablet
                      </Button>
                      <Button 
                        size="sm" 
                        variant={deviceMode === 'desktop' ? 'default' : 'outline'}
                        onClick={() => setDeviceMode('desktop')}
                      >
                        💻 Desktop
                      </Button>
                    </div>
                    
                    {/* Preview Frame */}
                    <div className="border rounded-lg bg-white dark:bg-card" style={{ height: '500px' }}>
                      <BlogPreviewFrame htmlContent={generatedHTML} deviceMode={deviceMode} />
                    </div>
                    
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, content_html: generatedHTML});
                          toast({ title: '✅ Inserido!', description: 'Revise na aba "📝 Conteúdo" e salve manualmente' });
                        }}
                      >
                        ➕ Inserir no Editor (sem salvar)
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          // Validação: Campos obrigatórios
                          if (!formData.title || !formData.excerpt) {
                            toast({ 
                              title: '⚠️ Campos obrigatórios', 
                              description: 'Preencha Título e Resumo antes de salvar', 
                              variant: 'destructive' 
                            });
                            return;
                          }
                          
                          // ✅ Validação de conteúdo gerado
                          if (!generatedHTML || generatedHTML.trim().length === 0) {
                            toast({ 
                              title: '⚠️ Conteúdo vazio', 
                              description: 'Gere o conteúdo com IA antes de salvar', 
                              variant: 'destructive' 
                            });
                            return;
                          }
                          
                          // 🆕 FASE 1: MERGE - Extrair imagens do editor manual
                          const extractImages = (html: string): string[] => {
                            const imgRegex = /<img[^>]+>/g;
                            return html.match(imgRegex) || [];
                          };
                          
                          const editorHTML = formData.content_html || '';
                          const manualImages = extractImages(editorHTML);
                          
                          // 🆕 FASE 1: MERGE - Adicionar imagens manuais ao conteúdo gerado pela IA
                          let finalHTML = generatedHTML;
                          if (manualImages.length > 0) {
                            console.log(`🖼️ ${manualImages.length} imagens encontradas no editor, fazendo merge...`);
                            // Inserir imagens no início do conteúdo (após o primeiro <h2>)
                            const firstH2Index = finalHTML.indexOf('</h2>');
                            if (firstH2Index !== -1) {
                              const imageSection = manualImages
                                .map(img => `<figure class="content-image">${img}<figcaption>Imagem ilustrativa</figcaption></figure>`)
                                .join('\n');
                              
                              finalHTML = 
                                finalHTML.substring(0, firstH2Index + 5) + 
                                '\n' + imageSection + '\n' +
                                finalHTML.substring(firstH2Index + 5);
                            }
                          }
                          
                            try {
                              const categoryId = categories.find(c => c.letter === selectedCategory)?.id;
                              
                const contentData = {
                                title: formData.title,
                                slug: formData.slug || generateSlug(formData.title),
                                excerpt: formData.excerpt,
                                content_html: finalHTML,
                                icon_color: formData.icon_color,
                                meta_description: formData.meta_description,
                                og_image_url: formData.og_image_url,
                                content_image_url: formData.content_image_url,
                                content_image_alt: formData.content_image_alt,
                                canva_template_url: formData.canva_template_url,
                                file_url: formData.file_url,
                                file_name: formData.file_name,
                                author_id: formData.author_id,
                                faqs: formData.faqs,
                                order_index: formData.order_index,
                                active: formData.active,
                                ai_prompt_template: formData.aiPromptTemplate || null,
                                category_id: categoryId,
                                recommended_resins: formData.recommended_resins?.length > 0 ? formData.recommended_resins : null,
                              };

                              if (editingContent) {
                                await updateContent(editingContent.id, contentData);
                              } else {
                                const newContent = await insertContent(contentData);
                                if (newContent) {
                                  setEditingContent(newContent);
                                }
                              }
                              
                              setFormData(prev => ({
                                ...prev, 
                                content_html: finalHTML
                              }));
                              setGeneratedHTML(finalHTML);
                              
                              toast({ 
                                title: '✅ Salvo com sucesso!', 
                                description: 'Conteúdo gerado e salvo automaticamente' 
                              });
                              
                              await loadContents();
                            } catch (error: any) {
                              console.error('❌ Erro ao salvar:', error);
                              toast({ 
                                title: '❌ Erro ao salvar', 
                                description: error?.message || 'Verifique os campos e tente novamente.', 
                                variant: 'destructive' 
                              });
                              return;
                            }
                        }}
                      >
                        💾 Inserir e Salvar Automaticamente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

              {/* SEO Tab */}
              <TabsContent value="seo" className="space-y-4">
                {/* 🆕 Botão de Geração Automática de Metadados */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    🪄 Geração Automática por IA
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Gere automaticamente Slug e Meta Description baseados no título e conteúdo.
                  </p>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!formData.title || !formData.content_html) {
                          toast({
                            title: '⚠️ Campos obrigatórios',
                            description: 'Preencha Título e Conteúdo antes de gerar metadados',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        setIsGeneratingMetadata(true);
                        
                        try {
                          const { data, error } = await invokeWithTimeout('ai-metadata-generator', {
                            title: formData.title,
                            contentHTML: formData.content_html,
                            existingSlug: formData.slug,
                            existingMetaDesc: formData.meta_description,
                            existingFaqs: formData.faqs,
                            regenerate: {
                              slug: !formData.slug,
                              metaDescription: !formData.meta_description,
                              faqs: formData.faqs.length === 0
                            }
                          }) as any;
                          
                          if (error) throw error;
                          
                          setFormData(prev => ({
                            ...prev,
                            slug: data.slug,
                            meta_description: data.metaDescription,
                            keywords: data.keywords || [],
                            faqs: data.faqs
                          }));
                          
                          toast({
                            title: '✅ Metadados gerados!',
                            description: `Slug, Meta Description, ${data.keywords?.length || 0} Keywords e ${data.faqs.length} FAQs criados por IA`,
                          });
                        } catch (err: any) {
                          console.error('❌ Erro ao gerar metadados:', err);
                          toast({
                            title: '❌ Erro na geração',
                            description: err.message || 'Tente novamente',
                            variant: 'destructive'
                          });
                        } finally {
                          setIsGeneratingMetadata(false);
                        }
                      }}
                      disabled={isGeneratingMetadata || !formData.title || !formData.content_html}
                    >
                      {isGeneratingMetadata ? '⏳ Gerando...' : '🪄 Gerar Campos Vazios'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="default"
                      onClick={async () => {
                        if (!formData.title || !formData.content_html) {
                          toast({
                            title: '⚠️ Campos obrigatórios',
                            description: 'Preencha Título e Conteúdo antes de gerar metadados',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        setIsGeneratingMetadata(true);
                        
                        try {
                          const { data, error } = await invokeWithTimeout('ai-metadata-generator', {
                            title: formData.title,
                            contentHTML: formData.content_html,
                            existingSlug: formData.slug,
                            existingMetaDesc: formData.meta_description,
                            existingFaqs: formData.faqs,
                            regenerate: {
                              slug: true,
                              metaDescription: true,
                              faqs: true
                            }
                          }) as any;
                          
                          if (error) throw error;
                          
                          setFormData(prev => ({
                            ...prev,
                            slug: data.slug,
                            meta_description: data.metaDescription,
                            keywords: data.keywords || [],
                            faqs: data.faqs
                          }));
                          
                          toast({
                            title: '✅ Todos os metadados regenerados!',
                            description: `Slug, Meta Description, ${data.keywords?.length || 0} Keywords e ${data.faqs.length} FAQs atualizados`,
                          });
                        } catch (err: any) {
                          console.error('❌ Erro ao regenerar metadados:', err);
                          toast({
                            title: '❌ Erro na regeneração',
                            description: err.message || 'Tente novamente',
                            variant: 'destructive'
                          });
                        } finally {
                          setIsGeneratingMetadata(false);
                        }
                      }}
                      disabled={isGeneratingMetadata || !formData.title || !formData.content_html}
                    >
                      {isGeneratingMetadata ? '⏳ Gerando...' : '🔄 Regenerar Todos'}
                    </Button>
                  </div>
                  
                  {(!formData.title || !formData.content_html) && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      ⚠️ Preencha Título e Conteúdo antes de gerar metadados
                    </p>
                  )}
                </div>

                <div>
                  <Label>Slug (URL)</Label>
                  <Input 
                    placeholder="como-calibrar-impressora" 
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Meta Description</Label>
                  <Textarea 
                    maxLength={160}
                    value={formData.meta_description}
                    onChange={(e) => setFormData({...formData, meta_description: e.target.value})}
                  />
                </div>
                {/* Content Hero Image Upload */}
                <div className="space-y-2">
                  <Label>Imagem Principal do Artigo (Hero)</Label>
                  <ImageUpload
                    currentImageUrl={formData.content_image_url}
                    currentImageAlt={formData.content_image_alt}
                    onImageUploaded={(url, alt) => {
                      setFormData(prev => ({
                        ...prev,
                        content_image_url: url,
                        content_image_alt: alt,
                        // ✅ Se OG estiver vazia, usa a Hero automaticamente
                        og_image_url: prev.og_image_url || url
                      }));
                    }}
                    modelSlug={formData.slug || 'hero-temp'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Imagem principal exibida nos cards e no topo do artigo.
                    <strong> Será usada automaticamente como OG Image se você não enviar uma específica.</strong>
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Imagem OG (Open Graph) - Redes Sociais <span className="text-muted-foreground">(Opcional)</span></Label>
                  <Input 
                    placeholder="https://... (ou envie abaixo)" 
                    value={formData.og_image_url}
                    onChange={(e) => setFormData({...formData, og_image_url: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, usaremos automaticamente a Imagem Hero. Envie apenas se quiser uma imagem diferente para redes sociais (ideal: 1200x630px).
                  </p>
                  
                  {/* Preview and Remove */}
                  {formData.og_image_url && (
                    <div className="space-y-2">
                      <img 
                        src={formData.og_image_url} 
                        alt="OG Preview" 
                        className="w-full max-h-40 object-cover rounded border border-border"
                      />
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setFormData({ ...formData, og_image_url: '' })}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  )}
                  
                  {/* Upload Button and Template Canva */}
                  <div className="flex gap-2 flex-wrap">
                    <input 
                      ref={ogFileRef} 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadOgImage(file);
                      }}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => ogFileRef.current?.click()}
                      disabled={uploadingOg}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingOg ? 'Enviando...' : 'Enviar imagem OG'}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const url = prompt('Cole a URL do Template Canva:');
                        if (url) {
                          setFormData({ ...formData, canva_template_url: url });
                          toast({ title: 'URL do Template Canva adicionada!' });
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Template Canva
                    </Button>
                  </div>
                  
                  {/* Display Canva URL if exists */}
                  {formData.canva_template_url && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                      <span className="text-muted-foreground">Template Canva:</span>
                      <a 
                        href={formData.canva_template_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Ver template
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setFormData({ ...formData, canva_template_url: '' })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* FAQs Tab */}
              <TabsContent value="faqs" className="space-y-4">
                {/* 🆕 Botão de Geração Automática de FAQs */}
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100">
                        🪄 Geração Automática de FAQs
                      </h4>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                        Gere 10 FAQs baseadas no conteúdo do artigo
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!formData.title || !formData.content_html) {
                          toast({
                            title: '⚠️ Campos obrigatórios',
                            description: 'Preencha Título e Conteúdo antes de gerar FAQs',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        setIsGeneratingMetadata(true);
                        
                        try {
                          const { data, error } = await supabase.functions.invoke('ai-metadata-generator', {
                            body: {
                              title: formData.title,
                              contentHTML: formData.content_html,
                              existingSlug: formData.slug,
                              existingMetaDesc: formData.meta_description,
                              existingFaqs: formData.faqs,
                              regenerate: {
                                slug: false,
                                metaDescription: false,
                                faqs: true
                              }
                            }
                          });
                          
                          if (error) throw error;
                          
                          setFormData(prev => ({
                            ...prev,
                            faqs: data.faqs
                          }));
                          
                          toast({
                            title: '✅ FAQs gerados!',
                            description: `${data.faqs.length} perguntas frequentes criadas por IA`,
                          });
                        } catch (err: any) {
                          console.error('❌ Erro ao gerar FAQs:', err);
                          toast({
                            title: '❌ Erro na geração',
                            description: err.message || 'Tente novamente',
                            variant: 'destructive'
                          });
                        } finally {
                          setIsGeneratingMetadata(false);
                        }
                      }}
                      disabled={isGeneratingMetadata || !formData.title || !formData.content_html}
                    >
                      {isGeneratingMetadata ? '⏳ Gerando...' : '🪄 Gerar 10 FAQs por IA'}
                    </Button>
                  </div>
                  
                  {(!formData.title || !formData.content_html) && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      ⚠️ Preencha Título e Conteúdo antes de gerar FAQs
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-lg font-semibold">Perguntas Frequentes (FAQs)</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adicione FAQs para melhorar o SEO e aparecer nos Featured Snippets do Google
                  </p>
                  
                  {formData.faqs.map((faq, idx) => (
                    <div key={idx} className="p-4 border border-border rounded-lg mt-3 bg-card space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold">FAQ #{idx + 1}</Label>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            const newFaqs = formData.faqs.filter((_, i) => i !== idx);
                            setFormData({ ...formData, faqs: newFaqs });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Pergunta</Label>
                        <Input 
                          placeholder="Ex: Como calibrar a impressora?"
                          value={faq.question}
                          onChange={(e) => {
                            const newFaqs = [...formData.faqs];
                            newFaqs[idx].question = e.target.value;
                            setFormData({ ...formData, faqs: newFaqs });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Resposta</Label>
                        <Textarea 
                          placeholder="Passo a passo detalhado..."
                          rows={3}
                          value={faq.answer}
                          onChange={(e) => {
                            const newFaqs = [...formData.faqs];
                            newFaqs[idx].answer = e.target.value;
                            setFormData({ ...formData, faqs: newFaqs });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        faqs: [...formData.faqs, { question: '', answer: '' }]
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    ADICIONAR FAQ
                  </Button>
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="space-y-6">
                {/* Resumo de Mídia */}
                <Card className="bg-muted/30 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      📊 Resumo de Mídia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Video className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{videos.length}</p>
                          <p className="text-xs text-muted-foreground">Vídeo{videos.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Upload className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formData.file_url ? '1' : '0'}</p>
                          <p className="text-xs text-muted-foreground">PDF</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{videos.length + (formData.file_url ? 1 : 0)}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </div>
                    
                    {videos.length === 0 && !formData.file_url && (
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhuma mídia adicionada. Você pode adicionar vídeos e/ou PDF para enriquecer o conteúdo.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Videos */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-lg font-semibold">Vídeos</Label>
                      {videos.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {videos.length} vídeo{videos.length !== 1 ? 's' : ''} adicionado{videos.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => setVideoSelectorOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Vídeo
                    </Button>
                  </div>

                  {videos.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-8 text-center">
                      <p className="text-muted-foreground mb-4">Nenhum vídeo adicionado</p>
                      <Button 
                        variant="outline"
                        onClick={() => setVideoSelectorOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Primeiro Vídeo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {videos.map((video, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 border border-border rounded-lg bg-card flex items-start gap-4"
                        >
                          {/* Thumbnail ou ícone */}
                          <div className="flex-shrink-0">
                            {video.video_type === 'pandavideo' && video.thumbnail_url ? (
                              <img 
                                src={video.thumbnail_url} 
                                alt={video.title}
                                className="w-32 h-20 object-cover rounded border border-border"
                              />
                            ) : (
                              <div className="w-32 h-20 bg-muted rounded border border-border flex items-center justify-center">
                                <Video className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-medium truncate">{video.title || 'Sem título'}</p>
                                {video.video_type === 'youtube' && video.url && (
                                  <p className="text-sm text-muted-foreground truncate mt-1">
                                    {video.url}
                                  </p>
                                )}
                                {video.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                    {video.description}
                                  </p>
                                )}
                              </div>
                              <Badge variant={video.video_type === 'youtube' ? 'secondary' : 'default'}>
                                {video.video_type === 'youtube' ? 'YouTube' : 'PandaVideo'}
                              </Badge>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (idx === 0) return;
                                const newVids = [...videos];
                                [newVids[idx], newVids[idx - 1]] = [newVids[idx - 1], newVids[idx]];
                                setVideos(newVids.map((v, i) => ({ ...v, order_index: i })));
                              }}
                              disabled={idx === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (idx === videos.length - 1) return;
                                const newVids = [...videos];
                                [newVids[idx], newVids[idx + 1]] = [newVids[idx + 1], newVids[idx]];
                                setVideos(newVids.map((v, i) => ({ ...v, order_index: i })));
                              }}
                              disabled={idx === videos.length - 1}
                            >
                              ↓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* VideoSelector Modal */}
                  <VideoSelector
                    open={videoSelectorOpen}
                    onClose={() => setVideoSelectorOpen(false)}
                    onContentExtracted={(content) => {
                      console.log('🔍 VideoSelector extraiu:', { useOrchestrator, contentLength: content.length });
                      
                      if (useOrchestrator) {
                        console.log('✅ Enviando para orquestrador');
                        setOrchestratorExtractedData(prev => ({
                          ...prev,
                          videoTranscription: content
                        }));
                        toast({
                          title: '✅ Vídeo transcrito para orquestrador!',
                          description: `${content.length} caracteres adicionados às fontes`
                        });
                      } else {
                        console.log('✅ Enviando para pipeline tradicional');
                        setRawTextInput(content);
                        toast({
                          title: '✅ Conteúdo adicionado!',
                          description: 'O texto do vídeo foi adicionado ao campo de entrada'
                        });
                      }
                    }}
                    onSelect={(videoOrVideos) => {
                      const videosToAdd = Array.isArray(videoOrVideos) ? videoOrVideos : [videoOrVideos];
                      
                      setVideos(prev => {
                        // Filtrar duplicados
                        const existingKeys = new Set(
                          prev.map(v => 
                            v.video_type === 'pandavideo' 
                              ? `p:${v.pandavideo_id}` 
                              : `y:${v.url}`
                          )
                        );
                        
                        const newVideos = videosToAdd.filter(v => {
                          const key = v.video_type === 'pandavideo' 
                            ? `p:${v.pandavideo_id}` 
                            : `y:${v.url}`;
                          return !existingKeys.has(key);
                        });
                        
                        // Adicionar com order_index correto
                        const nextVideos = newVideos.map((v, i) => ({
                          ...v,
                          order_index: prev.length + i
                        }));
                        
                        return [...prev, ...nextVideos];
                      });
                      
                      // Feedback visual
                      if (videosToAdd.length > 0) {
                        toast({ 
                          title: `✅ ${videosToAdd.length} vídeo(s) adicionado(s)!`,
                          description: videosToAdd.map(v => v.title).slice(0, 3).join(', ') + (videosToAdd.length > 3 ? '...' : '')
                        });
                      }
                      
                      setVideoSelectorOpen(false);
                    }}
                  />
                </div>

                {/* PDF para Download */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-lg font-semibold">PDF para Download</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure um arquivo PDF que os usuários podem baixar
                      </p>
                    </div>
                  </div>

                  {formData.file_url ? (
                    <Card className="bg-card border-amber-200 dark:border-amber-800">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-16 h-20 bg-amber-500/10 rounded border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                            <Upload className="w-8 h-8 text-amber-500" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {formData.file_name || 'Documento.pdf'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {formData.file_url}
                            </p>
                            
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(formData.file_url, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Visualizar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setFormData({...formData, file_url: '', file_name: ''});
                                  toast({ title: '✅ PDF removido' });
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="border border-dashed border-border rounded-lg p-6">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm">URL do Arquivo</Label>
                          <Input 
                            placeholder="https://exemplo.com/documento.pdf" 
                            value={formData.file_url}
                            onChange={(e) => setFormData({...formData, file_url: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Nome do Arquivo</Label>
                          <Input 
                            placeholder="Manual Técnico.pdf" 
                            value={formData.file_name}
                            onChange={(e) => setFormData({...formData, file_name: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Conversion Tab */}
              <TabsContent value="conversion" className="space-y-4">
                <div>
                  <Label className="text-lg font-semibold">💰 CTAs de Conversão</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione resinas e produtos mencionados no artigo. CTAs aparecerão automaticamente (topo, meio, final).
                  </p>
                  
                  <ProductCTAMultiSelect 
                    resins={formData.recommended_resins}
                    products={formData.recommended_products}
                    onChange={(resins, products) => setFormData({
                      ...formData, 
                      recommended_resins: resins,
                      recommended_products: products
                    })}
                  />
                  
                  {(formData.recommended_resins.length > 0 || formData.recommended_products.length > 0) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      ✓ {formData.recommended_resins.length} resina(s) + {formData.recommended_products.length} produto(s) selecionado(s)
                    </div>
                  )}
                  
                  {/* Preview */}
                  {formData.recommended_resins.length > 0 && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm font-medium mb-2">📋 Preview do CTA:</p>
                      <div className="p-4 bg-card border border-primary/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-6 w-1 bg-primary rounded-full" />
                          <p className="text-sm font-semibold">🎯 Resinas mencionadas neste artigo</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          ✓ {formData.recommended_resins.length} {formData.recommended_resins.length === 1 ? 'resina selecionada' : 'resinas selecionadas'}
                        </p>
                        <div className="text-xs text-primary">
                          CTAs aparecerão no topo, meio e fim do artigo
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSaveContent}>
              💾 Salvar
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

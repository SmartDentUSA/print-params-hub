import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, UserCircle, Upload, X, ExternalLink } from 'lucide-react';
import { useKnowledge } from '@/hooks/useKnowledge';
import { KnowledgeEditor } from '@/components/KnowledgeEditor';
import { ResinMultiSelect } from '@/components/ResinMultiSelect';
import { ImageUpload } from '@/components/ImageUpload';
import { useAuthors } from '@/hooks/useAuthors';
import { generateAuthorSignatureHTML } from '@/utils/authorSignatureHTML';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { useToast } from '@/hooks/use-toast';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { BlogPreviewFrame } from '@/components/BlogPreviewFrame';
import { useExternalLinks } from '@/hooks/useExternalLinks';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AdminKnowledge() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('A');
  const [contents, setContents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
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
  const [generatedHTML, setGeneratedHTML] = useState('');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
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
  const [showKeywords, setShowKeywords] = useState(false);
  const { keywords, updateKeywordUrl } = useExternalLinks();
  
  // Keyword editing states
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [savingKeywordId, setSavingKeywordId] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  
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
    faqs: [] as Array<{ question: string; answer: string }>,
    order_index: 0,
    active: true,
    recommended_resins: [] as string[],
    aiPromptTemplate: ''
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

  useEffect(() => {
    loadCategories();
    loadAuthors();
  }, []);

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
    setGeneratedHTML('');
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
      faqs: content.faqs || [],
      order_index: content.order_index,
      active: content.active,
      recommended_resins: content.recommended_resins || [],
      content_image_url: (content as any).content_image_url || '',
      content_image_alt: (content as any).content_image_alt || '',
      aiPromptTemplate: (content as any).ai_prompt_template || ''
    });
    
    const vids = await fetchVideosByContent(content.id);
    setVideos(vids);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingContent(null);
    setContentEditorMode('html');
    setPromptEdited(false);
    setGeneratedHTML('');
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
      faqs: [],
      order_index: contents.length,
      active: true,
      recommended_resins: [],
      aiPromptTemplate: ''
    });
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
        slug: formData.slug || generateSlug(formData.title),
        excerpt: formData.excerpt,
        content_html: formData.content_html,
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
        
        // Delete existing videos and re-add
        const existingVids = await fetchVideosByContent(editingContent.id);
        for (const vid of existingVids) {
          await deleteVideo(vid.id);
        }
        for (const video of videos) {
          await insertVideo({ ...video, content_id: editingContent.id });
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

  const handleUploadOgImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Arquivo inválido', 
        description: 'Selecione uma imagem.', 
        variant: 'destructive' 
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'Imagem muito grande', 
        description: 'Máximo 5MB.', 
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.letter}>
                {cat.letter} • {cat.name}
              </TabsTrigger>
            ))}
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
                  
                  {formData.content_html && generatedHTML ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/20 border border-border rounded-lg">
                        <p className="text-sm font-medium mb-2">📄 HTML Salvo (gerado por IA)</p>
                        <BlogPreviewFrame 
                          htmlContent={formData.content_html} 
                          deviceMode="desktop" 
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setFormData(prev => ({ ...prev, content_html: '' }));
                            setGeneratedHTML('');
                            toast({ 
                              title: '🗑️ HTML limpo', 
                              description: 'Agora você pode editar manualmente' 
                            });
                          }}
                          className="mt-3"
                        >
                          🗑️ Limpar e editar manualmente
                        </Button>
                      </div>
                    </div>
                  ) : contentEditorMode === 'visual' ? (
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

                <div>
                  <Label>Cole o texto bruto aqui (Word, Gemini, Google Docs...)</Label>
                  <Textarea
                    value={rawTextInput}
                    onChange={(e) => setRawTextInput(e.target.value)}
                    rows={12}
                    placeholder="Cole aqui o texto que deseja formatar automaticamente..."
                  />
                </div>

                <Button 
                  onClick={async () => {
                    if (!rawTextInput) {
                      toast({ title: 'Erro', description: 'Cole um texto primeiro', variant: 'destructive' });
                      return;
                    }
                    setIsGenerating(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('ai-content-formatter', {
                        body: {
                          prompt: formData.aiPromptTemplate || DEFAULT_AI_PROMPT,
                          rawText: rawTextInput,
                          categoryLetter: selectedCategory
                        }
                      });
                      
                      if (error) throw error;
                      
                      const formattedHTML = data.formattedHTML;
                      setGeneratedHTML(formattedHTML);
                      
                      // 🆕 FASE 4: DEBUG - Logs detalhados
                      console.log('🤖 IA gerou HTML:', {
                        length: formattedHTML.length,
                        hasContentCard: formattedHTML.includes('content-card'),
                        hasBenefits: formattedHTML.includes('benefit-card'),
                        hasCTA: formattedHTML.includes('cta-panel'),
                        hasGridBenefits: formattedHTML.includes('grid-benefits'),
                        linkCount: (formattedHTML.match(/<a href/g) || []).length,
                        h2Count: (formattedHTML.match(/<h2>/g) || []).length,
                        preview: formattedHTML.substring(0, 500) + '...'
                      });
                      
                      // Auto-apply to editor if enabled
                      if (autoApplyIA) {
                        setPreviousHTML(formData.content_html || null);
                        setFormData(prev => ({ ...prev, content_html: formattedHTML }));
                        // ✅ REMOVIDO: Não sincronizar com TipTap - HTML salvo diretamente
                        setPendingAutoSave(true);
                        
                        // Auto-save if enabled and required fields are filled
                        if (autoSaveAfterGen && formData.title && formData.excerpt) {
                          try {
                            const categoryId = categories.find(c => c.letter === selectedCategory)?.id;
                            const contentData = {
                              title: formData.title,
                              slug: formData.slug || generateSlug(formData.title),
                              excerpt: formData.excerpt,
                              content_html: formattedHTML,
                              icon_color: formData.icon_color,
                              meta_description: formData.meta_description,
                              og_image_url: formData.og_image_url,
                              content_image_url: formData.content_image_url,
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
                            
                            setPendingAutoSave(false);
                            toast({ title: '✅ Salvo automaticamente!', description: 'Conteúdo gerado e salvo' });
                            await loadContents();
                          } catch (error: any) {
                            console.error('❌ Erro ao salvar automaticamente:', error);
                            toast({
                              title: '❌ Erro ao salvar',
                              description: error?.message || 'Erro ao salvar automaticamente',
                              variant: 'destructive'
                            });
                          }
                        } else {
                          toast({ 
                            title: '✅ Conteúdo aplicado!', 
                            description: autoSaveAfterGen 
                              ? 'Preencha Título e Resumo para salvar automaticamente' 
                              : 'Clique em "Salvar agora" para persistir'
                          });
                        }
                      } else {
                        toast({ title: '✅ Conteúdo gerado!', description: 'Revise o preview abaixo' });
                      }
                    } catch (err: any) {
                      toast({ title: '❌ Erro', description: err.message, variant: 'destructive' });
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={!rawTextInput || isGenerating}
                  className="relative"
                >
                  {isGenerating ? '⏳ Gerando...' : (
                    <>
                      🚀 Gerar por IA
                      {formData.aiPromptTemplate && formData.aiPromptTemplate !== DEFAULT_AI_PROMPT && (
                        <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">
                          Prompt customizado
                        </span>
                      )}
                    </>
                  )}
                </Button>

                {generatedHTML && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">✅ Conteúdo gerado:</p>
                      
                      {/* 🆕 FASE 4: Estatísticas visuais */}
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className={generatedHTML.includes('content-card') ? 'text-green-600' : 'text-red-600'}>
                          {generatedHTML.includes('content-card') ? '✅' : '⚠️'} Cards
                        </span>
                        <span className={generatedHTML.includes('benefit-card') ? 'text-green-600' : 'text-red-600'}>
                          {generatedHTML.includes('benefit-card') ? '✅' : '⚠️'} Benefits
                        </span>
                        <span className={generatedHTML.includes('cta-panel') ? 'text-green-600' : 'text-red-600'}>
                          {generatedHTML.includes('cta-panel') ? '✅' : '⚠️'} CTAs
                        </span>
                        <span className={(generatedHTML.match(/<a href/g) || []).length >= 5 ? 'text-green-600' : 'text-orange-600'}>
                          🔗 {(generatedHTML.match(/<a href/g) || []).length} links
                        </span>
                      </div>
                    </div>
                    
                    {/* 🆕 FASE 5: Device Mode Buttons */}
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
                    
                    {/* 🆕 FASE 5: Preview COM BlogPreviewFrame */}
                    <div className="border rounded-lg bg-white dark:bg-card" style={{ height: '500px' }}>
                      <BlogPreviewFrame htmlContent={formData.content_html || generatedHTML} deviceMode={deviceMode} />
                    </div>
                    
                    {/* 🆕 FASE 4: Botão de preview do código HTML */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        🔍 Ver código HTML gerado
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-40 text-xs">
                        {formData.content_html || generatedHTML}
                      </pre>
                    </details>
                    
                    {/* Botões */}
                    <div className="flex gap-2">
                      {/* Botão 1: Inserir sem salvar */}
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, content_html: generatedHTML});
                          setGeneratedHTML(generatedHTML);
                          toast({ title: '✅ Inserido!', description: 'Revise na aba "📝 Conteúdo" e salve manualmente' });
                        }}
                      >
                        ➕ Inserir no Editor (sem salvar)
                      </Button>
                      
                      {/* Botão 2: Inserir e salvar automaticamente */}
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
                          const { data, error } = await supabase.functions.invoke('ai-metadata-generator', {
                            body: {
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
                            }
                          });
                          
                          if (error) throw error;
                          
                          setFormData(prev => ({
                            ...prev,
                            slug: data.slug,
                            meta_description: data.metaDescription,
                            faqs: data.faqs
                          }));
                          
                          toast({
                            title: '✅ Metadados gerados!',
                            description: `Slug, Meta Description e ${data.faqs.length} FAQs criados por IA`,
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
                          const { data, error } = await supabase.functions.invoke('ai-metadata-generator', {
                            body: {
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
                            }
                          });
                          
                          if (error) throw error;
                          
                          setFormData(prev => ({
                            ...prev,
                            slug: data.slug,
                            meta_description: data.metaDescription,
                            faqs: data.faqs
                          }));
                          
                          toast({
                            title: '✅ Todos os metadados regenerados!',
                            description: `Slug, Meta Description e ${data.faqs.length} FAQs atualizados`,
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
              <TabsContent value="media" className="space-y-4">
                {/* Videos */}
                <div>
                  <Label className="text-lg font-semibold">Vídeos</Label>
                  {videos.map((video, idx) => (
                    <div key={idx} className="p-4 border border-border rounded-lg mt-2 bg-card">
                      <Input 
                        placeholder="Título do vídeo"
                        value={video.title}
                        className="mb-2"
                        onChange={(e) => {
                          const newVids = [...videos];
                          newVids[idx].title = e.target.value;
                          setVideos(newVids);
                        }}
                      />
                      <Input 
                        placeholder="URL YouTube"
                        value={video.url}
                        onChange={(e) => {
                          const newVids = [...videos];
                          newVids[idx].url = e.target.value;
                          setVideos(newVids);
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="mt-2"
                        onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                  <Button 
                    variant="outline"
                    onClick={() => setVideos([...videos, { title: '', url: '', order_index: videos.length }])}
                  >
                    + ADICIONAR VÍDEO
                  </Button>
                </div>

                {/* File */}
                <div>
                  <Label>Arquivo para Download (URL)</Label>
                  <Input 
                    placeholder="https://..." 
                    value={formData.file_url}
                    onChange={(e) => setFormData({...formData, file_url: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Nome do Arquivo</Label>
                  <Input 
                    placeholder="Manual.pdf" 
                    value={formData.file_name}
                    onChange={(e) => setFormData({...formData, file_name: e.target.value})}
                  />
                </div>
              </TabsContent>

              {/* Conversion Tab */}
              <TabsContent value="conversion" className="space-y-4">
                <div>
                  <Label className="text-lg font-semibold">💰 CTAs de Conversão</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione as resinas mencionadas no artigo. CTAs aparecerão automaticamente (topo, meio, final).
                  </p>
                  
                  <ResinMultiSelect 
                    value={formData.recommended_resins}
                    onChange={(resins) => setFormData({...formData, recommended_resins: resins})}
                  />
                  
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

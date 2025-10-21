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
import { useAuthors } from '@/hooks/useAuthors';
import { generateAuthorSignatureHTML } from '@/utils/authorSignatureHTML';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { useToast } from '@/hooks/use-toast';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';

export function AdminKnowledge() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('A');
  const [contents, setContents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [editingCategoryName, setEditingCategoryName] = useState<{[key: string]: string}>({});
  const [contentEditorMode, setContentEditorMode] = useState<'visual' | 'html'>('visual');
  const [authors, setAuthors] = useState<any[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const ogFileRef = useRef<HTMLInputElement>(null);
  const [uploadingOg, setUploadingOg] = useState(false);
  const { toast } = useToast();
  
  // AI Generation states
  const [rawTextInput, setRawTextInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState('');
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
    setContentEditorMode('visual');
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
      aiPromptTemplate: ''
    });
    
    const vids = await fetchVideosByContent(content.id);
    setVideos(vids);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingContent(null);
    setContentEditorMode('visual');
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
    try {
      const categoryId = categories.find(c => c.letter === selectedCategory)?.id;
      
      const contentData = {
        ...formData,
        category_id: categoryId,
        slug: formData.slug || generateSlug(formData.title),
        recommended_resins: formData.recommended_resins.length > 0 ? formData.recommended_resins : null
      };

      // 🔍 DEBUG: Log antes de salvar manualmente
      console.log('🔍 handleSaveContent:', {
        title: contentData.title,
        excerpt: contentData.excerpt,
        content_html_length: contentData.content_html?.length || 0,
        has_content: !!contentData.content_html,
        contentEditorMode,
        editingContent: !!editingContent
      });

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
      } else {
        const newContent = await insertContent(contentData);
        if (newContent) {
          for (const video of videos) {
            await insertVideo({ ...video, content_id: newContent.id });
          }
        }
      }
      
      setModalOpen(false);
      loadContents();
    } catch (error) {
      console.error('Error saving content:', error);
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
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
                </div>
              </TabsContent>

              {/* AI Generation Tab */}
              <TabsContent value="ai-generation" className="space-y-4">
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

                <div>
                  <Label>Prompt IA para padronização</Label>
                  <Textarea
                    value={formData.aiPromptTemplate || DEFAULT_AI_PROMPT}
                    onChange={(e) => setFormData({...formData, aiPromptTemplate: e.target.value})}
                    rows={8}
                    placeholder="Configure como a IA deve formatar..."
                    className="font-mono text-sm"
                  />
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
                      
                      setGeneratedHTML(data.formattedHTML);
                      toast({ title: '✅ Conteúdo gerado!', description: 'Revise o preview abaixo' });
                    } catch (err: any) {
                      toast({ title: '❌ Erro', description: err.message, variant: 'destructive' });
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={!rawTextInput || isGenerating}
                >
                  {isGenerating ? '⏳ Gerando...' : '🚀 Gerar por IA'}
                </Button>

                {generatedHTML && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <p className="text-sm font-medium">✅ Conteúdo gerado:</p>
                    
                    {/* Preview COM CSS aplicado */}
                    <div className="border rounded-lg p-6 bg-white dark:bg-card max-h-96 overflow-y-auto">
                      <div 
                        className="knowledge-article font-poppins"
                        dangerouslySetInnerHTML={{__html: generatedHTML}} 
                      />
                    </div>
                    
                    {/* Botões */}
                    <div className="flex gap-2">
                      {/* Botão 1: Inserir sem salvar */}
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, content_html: generatedHTML});
                          toast({ title: '✅ Inserido!', description: 'Revise na aba "📝 Conteúdo" e salve manualmente' });
                        }}
                      >
                        ➕ Inserir no Editor (sem salvar)
                      </Button>
                      
                      {/* Botão 2: Inserir e salvar automaticamente */}
                      <Button 
                        onClick={async () => {
                          // Validação
                          if (!formData.title || !formData.excerpt) {
                            toast({ 
                              title: '⚠️ Campos obrigatórios', 
                              description: 'Preencha Título e Resumo antes de salvar', 
                              variant: 'destructive' 
                            });
                            return;
                          }
                          
                          // ✅ CORREÇÃO: Usar generatedHTML diretamente
                          try {
                            const categoryId = categories.find(c => c.letter === selectedCategory)?.id;
                            
                            const contentData = {
                              ...formData,
                              content_html: generatedHTML, // ✅ Usar generatedHTML diretamente!
                              category_id: categoryId,
                              slug: formData.slug || generateSlug(formData.title),
                              recommended_resins: formData.recommended_resins.length > 0 ? formData.recommended_resins : null
                            };

                            // 🔍 DEBUG: Log do contentData antes de salvar
                            console.log('🔍 Salvando contentData:', {
                              title: contentData.title,
                              excerpt: contentData.excerpt,
                              content_html_length: contentData.content_html?.length || 0,
                              has_content: !!contentData.content_html
                            });

                            if (editingContent) {
                              await updateContent(editingContent.id, contentData);
                            } else {
                              const newContent = await insertContent(contentData);
                              if (newContent) {
                                setEditingContent(newContent);
                              }
                            }
                            
                            // ✅ Atualizar estado DEPOIS de salvar
                            setFormData({...formData, content_html: generatedHTML});
                            
                            // Limpar estados
                            setGeneratedHTML('');
                            setRawTextInput('');
                            toast({ 
                              title: '✅ Salvo com sucesso!', 
                              description: 'Conteúdo gerado e salvo automaticamente' 
                            });
                            
                            // Recarregar lista
                            await loadContents();
                          } catch (error) {
                            console.error('❌ Erro ao salvar:', error);
                            toast({ 
                              title: '❌ Erro ao salvar', 
                              description: 'Tente novamente ou salve manualmente', 
                              variant: 'destructive' 
                            });
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
                <div className="space-y-3">
                  <Label>Imagem OG</Label>
                  <Input 
                    placeholder="https://... (ou envie abaixo)" 
                    value={formData.og_image_url}
                    onChange={(e) => setFormData({...formData, og_image_url: e.target.value})}
                  />
                  
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

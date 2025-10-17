import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useKnowledge } from '@/hooks/useKnowledge';
import { KnowledgeEditor } from '@/components/KnowledgeEditor';

export function AdminKnowledge() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('A');
  const [contents, setContents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [editingCategoryName, setEditingCategoryName] = useState<{[key: string]: string}>({});
  
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
    order_index: 0,
    active: true
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

  useEffect(() => {
    loadCategories();
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

  const handleOpenEdit = async (content: any) => {
    setEditingContent(content);
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
      order_index: content.order_index,
      active: content.active
    });
    
    const vids = await fetchVideosByContent(content.id);
    setVideos(vids);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingContent(null);
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
      order_index: contents.length,
      active: true
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
        slug: formData.slug || generateSlug(formData.title)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Base de Conhecimento</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-4">
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">📝 Conteúdo</TabsTrigger>
                <TabsTrigger value="seo">🔍 SEO</TabsTrigger>
                <TabsTrigger value="media">🎬 Mídias</TabsTrigger>
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
                  <Label>Conteúdo Principal</Label>
                  <KnowledgeEditor 
                    content={formData.content_html}
                    onChange={(html) => setFormData({...formData, content_html: html})}
                  />
                </div>
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
                <div>
                  <Label>Imagem OG (URL)</Label>
                  <Input 
                    placeholder="https://..." 
                    value={formData.og_image_url}
                    onChange={(e) => setFormData({...formData, og_image_url: e.target.value})}
                  />
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

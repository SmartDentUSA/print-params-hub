import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, UserCircle } from 'lucide-react';
import { useAuthors, Author } from '@/hooks/useAuthors';
import { useToast } from '@/hooks/use-toast';
import { AuthorImageUpload } from '@/components/AuthorImageUpload';

export function AdminAuthors() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    photo_url: '',
    mini_bio: '',
    full_bio: '',
    lattes_url: '',
    website_url: '',
    instagram_url: '',
    youtube_url: '',
    facebook_url: '',
    linkedin_url: '',
    twitter_url: '',
    tiktok_url: '',
    order_index: 0,
    active: true
  });

  const { fetchAllAuthors, insertAuthor, updateAuthor, deleteAuthor } = useAuthors();
  const { toast } = useToast();

  useEffect(() => {
    loadAuthors();
  }, []);

  const loadAuthors = async () => {
    const data = await fetchAllAuthors();
    setAuthors(data);
  };

  const handleOpenNew = () => {
    setEditingAuthor(null);
    setImageUrl('');
    setFormData({
      name: '',
      specialty: '',
      photo_url: '',
      mini_bio: '',
      full_bio: '',
      lattes_url: '',
      website_url: '',
      instagram_url: '',
      youtube_url: '',
      facebook_url: '',
      linkedin_url: '',
      twitter_url: '',
      tiktok_url: '',
      order_index: authors.length,
      active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (author: Author) => {
    setEditingAuthor(author);
    setImageUrl(author.photo_url || '');
    setFormData({
      name: author.name,
      specialty: author.specialty || '',
      photo_url: author.photo_url || '',
      mini_bio: author.mini_bio || '',
      full_bio: author.full_bio || '',
      lattes_url: author.lattes_url || '',
      website_url: author.website_url || '',
      instagram_url: author.instagram_url || '',
      youtube_url: author.youtube_url || '',
      facebook_url: author.facebook_url || '',
      linkedin_url: author.linkedin_url || '',
      twitter_url: author.twitter_url || '',
      tiktok_url: author.tiktok_url || '',
      order_index: author.order_index,
      active: author.active
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    const dataToSave = {
      ...formData,
      photo_url: imageUrl || formData.photo_url
    };

    if (editingAuthor) {
      const result = await updateAuthor(editingAuthor.id, dataToSave);
      if (result) {
        toast({ title: 'Autor atualizado com sucesso!' });
        setIsModalOpen(false);
        loadAuthors();
      }
    } else {
      const result = await insertAuthor(dataToSave);
      if (result) {
        toast({ title: 'Autor criado com sucesso!' });
        setIsModalOpen(false);
        loadAuthors();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este autor?')) return;
    
    const result = await deleteAuthor(id);
    if (result) {
      toast({ title: 'Autor excluído com sucesso!' });
      loadAuthors();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Autores</CardTitle>
        <Button onClick={handleOpenNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          ADICIONAR AUTOR
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {authors.map((author) => (
            <div
              key={author.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {author.photo_url ? (
                    <img
                      src={author.photo_url}
                      alt={author.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <UserCircle className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{author.name}</p>
                  {author.specialty && (
                    <p className="text-sm text-muted-foreground">{author.specialty}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {author.active ? '✅ Ativo' : '❌ Inativo'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(author)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(author.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {authors.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum autor cadastrado. Clique em "ADICIONAR AUTOR" para começar.
            </p>
          )}
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAuthor ? 'Editar Autor' : 'Novo Autor'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. João Silva"
                />
              </div>

              <div>
                <Label htmlFor="specialty">Especialidade</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Especialista em Odontologia"
                />
              </div>

              <div>
                <Label>Foto do Autor</Label>
                <AuthorImageUpload
                  currentImageUrl={imageUrl || formData.photo_url}
                  onImageUploaded={setImageUrl}
                  authorName={formData.name || 'novo-autor'}
                  disabled={!formData.name.trim()}
                />
                
                <div className="mt-4">
                  <Label htmlFor="photo_url_manual">Ou insira URL manualmente</Label>
                  <Input
                    id="photo_url_manual"
                    value={formData.photo_url}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                    placeholder="https://exemplo.com/foto.jpg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="mini_bio">Mini Currículo (max 300 chars)</Label>
                <Textarea
                  id="mini_bio"
                  value={formData.mini_bio}
                  onChange={(e) => setFormData({ ...formData, mini_bio: e.target.value })}
                  placeholder="Breve descrição do autor..."
                  maxLength={300}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.mini_bio.length}/300 caracteres
                </p>
              </div>

              <div>
                <Label htmlFor="full_bio">Currículo Completo</Label>
                <Textarea
                  id="full_bio"
                  value={formData.full_bio}
                  onChange={(e) => setFormData({ ...formData, full_bio: e.target.value })}
                  placeholder="Descrição detalhada do autor..."
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lattes_url">Currículo Lattes</Label>
                  <Input
                    id="lattes_url"
                    value={formData.lattes_url}
                    onChange={(e) => setFormData({ ...formData, lattes_url: e.target.value })}
                    placeholder="http://lattes.cnpq.br/..."
                  />
                </div>

                <div>
                  <Label htmlFor="website_url">Website</Label>
                  <Input
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://seusite.com"
                  />
                </div>

                <div>
                  <Label htmlFor="instagram_url">Instagram</Label>
                  <Input
                    id="instagram_url"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="youtube_url">YouTube</Label>
                  <Input
                    id="youtube_url"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="facebook_url">Facebook</Label>
                  <Input
                    id="facebook_url"
                    value={formData.facebook_url}
                    onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div>
                  <Label htmlFor="twitter_url">Twitter</Label>
                  <Input
                    id="twitter_url"
                    value={formData.twitter_url}
                    onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                    placeholder="https://twitter.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="tiktok_url">TikTok</Label>
                  <Input
                    id="tiktok_url"
                    value={formData.tiktok_url}
                    onChange={(e) => setFormData({ ...formData, tiktok_url: e.target.value })}
                    placeholder="https://tiktok.com/@..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="order_index">Ordem de Exibição</Label>
                <Input
                  id="order_index"
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>

              <Button onClick={handleSave} className="w-full">
                {editingAuthor ? 'Atualizar Autor' : 'Criar Autor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

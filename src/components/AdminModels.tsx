import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Monitor, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/contexts/DataContext";
import { ImageUpload } from "./ImageUpload";

interface LocalModel {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  image_url?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export function AdminModels() {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<LocalModel | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    brand_id: '',
    notes: '',
    active: true
  });
  
  // Separate state for image URL to avoid timing issues
  const [imageUrl, setImageUrl] = useState<string>('');

  const { 
    fetchBrands, 
    fetchAllModels,
    insertModel, 
    updateModel, 
    deleteModel, 
    loading: dataLoading, 
    error,
    clearError 
  } = useData();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [brandsData, modelsData] = await Promise.all([
        fetchBrands(),
        fetchAllModels()
      ]);
      setBrands(brandsData || []);
      
      // Convert Model[] to LocalModel[] by adding timestamp fields
      const localModels = (modelsData || []).map(model => ({
        ...model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      setModels(localModels);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados. Tente recarregar a página.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      brand_id: '',
      notes: '',
      active: true
    });
    setImageUrl('');
    setEditingModel(null);
  };

  const openEditDialog = (model: LocalModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      slug: model.slug,
      brand_id: model.brand_id,
      notes: model.notes || '',
      active: model.active
    });
    setImageUrl(model.image_url || '');
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.slug.trim() || !formData.brand_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('FormData antes de salvar:', formData);
      console.log('Specifically checking imageUrl state:', imageUrl);
      
      // Use the separate imageUrl state instead of formData.image_url
      const modelData = {
        name: formData.name,
        slug: formData.slug,
        brand_id: formData.brand_id,
        image_url: imageUrl,
        notes: formData.notes,
        active: formData.active
      };
      
      console.log('Dados que serão enviados para o banco:', modelData);
      
      if (editingModel) {
        const updated = await updateModel(editingModel.id, modelData);
        console.log('Resultado do update:', updated);
        if (updated) {
          setModels(prev => prev.map(model => 
            model.id === editingModel.id ? { ...updated, created_at: model.created_at, updated_at: new Date().toISOString() } : model
          ));
          toast({
            title: "Sucesso",
            description: "Modelo atualizado com sucesso!",
          });
        }
      } else {
        const created = await insertModel(modelData);
        console.log('Resultado do insert:', created);
        if (created) {
          setModels(prev => [...prev, { ...created, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
          toast({
            title: "Sucesso",
            description: "Modelo criado com sucesso!",
          });
        }
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving model:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar modelo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      const success = await deleteModel(modelId);
      if (success) {
        setModels(prev => prev.filter(model => model.id !== modelId));
        toast({
          title: "Sucesso",
          description: "Modelo excluído com sucesso!",
        });
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir modelo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingModel ? prev.slug : generateSlug(name)
    }));
  };

  const handleImageUploaded = (imageUrl: string) => {
    console.log('Image URL received in handleImageUploaded:', imageUrl);
    setImageUrl(imageUrl);
    console.log('Updated imageUrl state with:', imageUrl);
  };

  const getBrandName = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    return brand ? brand.name : 'Marca Desconhecida';
  };

  if (loading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando modelos...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Gestão de Modelos
              </CardTitle>
              <CardDescription>
                Gerencie os modelos de impressoras 3D do sistema
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Modelo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingModel ? 'Editar Modelo' : 'Novo Modelo'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingModel 
                      ? 'Edite as informações do modelo'
                      : 'Preencha as informações do novo modelo'
                    }
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                      <TabsTrigger value="image">Imagem</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="ex: Mars 2 Pro"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="slug">Slug *</Label>
                          <Input
                            id="slug"
                            value={formData.slug}
                            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="ex: mars-2-pro"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="brand_id">Marca *</Label>
                        <select
                          id="brand_id"
                          value={formData.brand_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}
                          className="w-full p-2 border border-border rounded-md bg-background"
                          required
                        >
                          <option value="">Selecione uma marca</option>
                          {brands.filter(brand => brand.active).map(brand => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notas</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Informações adicionais sobre o modelo..."
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="active"
                          checked={formData.active}
                          onCheckedChange={(active) => setFormData(prev => ({ ...prev, active }))}
                        />
                        <Label htmlFor="active">Modelo ativo</Label>
                      </div>
                    </TabsContent>

                    <TabsContent value="image">
                      <ImageUpload
                        currentImageUrl={imageUrl}
                        onImageUploaded={handleImageUploaded}
                        modelSlug={formData.slug || 'novo-modelo'}
                      />
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingModel ? 'Atualizar' : 'Criar'} Modelo
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span>Erro: {error}</span>
                <Button variant="outline" size="sm" onClick={clearError}>
                  Limpar
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum modelo encontrado. Crie o primeiro modelo.
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        {model.image_url ? (
                          <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                            <img 
                              src={model.image_url} 
                              alt={model.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                            <Monitor className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>{getBrandName(model.brand_id)}</TableCell>
                      <TableCell className="font-mono text-sm">{model.slug}</TableCell>
                      <TableCell>
                        <Badge variant={model.active ? "default" : "secondary"}>
                          {model.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(model)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o modelo "{model.name}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(model.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
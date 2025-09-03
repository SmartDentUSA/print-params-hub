import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Plus, Edit, Trash2, Cpu, Monitor, Palette, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/contexts/DataContext";
import { AdminModal } from "@/components/AdminModal";
import { supabase } from "@/integrations/supabase/client";

interface Brand {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  logo_url?: string;
}

interface Model {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  active: boolean;
  image_url?: string;
  notes?: string;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  active: boolean;
  type?: string;
}

interface ParameterSet {
  id: string;
  brand_slug: string;
  model_slug: string;
  resin_name: string;
  resin_manufacturer: string;
  layer_height: number;
  cure_time: number;
  bottom_cure_time?: number;
  light_intensity: number;
  notes?: string;
  active: boolean;
}

export function AdminSettings() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [resins, setResins] = useState<Resin[]>([]);
  const [parameters, setParameters] = useState<ParameterSet[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'brand' | 'model' | 'resin' | 'parameter'>('brand');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Search filters
  const [brandSearch, setBrandSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [resinSearch, setResinSearch] = useState("");
  const [parameterSearch, setParameterSearch] = useState("");

  const { toast } = useToast();
  const { 
    fetchBrands, 
    insertBrand, 
    updateBrand, 
    deleteBrand,
    insertModel,
    updateModel,
    deleteModel,
    insertResin,
    updateResin,
    deleteResin,
    insertParameterSet,
    updateParameterSet,
    deleteParameterSet
  } = useData();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch brands
      const brandsData = await fetchBrands();
      setBrands(brandsData);
      
      // Fetch models
      const { data: modelsData } = await supabase
        .from('models')
        .select('*')
        .order('name');
      setModels(modelsData || []);
      
      // Fetch resins
      const { data: resinsData } = await supabase
        .from('resins')
        .select('*')
        .order('name');
      setResins(resinsData || []);
      
      // Fetch parameter sets
      const { data: parametersData } = await supabase
        .from('parameter_sets')
        .select('*')
        .order('brand_slug, model_slug, resin_name');
      setParameters(parametersData || []);
      
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do sistema.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Modal handlers
  const openModal = (type: 'brand' | 'model' | 'resin' | 'parameter', item?: any) => {
    setModalType(type);
    setSelectedItem(item || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleSave = async (data: any) => {
    try {
      let result = null;
      
      if (modalType === 'brand') {
        if (selectedItem) {
          result = await updateBrand(selectedItem.id, data);
          if (result) {
            setBrands(brands.map(b => b.id === selectedItem.id ? result : b));
          }
        } else {
          result = await insertBrand(data);
          if (result) {
            setBrands([...brands, result]);
          }
        }
      } else if (modalType === 'model') {
        if (selectedItem) {
          result = await updateModel(selectedItem.id, data);
          if (result) {
            setModels(models.map(m => m.id === selectedItem.id ? result : m));
          }
        } else {
          result = await insertModel(data);
          if (result) {
            setModels([...models, result]);
          }
        }
      } else if (modalType === 'resin') {
        if (selectedItem) {
          result = await updateResin(selectedItem.id, data);
          if (result) {
            setResins(resins.map(r => r.id === selectedItem.id ? result : r));
          }
        } else {
          result = await insertResin(data);
          if (result) {
            setResins([...resins, result]);
          }
        }
      } else if (modalType === 'parameter') {
        if (selectedItem) {
          result = await updateParameterSet(selectedItem.id, data);
          if (result) {
            setParameters(parameters.map(p => p.id === selectedItem.id ? result : p));
          }
        } else {
          result = await insertParameterSet(data);
          if (result) {
            setParameters([...parameters, result]);
          }
        }
      }
      
      if (result) {
        toast({
          title: "Sucesso",
          description: `${modalType === 'brand' ? 'Marca' : modalType === 'model' ? 'Modelo' : modalType === 'resin' ? 'Resina' : 'Parâmetros'} ${selectedItem ? 'atualizado' : 'criado'} com sucesso.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: `Não foi possível ${selectedItem ? 'atualizar' : 'criar'} o item.`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (type: 'brand' | 'model' | 'resin' | 'parameter', id: string) => {
    try {
      let success = false;
      
      if (type === 'brand') {
        success = await deleteBrand(id);
        if (success) setBrands(brands.filter(b => b.id !== id));
      } else if (type === 'model') {
        success = await deleteModel(id);
        if (success) setModels(models.filter(m => m.id !== id));
      } else if (type === 'resin') {
        success = await deleteResin(id);
        if (success) setResins(resins.filter(r => r.id !== id));
      } else if (type === 'parameter') {
        success = await deleteParameterSet(id);
        if (success) setParameters(parameters.filter(p => p.id !== id));
      }
      
      if (success) {
        toast({
          title: "Item removido",
          description: "Item foi removido com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o item.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (type: 'brand' | 'model' | 'resin' | 'parameter', item: any) => {
    try {
      let result = null;
      
      if (type === 'brand') {
        result = await updateBrand(item.id, { active: !item.active });
        if (result) setBrands(brands.map(b => b.id === item.id ? result : b));
      } else if (type === 'model') {
        result = await updateModel(item.id, { active: !item.active });
        if (result) setModels(models.map(m => m.id === item.id ? result : m));
      } else if (type === 'resin') {
        result = await updateResin(item.id, { active: !item.active });
        if (result) setResins(resins.map(r => r.id === item.id ? result : r));
      } else if (type === 'parameter') {
        result = await updateParameterSet(item.id, { active: !item.active });
        if (result) setParameters(parameters.map(p => p.id === item.id ? result : p));
      }
      
      if (result) {
        toast({
          title: "Status atualizado",
          description: `Item ${item.active ? 'desativado' : 'ativado'} com sucesso.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status do item.",
        variant: "destructive",
      });
    }
  };

  // Filter functions
  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredResins = resins.filter(resin =>
    resin.name.toLowerCase().includes(resinSearch.toLowerCase()) ||
    resin.manufacturer.toLowerCase().includes(resinSearch.toLowerCase())
  );

  const filteredParameters = parameters.filter(param =>
    param.brand_slug.toLowerCase().includes(parameterSearch.toLowerCase()) ||
    param.model_slug.toLowerCase().includes(parameterSearch.toLowerCase()) ||
    param.resin_name.toLowerCase().includes(parameterSearch.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando configurações...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações do Sistema
          </CardTitle>
          <CardDescription>
            Gerencie marcas, modelos e resinas do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="brands">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="brands" className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Marcas
              </TabsTrigger>
              <TabsTrigger value="models" className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Modelos
              </TabsTrigger>
              <TabsTrigger value="resins" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Resinas
              </TabsTrigger>
              <TabsTrigger value="parameters" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Parâmetros
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brands" className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-lg font-semibold">Gerenciar Marcas</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar marcas..."
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button onClick={() => openModal('brand')} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Marca
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Logo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBrands.map((brand) => (
                      <TableRow key={brand.id}>
                        <TableCell>
                          {brand.logo_url ? (
                            <img 
                              src={brand.logo_url} 
                              alt={brand.name}
                              className="w-10 h-10 object-contain rounded"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <Cpu className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{brand.name}</TableCell>
                        <TableCell className="font-mono text-sm">{brand.slug}</TableCell>
                        <TableCell>
                          <Badge variant={brand.active ? 'default' : 'secondary'}>
                            {brand.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openModal('brand', brand)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleToggleStatus('brand', brand)}
                            >
                              {brand.active ? 'Desativar' : 'Ativar'}
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Marca</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover a marca {brand.name}? 
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete('brand', brand.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="models" className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-lg font-semibold">Gerenciar Modelos</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar modelos..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button onClick={() => openModal('model')} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Modelo
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels.map((model) => {
                      const brand = brands.find(b => b.id === model.brand_id);
                      return (
                        <TableRow key={model.id}>
                          <TableCell>
                            {model.image_url ? (
                              <img 
                                src={model.image_url} 
                                alt={model.name}
                                className="w-12 h-12 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                <Monitor className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{model.name}</TableCell>
                          <TableCell>{brand?.name || 'Marca não encontrada'}</TableCell>
                          <TableCell>
                            <Badge variant={model.active ? 'default' : 'secondary'}>
                              {model.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openModal('model', model)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleToggleStatus('model', model)}
                              >
                                {model.active ? 'Desativar' : 'Ativar'}
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover Modelo</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover o modelo {model.name}? 
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete('model', model.id)}>
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="resins" className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-lg font-semibold">Gerenciar Resinas</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar resinas..."
                      value={resinSearch}
                      onChange={(e) => setResinSearch(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button onClick={() => openModal('resin')} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Resina
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResins.map((resin) => (
                      <TableRow key={resin.id}>
                        <TableCell className="font-medium">{resin.name}</TableCell>
                        <TableCell>{resin.manufacturer}</TableCell>
                        <TableCell>
                          {resin.color && (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded border" style={{ backgroundColor: resin.color }} />
                              {resin.color}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{resin.type || 'Standard'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={resin.active ? 'default' : 'secondary'}>
                            {resin.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openModal('resin', resin)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleToggleStatus('resin', resin)}
                            >
                              {resin.active ? 'Desativar' : 'Ativar'}
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Resina</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover a resina {resin.name}? 
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete('resin', resin.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="parameters" className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-lg font-semibold">Gerenciar Parâmetros</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar parâmetros..."
                      value={parameterSearch}
                      onChange={(e) => setParameterSearch(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button onClick={() => openModal('parameter')} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Parâmetros
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Resina</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Camada (mm)</TableHead>
                      <TableHead>Cura (s)</TableHead>
                      <TableHead>Luz (%)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParameters.map((param) => (
                      <TableRow key={param.id}>
                        <TableCell className="font-medium">{param.brand_slug}</TableCell>
                        <TableCell>{param.model_slug}</TableCell>
                        <TableCell>{param.resin_name}</TableCell>
                        <TableCell>{param.resin_manufacturer}</TableCell>
                        <TableCell>{param.layer_height}mm</TableCell>
                        <TableCell>{param.cure_time}s</TableCell>
                        <TableCell>{param.light_intensity}%</TableCell>
                        <TableCell>
                          <Badge variant={param.active ? 'default' : 'secondary'}>
                            {param.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openModal('parameter', param)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleToggleStatus('parameter', param)}
                            >
                              {param.active ? 'Desativar' : 'Ativar'}
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Parâmetros</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover estes parâmetros? 
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete('parameter', param.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AdminModal
        isOpen={isModalOpen}
        onClose={closeModal}
        type={modalType}
        item={selectedItem}
        brands={brands.map(b => ({ ...b, isActive: b.active }))}
        models={models.map(m => ({ ...m, isActive: m.active, brandId: m.brand_id, imageUrl: m.image_url }))}
        resins={resins.map(r => ({ ...r, isActive: r.active }))}
        onSave={handleSave}
      />
    </div>
  );
}
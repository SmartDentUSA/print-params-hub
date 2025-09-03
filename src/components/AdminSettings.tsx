import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Plus, Edit, Trash2, Cpu, Monitor, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/contexts/DataContext";

interface Brand {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

interface Model {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  active: boolean;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  active: boolean;
}

export function AdminSettings() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [resins, setResins] = useState<Resin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedResin, setSelectedResin] = useState<Resin | null>(null);
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState(false);
  const [isAddResinModalOpen, setIsAddResinModalOpen] = useState(false);
  
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelBrandId, setNewModelBrandId] = useState("");
  const [newResinName, setNewResinName] = useState("");
  const [newResinManufacturer, setNewResinManufacturer] = useState("");
  const [newResinColor, setNewResinColor] = useState("");

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
    deleteResin
  } = useData();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const brandsData = await fetchBrands();
      setBrands(brandsData);
      
      // For now, use mock data for models and resins
      // In a real implementation, you'd fetch these from the database
      setModels([]);
      setResins([]);
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

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      const brandData = {
        name: newBrandName.trim(),
        slug: newBrandName.toLowerCase().trim().replace(/\s+/g, '-'),
        active: true
      };

      const result = await insertBrand(brandData);
      if (result) {
        setBrands([...brands, result]);
        setNewBrandName("");
        setIsAddBrandModalOpen(false);
        toast({
          title: "Marca adicionada",
          description: `Marca ${newBrandName} foi adicionada com sucesso.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao adicionar marca",
        description: "Não foi possível adicionar a marca.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    try {
      const success = await deleteBrand(brandId);
      if (success) {
        setBrands(brands.filter(brand => brand.id !== brandId));
        toast({
          title: "Marca removida",
          description: "Marca foi removida com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao remover marca",
        description: "Não foi possível remover a marca.",
        variant: "destructive",
      });
    }
  };

  const handleToggleBrandStatus = async (brand: Brand) => {
    try {
      const result = await updateBrand(brand.id, { active: !brand.active });
      if (result) {
        setBrands(brands.map(b => b.id === brand.id ? result : b));
        toast({
          title: "Status atualizado",
          description: `Marca ${brand.active ? 'desativada' : 'ativada'} com sucesso.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status da marca.",
        variant: "destructive",
      });
    }
  };

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
            <TabsList className="grid w-full grid-cols-3">
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
            </TabsList>

            <TabsContent value="brands" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Gerenciar Marcas</h3>
                <Dialog open={isAddBrandModalOpen} onOpenChange={setIsAddBrandModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Adicionar Marca
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Nova Marca</DialogTitle>
                      <DialogDescription>
                        Adicione uma nova marca de impressora 3D
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="brandName">Nome da Marca</Label>
                        <Input
                          id="brandName"
                          placeholder="Ex: Elegoo, Anycubic..."
                          value={newBrandName}
                          onChange={(e) => setNewBrandName(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddBrandModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddBrand}>
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.map((brand) => (
                      <TableRow key={brand.id}>
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
                              onClick={() => handleToggleBrandStatus(brand)}
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
                                  <AlertDialogAction onClick={() => handleDeleteBrand(brand.id)}>
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
              <div className="text-center py-8">
                <Monitor className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Gerenciamento de modelos em desenvolvimento
                </p>
              </div>
            </TabsContent>

            <TabsContent value="resins" className="space-y-4">
              <div className="text-center py-8">
                <Palette className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Gerenciamento de resinas em desenvolvimento
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
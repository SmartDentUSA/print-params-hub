import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataStats } from "@/components/DataStats";
import { DataImport } from "@/components/DataImport";
import { LoginForm } from "@/components/LoginForm";
import { useData } from "@/contexts/DataContext";
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Building2, 
  Printer, 
  Beaker,
  Users,
  Home,
  Download,
  Upload
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  getUniqueBrands, 
  getUniqueModels, 
  getUniqueResins, 
  realBrandsData,
  type RealParameterSet 
} from "@/data/realData";

const AdminView = () => {
  // ALL HOOKS MUST BE AT THE TOP - NEVER CONDITIONAL
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<RealParameterSet>>({});
  const { toast } = useToast();
  const { data, addData } = useData();

  const brands = getUniqueBrands(data);
  const models = getUniqueModels(data);
  const resins = getUniqueResins(data);

  // Check authentication on component mount
  useEffect(() => {
    const authStatus = localStorage.getItem("adminAuth");
    setIsAuthenticated(authStatus === "true");
    setIsLoading(false);
  }, []);

  const handleLogin = (success: boolean) => {
    setIsAuthenticated(success);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado do painel administrativo.",
    });
  };

  const handleEdit = (id: string, data: any) => {
    setEditingItem(id);
    setFormData(data);
  };

  const handleSave = () => {
    // Mock save functionality
    toast({
      title: "Dados salvos!",
      description: "As alterações foram salvas com sucesso.",
    });
    setEditingItem(null);
    setFormData({});
  };

  const handleCancel = () => {
    setEditingItem(null);
    setFormData({});
  };

  const handleDelete = (id: string, type: string) => {
    toast({
      title: "Item removido",
      description: `${type} foi removido com sucesso.`,
    });
  };

  // CONDITIONAL RENDERS AFTER ALL HOOKS
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Mock form states for editing - MOVED TO TOP


  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Admin Header */}
      <header className="bg-gradient-card border-b border-border shadow-medium">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Voltar ao Site
              </Button>
            </Link>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center space-x-2">
              <Settings className="w-6 h-6 text-primary" />
              <span className="font-semibold text-lg">Painel Administrativo</span>
            </div>
          </div>
          <Badge variant="default">Admin</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="brands" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Marcas
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Modelos
            </TabsTrigger>
            <TabsTrigger value="resins" className="flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Resinas
            </TabsTrigger>
            <TabsTrigger value="parameters" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Parâmetros
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Visão Geral do Sistema
                  </CardTitle>
                  <CardDescription>
                    Estatísticas e informações gerais da base de dados
                  </CardDescription>
                </CardHeader>
              </Card>
              <DataStats data={data} />
            </div>
          </TabsContent>

          {/* Brands Tab */}
          <TabsContent value="brands" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Gerenciar Marcas</h2>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nova Marca
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {brands.map((brand) => (
                    <div key={brand.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium">{brand.name}</div>
                          <div className="text-sm text-muted-foreground">Slug: {brand.slug}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={brand.isActive ? "default" : "secondary"}>
                          {brand.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(brand.id, brand)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(brand.id, "Marca")}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Gerenciar Modelos</h2>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Modelo
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5 text-accent" />
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Marca: {brands.find(b => b.id === model.brandId)?.name}
                          </div>
                          {model.notes && (
                            <div className="text-sm text-muted-foreground">{model.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={model.isActive ? "default" : "secondary"}>
                          {model.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(model.id, model)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(model.id, "Modelo")}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resins Tab */}
          <TabsContent value="resins" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Gerenciar Resinas</h2>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nova Resina
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {resins.map((resin) => (
                    <div key={resin.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Beaker className="w-5 h-5 text-success" />
                        <div>
                          <div className="font-medium">{resin.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Fabricante: {resin.manufacturer}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={resin.isActive ? "default" : "secondary"}>
                          {resin.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(resin.id, resin)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(resin.id, "Resina")}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Parameters Tab */}
          <TabsContent value="parameters" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Gerenciar Parâmetros</h2>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Conjunto
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {data.slice(0, 10).map((param, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-warning" />
                        <div>
                          <div className="font-medium">{param.resin} - {param.variant_label}</div>
                          <div className="text-sm text-muted-foreground">
                            {param.brand} {param.model}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Altura: {param.altura_da_camada_mm}mm | Cura: {param.tempo_cura_seg}s | Adesão: {param.tempo_adesao_seg}s
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(`param-${index}`, param)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(`param-${index}`, "Parâmetro")}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Importar e Exportar Dados</h2>
                <p className="text-muted-foreground">
                  Use esta seção para importar novos dados ou exportar a base atual.
                </p>
              </div>
              
              <div className="grid gap-6">
                <DataImport onDataLoaded={addData} />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Exportar Dados
                    </CardTitle>
                    <CardDescription>
                      Faça backup da base de dados atual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Exportar CSV
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Exportar JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal/Form */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Editar Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.brand || formData.resin || ""} 
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={handleCancel} className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminView;
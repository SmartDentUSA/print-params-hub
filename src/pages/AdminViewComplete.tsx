import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { DataImport } from "@/components/DataImport";
import { DataStats } from "@/components/DataStats";
import { AdminModal } from "@/components/AdminModal";
import { LoginForm } from "@/components/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Database, 
  BarChart3, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Users, 
  Settings, 
  ArrowLeft,
  Shield,
  Globe,
  Palette,
  Bell,
  Mail,
  FileText,
  Image,
  Download,
  Edit,
  Plus,
  LogOut
} from "lucide-react";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const AdminViewComplete = () => {
  const [importedData, setImportedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'brand' | 'model' | 'resin' | 'parameter'>('brand');
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Catalog data states
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [resins, setResins] = useState<any[]>([]);
  
  // Configuration states
  const [siteConfig, setSiteConfig] = useState({
    siteName: "Parâmetros de Impressão 3D",
    siteDescription: "Base de dados profissional com parâmetros testados",
    allowPublicAccess: true,
    requireEmailVerification: false,
    maintenanceMode: false,
    maxFileSize: 10,
    allowedFileTypes: ".csv,.xlsx",
    adminEmail: "admin@smartdent.com.br",
    whatsappNumber: "551634194735",
    enableNotifications: true,
    enableAnalytics: true
  });
  
  const { toast } = useToast();
  const { 
    insertParameterSets,
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
  } = useSupabaseData();

  // Load catalog data
  useEffect(() => {
    loadCatalogData();
  }, []);

  const loadCatalogData = async () => {
    try {
      // Load brands from Supabase
      const brandsData = await getUniqueBrands();
      setBrands(brandsData || []);
      
      // For now, keep models and resins from localStorage
      const storedModels = JSON.parse(localStorage.getItem('catalogModels') || '[]');
      const storedResins = JSON.parse(localStorage.getItem('catalogResins') || '[]');
      
      setModels(storedModels);
      setResins(storedResins);
    } catch (error) {
      console.error('Error loading catalog data:', error);
    }
  };

  const saveCatalogData = () => {
    localStorage.setItem('catalogBrands', JSON.stringify(brands));
    localStorage.setItem('catalogModels', JSON.stringify(models));
    localStorage.setItem('catalogResins', JSON.stringify(resins));
  };

  useEffect(() => {
    const authStatus = localStorage.getItem("adminAuth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    } else {
      setShowLoginForm(true);
    }
  }, []);

  const handleDataLoaded = (newData: any[]) => {
    console.log("Admin: Dados carregados:", newData.length);
    setImportedData(newData);
  };

  const handleClearData = () => {
    setImportedData([]);
    toast({
      title: "Dados locais limpos",
      description: "Os dados temporários foram removidos da memória.",
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    setShowLoginForm(true);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado do painel administrativo.",
    });
  };

  const openModal = (type: 'brand' | 'model' | 'resin' | 'parameter', item?: any) => {
    setModalType(type);
    setEditingItem(item || null);
    setModalOpen(true);
  };

  const handleModalSave = async (data: any) => {
    if (modalType === 'brand') {
      if (editingItem) {
        const updatedBrands = brands.map(brand => 
          brand.id === editingItem.id ? { ...brand, ...data } : brand
        );
        setBrands(updatedBrands);
      } else {
        const newBrand = {
          ...data,
          id: Date.now().toString(),
          slug: data.name.toLowerCase().replace(/\s+/g, '-')
        };
        setBrands([...brands, newBrand]);
      }
    } else if (modalType === 'model') {
      if (editingItem) {
        const updatedModels = models.map(model => 
          model.id === editingItem.id ? { ...model, ...data } : model
        );
        setModels(updatedModels);
      } else {
        const newModel = {
          ...data,
          id: Date.now().toString(),
          slug: data.name.toLowerCase().replace(/\s+/g, '-')
        };
        setModels([...models, newModel]);
      }
    } else if (modalType === 'resin') {
      if (editingItem) {
        const updatedResins = resins.map(resin => 
          resin.id === editingItem.id ? { ...resin, ...data } : resin
        );
        setResins(updatedResins);
      } else {
        const newResin = {
          ...data,
          id: Date.now().toString()
        };
        setResins([...resins, newResin]);
      }
    } else if (modalType === 'parameter') {
      if (editingItem) {
        const updatedParameters = importedData.map(param => 
          param.id === editingItem.id ? { ...param, ...data } : param
        );
        setImportedData(updatedParameters);
      } else {
        const newParameter = {
          ...data,
          id: Date.now().toString()
        };
        setImportedData([...importedData, newParameter]);
      }
    }
    
    saveCatalogData();
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (type: string, id: string) => {
    if (type === 'brand') {
      setBrands(brands.filter(brand => brand.id !== id));
    } else if (type === 'model') {
      setModels(models.filter(model => model.id !== id));
    } else if (type === 'resin') {
      setResins(resins.filter(resin => resin.id !== id));
    } else if (type === 'parameter') {
      setImportedData(importedData.filter(param => param.id !== id));
    }
    saveCatalogData();
  };

  const handleConfigUpdate = (key: string, value: any) => {
    setSiteConfig(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Save config to localStorage
    localStorage.setItem('siteConfig', JSON.stringify({
      ...siteConfig,
      [key]: value
    }));
    
    toast({
      title: "Configuração atualizada",
      description: "As configurações foram salvas com sucesso.",
    });
  };

  // Show login form if not authenticated
  if (showLoginForm && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main Admin Panel */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-muted-foreground mt-2">Gerencie dados, importações e configurações do sistema</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Site
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parâmetros</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{importedData.length}</div>
              <p className="text-xs text-muted-foreground">configurações ativas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Marcas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{brands.length}</div>
              <p className="text-xs text-muted-foreground">fabricantes cadastrados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Modelos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{models.length}</div>
              <p className="text-xs text-muted-foreground">impressoras cadastradas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border shadow-medium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resinas</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resins.length}</div>
              <p className="text-xs text-muted-foreground">tipos diferentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Admin Tabs */}
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Estatísticas
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Banco
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Brands */}
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Marcas ({brands.length})</CardTitle>
                  <Button size="sm" onClick={() => openModal('brand')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {brands.map((brand) => (
                      <div key={brand.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium text-sm">{brand.name}</div>
                          <div className="text-xs text-muted-foreground">{brand.slug}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openModal('brand', brand)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete('brand', brand.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Models */}
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Modelos ({models.length})</CardTitle>
                  <Button size="sm" onClick={() => openModal('model')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {models.map((model) => {
                      const brand = brands.find(b => b.id === model.brandId);
                      return (
                        <div key={model.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium text-sm">{model.name}</div>
                            <div className="text-xs text-muted-foreground">{brand?.name || 'Marca não encontrada'}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openModal('model', model)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete('model', model.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Resins */}
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Resinas ({resins.length})</CardTitle>
                  <Button size="sm" onClick={() => openModal('resin')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {resins.map((resin) => (
                      <div key={resin.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium text-sm">{resin.name}</div>
                          <div className="text-xs text-muted-foreground">{resin.manufacturer}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openModal('resin', resin)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete('resin', resin.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Parameters Table */}
            {importedData.length > 0 && (
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Parâmetros Importados ({importedData.length})</CardTitle>
                  <Button size="sm" onClick={() => openModal('parameter')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Resina</TableHead>
                          <TableHead>Altura</TableHead>
                          <TableHead>Cura</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedData.slice(0, 10).map((param, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{param.brand_slug}</TableCell>
                            <TableCell>{param.model_slug}</TableCell>
                            <TableCell>{param.resin_name}</TableCell>
                            <TableCell>{param.layer_height}mm</TableCell>
                            <TableCell>{param.cure_time}s</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openModal('parameter', param)}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete('parameter', param.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {importedData.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        ... e mais {importedData.length - 10} parâmetros
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <DataImport onDataLoaded={handleDataLoaded} />
            
            {importedData.length > 0 && (
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Dados Importados ({importedData.length} registros)</CardTitle>
                  <CardDescription>
                    Dados carregados na memória local. Use o botão abaixo para limpar se necessário.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleClearData} variant="outline">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Dados Locais
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <DataStats data={importedData} />
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Acesso ao Banco de Dados</CardTitle>
                  <CardDescription>Links diretos para gerenciar o banco Supabase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button asChild className="w-full">
                    <a href="https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz" target="_blank" rel="noopener noreferrer">
                      <Globe className="w-4 h-4 mr-2" />
                      Dashboard Supabase
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/sql/new" target="_blank" rel="noopener noreferrer">
                      <Database className="w-4 h-4 mr-2" />
                      Editor SQL
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Status do Sistema</CardTitle>
                  <CardDescription>Informações sobre a conexão e performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status da Conexão</span>
                    <Badge variant="default">Conectado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Última Sincronização</span>
                    <span className="text-sm text-muted-foreground">Agora</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Versão da API</span>
                    <span className="text-sm text-muted-foreground">v2.57.0</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>Configurações básicas do site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Nome do Site</Label>
                    <Input 
                      id="siteName"
                      value={siteConfig.siteName}
                      onChange={(e) => handleConfigUpdate('siteName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siteDescription">Descrição</Label>
                    <Textarea 
                      id="siteDescription"
                      value={siteConfig.siteDescription}
                      onChange={(e) => handleConfigUpdate('siteDescription', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email do Administrador</Label>
                    <Input 
                      id="adminEmail"
                      type="email"
                      value={siteConfig.adminEmail}
                      onChange={(e) => handleConfigUpdate('adminEmail', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Controle de Acesso</CardTitle>
                  <CardDescription>Configurações de segurança e acesso</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Acesso Público</Label>
                      <div className="text-sm text-muted-foreground">Permitir visualização sem login</div>
                    </div>
                    <Switch 
                      checked={siteConfig.allowPublicAccess}
                      onCheckedChange={(checked) => handleConfigUpdate('allowPublicAccess', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Verificação de Email</Label>
                      <div className="text-sm text-muted-foreground">Obrigar verificação de email</div>
                    </div>
                    <Switch 
                      checked={siteConfig.requireEmailVerification}
                      onCheckedChange={(checked) => handleConfigUpdate('requireEmailVerification', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Modo Manutenção</Label>
                      <div className="text-sm text-muted-foreground">Desabilitar acesso temporariamente</div>
                    </div>
                    <Switch 
                      checked={siteConfig.maintenanceMode}
                      onCheckedChange={(checked) => handleConfigUpdate('maintenanceMode', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Informações do Sistema</CardTitle>
                  <CardDescription>Detalhes técnicos e versões</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Versão da Aplicação</span>
                    <span className="text-sm font-mono">v1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Framework</span>
                    <span className="text-sm font-mono">React 18.3.1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Banco de Dados</span>
                    <span className="text-sm font-mono">Supabase PostgreSQL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Última Atualização</span>
                    <span className="text-sm text-muted-foreground">Hoje</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border shadow-medium">
                <CardHeader>
                  <CardTitle>Ações do Sistema</CardTitle>
                  <CardDescription>Ferramentas de manutenção e backup</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Configurações
                  </Button>
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Limpar Cache
                  </Button>
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Logs do Sistema
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Admin Modal */}
      <AdminModal 
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        type={modalType}
        item={editingItem}
        brands={brands}
        models={models}
        resins={resins}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default AdminViewComplete;

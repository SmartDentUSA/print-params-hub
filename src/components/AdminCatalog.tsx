import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ShoppingCart, AlertTriangle, Filter, RefreshCw, Eye, Sparkles, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogCRUD, CatalogProduct } from "@/hooks/useCatalogCRUD";
import { AdminModal } from "./AdminModal";
import { supabase } from "@/integrations/supabase/client";
import { AdminCatalogTable } from "./AdminCatalogTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkuMappingTab } from "./admin/catalog/SkuMappingTab";
import { exportCatalogXlsx } from "./admin/catalog/exportCatalogXlsx";

export function AdminCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [migrating, setMigrating] = useState(false);
  const [regenDescs, setRegenDescs] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { 
    fetchCatalogProducts, 
    insertCatalogProduct, 
    updateCatalogProduct, 
    deleteCatalogProduct,
    fetchCategories,
    loading, 
    error,
    clearError 
  } = useCatalogCRUD();
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleCatalogSync = async (event: CustomEvent) => {
      console.log('📥 Recarregando catálogo após sincronização...', event.detail);
      await loadData();
      
      if (event.detail.inserted > 0) {
        toast({
          title: "📦 Catálogo Atualizado",
          description: `${event.detail.inserted} novo(s) produto(s)`,
        });
      }
    };

    window.addEventListener('catalog-synced', handleCatalogSync as EventListener);
    
    return () => {
      window.removeEventListener('catalog-synced', handleCatalogSync as EventListener);
    };
  }, []);

  useEffect(() => {
    // Aplicar filtros
    let filtered = products;

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de categoria
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.product_category === selectedCategory);
    }

    // Filtro de origem (produtos gerais vs. espelho de resinas)
    if (selectedOrigin !== 'all') {
      filtered = filtered.filter(p => {
        const isResin = (p.product_category || p.category || '').toLowerCase().includes('resina');
        return selectedOrigin === 'resins' ? isResin : !isResin;
      });
    }

    // Filtro de status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'active') {
        filtered = filtered.filter(p => p.active);
      } else if (selectedStatus === 'inactive') {
        filtered = filtered.filter(p => !p.active);
      } else if (selectedStatus === 'approved') {
        filtered = filtered.filter(p => p.approved);
      } else if (selectedStatus === 'pending') {
        filtered = filtered.filter(p => !p.approved);
      } else if (selectedStatus === 'visible') {
        filtered = filtered.filter(p => p.visible_in_ui);
      } else if (selectedStatus === 'hidden') {
        filtered = filtered.filter(p => !p.visible_in_ui);
      }
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory, selectedStatus, selectedOrigin]);

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        fetchCatalogProducts(),
        fetchCategories()
      ]);
      
      setProducts(productsData);
      setFilteredProducts(productsData);
      setCategories(categoriesData);

      // Fetch doc counts
      const { data: docs } = await supabase
        .from('catalog_documents')
        .select('product_id')
        .eq('active', true);
      
      if (docs) {
        const counts: Record<string, number> = {};
        docs.forEach(d => {
          counts[d.product_id] = (counts[d.product_id] || 0) + 1;
        });
        setDocCounts(counts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos. Tente recarregar a página.",
        variant: "destructive",
      });
    }
  };

  const handleToggleVisibility = async (productId: string, currentVisible: boolean | undefined) => {
    try {
      const updated = await updateCatalogProduct(productId, { visible_in_ui: !currentVisible });
      if (updated) {
        setProducts(prev => prev.map(p => p.id === productId ? updated : p));
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const handleToggleActive = async (productId: string, currentActive: boolean | undefined) => {
    try {
      const updated = await updateCatalogProduct(productId, { active: !currentActive });
      if (updated) {
        setProducts(prev => prev.map(p => p.id === productId ? updated : p));
      }
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  };

  const openEditDialog = (product: CatalogProduct) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleSave = async (data: any, documents?: any[]) => {
    try {
      if (editingProduct) {
        const updated = await updateCatalogProduct(editingProduct.id!, data);
        if (updated) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
          setIsDialogOpen(false);
          setEditingProduct(null);
        }
      } else {
        const created = await insertCatalogProduct(data);
        if (created) {
          setProducts(prev => [...prev, created]);
          setIsDialogOpen(false);
        }
      }
      await loadData(); // Recarregar para atualizar categorias
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      const success = await deleteCatalogProduct(productId);
      if (success) {
        setProducts(prev => prev.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleBatchVisibility = async (visible: boolean) => {
    const targetProducts = selectedCategory !== 'all'
      ? products.filter(p => p.product_category === selectedCategory)
      : products;
    
    if (targetProducts.length === 0) return;

    try {
      let count = 0;
      for (const p of targetProducts) {
        if (p.id && p.visible_in_ui !== visible) {
          await updateCatalogProduct(p.id, { visible_in_ui: visible });
          count++;
        }
      }
      setProducts(prev => prev.map(p => 
        targetProducts.some(tp => tp.id === p.id) ? { ...p, visible_in_ui: visible } : p
      ));
      toast({
        title: visible ? "✅ Produtos visíveis" : "🙈 Produtos ocultos",
        description: `${count} produto(s) atualizado(s)`,
      });
    } catch (error) {
      console.error('Error batch updating visibility:', error);
      toast({ title: "Erro", description: "Erro ao atualizar visibilidade em lote", variant: "destructive" });
    }
  };

  const handleMigrateImages = async () => {
    setMigrating(true);
    try {
      toast({
        title: "🔄 Iniciando migração...",
        description: "Fazendo upload das imagens para Supabase Storage",
      });

      const { data, error } = await supabase.functions.invoke('migrate-catalog-images');
      
      if (error) throw error;

      toast({
        title: "✅ Migração concluída!",
        description: `${data.images_uploaded} imagens migradas com sucesso de ${data.total_products} produtos`,
      });

      // Recarregar produtos para ver as novas URLs
      await loadData();
    } catch (error) {
      console.error('Error migrating images:', error);
      toast({
        title: "Erro na migração",
        description: error.message || "Erro ao migrar imagens",
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando catálogo...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="sku-mapping">Mapeamento de SKU</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Gestão de Catálogo de Produtos
              </CardTitle>
              <CardDescription>
                Gerencie produtos gerais (não-resinas) do Sistema A
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!confirm('Regerar descrições curtas (~160 chars) das resinas via IA?\n\nA descrição original será preservada em extra_data.description_original.')) return;
                  setRegenDescs(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('smart-ops-generate-card-descriptions', { body: { dry_run: false, force: true } });
                    if (error) throw error;
                    toast({ title: '✨ Descrições geradas', description: `Processadas: ${data?.processed ?? 0} · Atualizadas: ${data?.updated ?? 0} · Falhas: ${data?.failures?.length ?? 0}` });
                    await loadData();
                  } catch (e: any) {
                    toast({ title: 'Erro', description: String(e?.message || e), variant: 'destructive' });
                  } finally {
                    setRegenDescs(false);
                  }
                }}
                disabled={regenDescs}
                variant="outline"
              >
                <Sparkles className={`mr-2 h-4 w-4 ${regenDescs ? 'animate-pulse' : ''}`} />
                {regenDescs ? 'Gerando...' : 'Regenerar Descrições (Resinas)'}
              </Button>
              <Button 
                onClick={handleMigrateImages} 
                disabled={migrating}
                variant="outline"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${migrating ? 'animate-spin' : ''}`} />
                {migrating ? 'Migrando...' : 'Migrar Imagens'}
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Produto
              </Button>
              <Button
                variant="outline"
                disabled={exporting || filteredProducts.length === 0}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await exportCatalogXlsx(filteredProducts);
                    toast({ title: "Catálogo exportado", description: `${filteredProducts.length} produtos exportados em XLSX.` });
                  } catch (e: any) {
                    toast({ title: "Erro ao exportar", description: String(e?.message || e), variant: "destructive" });
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className={`w-4 h-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
                {exporting ? "Exportando..." : "Exportar"}
              </Button>
            </div>
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

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Buscar
              </label>
              <Input
                placeholder="Nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="all">Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {selectedCategory !== 'all' && (
                <div className="flex gap-1 mt-1">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleBatchVisibility(true)}>
                    <Eye className="w-3 h-3 mr-1" /> Mostrar todos
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleBatchVisibility(false)}>
                    Ocultar todos
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="approved">Aprovados</option>
                <option value="pending">Pendentes</option>
                <option value="visible">Visível na UI</option>
                <option value="hidden">Oculto na UI</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resultados</label>
              <div className="p-2 border border-border rounded-md bg-muted">
                <span className="font-semibold">{filteredProducts.length}</span> de {products.length} produtos
              </div>
            </div>
          </div>

          {/* Filtro adicional: origem (produtos gerais / espelho de resinas) */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium">Origem:</label>
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              className="p-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="all">Todos</option>
              <option value="products">Produtos gerais</option>
              <option value="resins">Resinas (espelho)</option>
            </select>
            <span className="text-xs text-muted-foreground">
              Linhas de resinas são espelho read-only de <em>Configurações do Sistema → Resinas</em>.
            </span>
          </div>

          {/* Nova tabela (layout Distribuição + variações) */}
          <AdminCatalogTable
            products={filteredProducts}
            onEditCore={openEditDialog}
            onDeleteCore={handleDelete}
            onToggleVisibility={handleToggleVisibility}
            onToggleActive={handleToggleActive}
          />
        </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="sku-mapping">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Mapeamento de SKU & Kits
              </CardTitle>
              <CardDescription>
                Associe itens brutos vindos de propostas do CRM e pedidos da Loja Integrada às variações
                do catálogo. Marque como <strong>Kit</strong> para expandir automaticamente os componentes
                nos itens da proposta e no cálculo de mix de produtos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SkuMappingTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de criação/edição */}
      <AdminModal
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingProduct(null);
        }}
        type="catalog"
        item={editingProduct}
        onSave={handleSave}
      />
    </div>
  );
}

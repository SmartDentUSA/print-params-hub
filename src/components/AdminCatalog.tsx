import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, ShoppingCart, AlertTriangle, FileText, Filter, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogCRUD, CatalogProduct } from "@/hooks/useCatalogCRUD";
import { AdminModal } from "./AdminModal";
import { supabase } from "@/integrations/supabase/client";

export function AdminCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [migrating, setMigrating] = useState(false);

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
      }
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        fetchCatalogProducts(),
        fetchCategories()
      ]);
      
      setProducts(productsData);
      setFilteredProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos. Tente recarregar a página.",
        variant: "destructive",
      });
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
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resultados</label>
              <div className="p-2 border border-border rounded-md bg-muted">
                <span className="font-semibold">{filteredProducts.length}</span> de {products.length} produtos
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                        ? 'Nenhum produto encontrado com os filtros aplicados.'
                        : 'Nenhum produto encontrado. Crie o primeiro produto.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                        {product.slug && (
                          <div className="text-xs text-muted-foreground font-mono">
                            /{product.slug}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.product_category ? (
                          <Badge variant="outline">{product.product_category}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.product_subcategory ? (
                          <Badge variant="secondary">{product.product_subcategory}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.updated_at ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {new Date(product.updated_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(product.updated_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={product.active ? "default" : "secondary"}>
                            {product.active ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant={product.approved ? "default" : "destructive"}>
                            {product.approved ? "Aprovado" : "Pendente"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(product)}
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
                                  Tem certeza que deseja excluir "{product.name}"? 
                                  Esta ação não pode ser desfeita e removerá todos os documentos associados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(product.id!)}
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

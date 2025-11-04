import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CatalogProduct {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  price?: number;
  promo_price?: number;
  currency?: string;
  
  // Categorias (campos principais)
  product_category?: string;
  product_subcategory?: string;
  
  // Correlação (external_id é obrigatório)
  external_id: string;
  source: string;
  category: string;
  system_a_product_id?: string;
  system_a_product_url?: string;
  
  // SEO
  seo_title_override?: string;
  meta_description?: string;
  og_image_url?: string;
  canonical_url?: string;
  keywords?: string[];
  
  // CTAs
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
  
  // Status
  approved: boolean;
  active: boolean;
  visible_in_ui?: boolean;
  display_order?: number;
  
  // Extra
  extra_data?: any;
  rating?: number;
  review_count?: number;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface ProductDocument {
  id?: string;
  product_id: string;
  document_name: string;
  document_description?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  order_index?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const ALLOWED_CATALOG_FIELDS = [
  'name','slug','description','image_url','price','promo_price','currency',
  'seo_title_override','meta_description','og_image_url','canonical_url','keywords',
  'cta_1_label','cta_1_url','cta_1_description','cta_2_label','cta_2_url','cta_2_description',
  'cta_3_label','cta_3_url',
  'approved','active','visible_in_ui','display_order','rating','review_count','extra_data',
  'external_id','source','category','product_category','product_subcategory'
] as const;

type AllowedCatalogField = typeof ALLOWED_CATALOG_FIELDS[number];

const sanitizeCatalogProductInput = (input: Partial<CatalogProduct>) => {
  const payload: Record<string, any> = {};
  ALLOWED_CATALOG_FIELDS.forEach((key) => {
    const value = input[key as keyof CatalogProduct];
    if (value !== undefined) {
      payload[key as AllowedCatalogField] = value;
    }
  });
  return payload;
};

export const useCatalogCRUD = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============= CRUD para produtos =============
  
  const fetchCatalogProducts = async (): Promise<CatalogProduct[]> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('system_a_catalog')
        .select('*')
        .eq('category', 'product')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar produtos';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const insertCatalogProduct = async (product: Omit<CatalogProduct, 'id'>): Promise<CatalogProduct | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const payload = sanitizeCatalogProductInput(product);
      const { data, error } = await supabase
        .from('system_a_catalog')
        .insert([payload as any])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Produto criado",
        description: `${product.name} foi adicionado ao catálogo`
      });
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar produto';
      setError(message);
      
      // 🆕 Log detalhado para debugging
      console.error('❌ Erro ao inserir produto:', {
        error: err,
        productData: product,
        requiredFields: {
          name: product.name,
          external_id: product.external_id,
          source: product.source,
          category: product.category
        }
      });
      
      toast({
        title: "Erro ao criar produto",
        description: message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateCatalogProduct = async (id: string, updates: Partial<CatalogProduct>): Promise<CatalogProduct | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('system_a_catalog')
        .update(sanitizeCatalogProductInput(updates) as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Produto atualizado",
        description: "As alterações foram salvas com sucesso"
      });
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar produto';
      setError(message);
      toast({
        title: "Erro ao atualizar produto",
        description: message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteCatalogProduct = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      // Primeiro deletar documentos associados
      const documents = await fetchProductDocuments(id);
      for (const doc of documents) {
        await deleteProductDocument(doc.id!, doc.file_url);
      }
      
      // Depois deletar o produto
      const { error } = await supabase
        .from('system_a_catalog')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Produto removido",
        description: "O produto foi excluído do catálogo"
      });
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar produto';
      setError(message);
      toast({
        title: "Erro ao deletar produto",
        description: message,
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ============= CRUD para documentos de produtos =============
  
  const fetchProductDocuments = async (productId: string): Promise<ProductDocument[]> => {
    try {
      const { data, error } = await supabase
        .from('catalog_documents')
        .select('*')
        .eq('product_id', productId)
        .eq('active', true)
        .order('order_index');
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
      return [];
    }
  };

  const insertProductDocument = async (doc: Omit<ProductDocument, 'id'>): Promise<ProductDocument | null> => {
    try {
      const { data, error } = await supabase
        .from('catalog_documents')
        .insert([doc])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Documento adicionado",
        description: `${doc.document_name} foi anexado ao produto`
      });
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar documento';
      toast({
        title: "Erro ao adicionar documento",
        description: message,
        variant: "destructive"
      });
      return null;
    }
  };

  const deleteProductDocument = async (id: string, fileUrl: string): Promise<boolean> => {
    try {
      // Extract the file path from the URL
      const fileName = fileUrl.split('/').pop();
      if (!fileName) {
        throw new Error('Nome de arquivo inválido');
      }

      // Delete the file from storage FIRST
      const { error: storageError } = await supabase.storage
        .from('catalog-documents')
        .remove([fileName]);

      if (storageError) {
        console.error('Erro ao deletar arquivo do storage:', storageError);
        throw new Error(`Falha ao remover arquivo: ${storageError.message}`);
      }

      // ONLY delete database record IF storage deletion was successful
      const { error: dbError } = await supabase
        .from('catalog_documents')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Erro ao deletar registro do banco:', dbError);
        throw new Error(`Falha ao remover registro: ${dbError.message}`);
      }

      toast({
        title: "Documento removido",
        description: "O arquivo foi deletado com sucesso"
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar documento';
      toast({
        title: "Erro ao deletar documento",
        description: message,
        variant: "destructive"
      });
      return false;
    }
  };

  const updateProductDocument = async (
    id: string, 
    updates: Partial<ProductDocument>
  ): Promise<ProductDocument | null> => {
    try {
      const { data, error } = await supabase
        .from('catalog_documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Documento atualizado",
        description: "Alterações salvas com sucesso"
      });
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar documento';
      toast({
        title: "Erro ao atualizar documento",
        description: message,
        variant: "destructive"
      });
      return null;
    }
  };

  // ============= Funções auxiliares para categorias =============
  
  const fetchCategories = async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('system_a_catalog')
        .select('product_category')
        .eq('category', 'product')
        .not('product_category', 'is', null);
      
      if (error) throw error;
      
      // Retornar lista única de categorias
      const uniqueCategories = [...new Set(data.map(d => d.product_category).filter(Boolean))];
      return uniqueCategories.sort();
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      return [];
    }
  };

  const fetchSubcategories = async (category?: string): Promise<string[]> => {
    try {
      let query = supabase
        .from('system_a_catalog')
        .select('product_subcategory')
        .eq('category', 'product')
        .not('product_subcategory', 'is', null);
      
      if (category) {
        query = query.eq('product_category', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Retornar lista única de subcategorias
      const uniqueSubcategories = [...new Set(data.map(d => d.product_subcategory).filter(Boolean))];
      return uniqueSubcategories.sort();
    } catch (err) {
      console.error('Erro ao buscar subcategorias:', err);
      return [];
    }
  };

  const clearError = () => setError(null);

  return {
    loading,
    error,
    clearError,
    
    // Produtos
    fetchCatalogProducts,
    insertCatalogProduct,
    updateCatalogProduct,
    deleteCatalogProduct,
    
    // Documentos
    fetchProductDocuments,
    insertProductDocument,
    updateProductDocument,
    deleteProductDocument,
    
    // Categorias
    fetchCategories,
    fetchSubcategories,
  };
};

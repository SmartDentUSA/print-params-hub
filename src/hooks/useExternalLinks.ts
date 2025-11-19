import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalLink {
  id: string;
  name: string;
  url: string;
  related_keywords: string[];
  relevance_score?: number;
  monthly_searches?: number;
}

export interface ProductCTA {
  id: string;
  resin_id: string;
  resin_name: string;
  manufacturer: string;
  slug: string;
  cta_label: string;
  cta_url: string;
  cta_type: string;
  cta_position: number;
}

export interface TechnicalDocument {
  id: string;
  document_name: string;
  document_description: string | null;
  file_url: string;
  product_name: string;      // Nome da resina OU produto
  manufacturer?: string;      // Opcional para produtos
  source: 'resin' | 'catalog'; // Origem do documento
  active: boolean;
}

export function useExternalLinks() {
  const [keywords, setKeywords] = useState<ExternalLink[]>([]);
  const [productCTAs, setProductCTAs] = useState<ProductCTA[]>([]);
  const [documents, setDocuments] = useState<TechnicalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchApprovedKeywords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('external_links')
        .select('id, name, url, related_keywords, relevance_score, monthly_searches')
        .eq('approved', true)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .order('monthly_searches', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setKeywords(data || []);
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      toast({
        title: 'Erro ao carregar keywords',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProductCTAs = async () => {
    try {
      // Buscar CTAs de resinas
      const { data: resinData, error: resinError } = await supabase
        .from('resins')
        .select(`
          id, name, manufacturer, slug, 
          cta_1_enabled, cta_1_label, cta_1_url, 
          cta_2_label, cta_2_url, cta_2_source_type,
          cta_3_label, cta_3_url, cta_3_source_type,
          cta_4_label, cta_4_url, cta_4_source_type
        `)
        .eq('active', true);

      if (resinError) throw resinError;

      // Buscar CTAs do catálogo
      const { data: catalogData, error: catalogError } = await supabase
        .from('system_a_catalog')
        .select(`
          id, name, slug,
          cta_1_label, cta_1_url,
          cta_2_label, cta_2_url,
          cta_3_label, cta_3_url
        `)
        .eq('active', true)
        .eq('approved', true);

      if (catalogError) throw catalogError;

      // Transformar em array de CTAs (flatten)
      const ctaList: ProductCTA[] = [];
      
      // Processar CTAs de resinas
      resinData?.forEach(resin => {
        // CTA 1 (E-commerce)
        if (resin.cta_1_enabled && resin.cta_1_url) {
          ctaList.push({
            id: `${resin.id}_cta1`,
            resin_id: resin.id,
            resin_name: resin.name,
            manufacturer: resin.manufacturer,
            slug: resin.slug,
            cta_label: resin.cta_1_label,
            cta_url: resin.cta_1_url,
            cta_type: 'E-commerce',
            cta_position: 1
          });
        }
        
        // CTA 2 (Inteligente)
        if (resin.cta_2_url) {
          ctaList.push({
            id: `${resin.id}_cta2`,
            resin_id: resin.id,
            resin_name: resin.name,
            manufacturer: resin.manufacturer,
            slug: resin.slug,
            cta_label: resin.cta_2_label,
            cta_url: resin.cta_2_url,
            cta_type: `CTA 2 (${resin.cta_2_source_type || 'manual'})`,
            cta_position: 2
          });
        }
        
        // CTA 3 (Inteligente)
        if (resin.cta_3_url) {
          ctaList.push({
            id: `${resin.id}_cta3`,
            resin_id: resin.id,
            resin_name: resin.name,
            manufacturer: resin.manufacturer,
            slug: resin.slug,
            cta_label: resin.cta_3_label,
            cta_url: resin.cta_3_url,
            cta_type: `CTA 3 (${resin.cta_3_source_type || 'manual'})`,
            cta_position: 3
          });
        }
        
        // CTA 4 (Inteligente)
        if (resin.cta_4_url) {
          ctaList.push({
            id: `${resin.id}_cta4`,
            resin_id: resin.id,
            resin_name: resin.name,
            manufacturer: resin.manufacturer,
            slug: resin.slug,
            cta_label: resin.cta_4_label,
            cta_url: resin.cta_4_url,
            cta_type: `CTA 4 (${resin.cta_4_source_type || 'manual'})`,
            cta_position: 4
          });
        }
      });

      // Processar CTAs do catálogo
      catalogData?.forEach(product => {
        // CTA 1
        if (product.cta_1_url && product.cta_1_label) {
          ctaList.push({
            id: `${product.id}_cta1`,
            resin_id: product.id,
            resin_name: product.name,
            manufacturer: 'Catálogo',
            slug: product.slug,
            cta_label: product.cta_1_label,
            cta_url: product.cta_1_url,
            cta_type: 'Produto (Catálogo)',
            cta_position: 1
          });
        }
        
        // CTA 2
        if (product.cta_2_url && product.cta_2_label) {
          ctaList.push({
            id: `${product.id}_cta2`,
            resin_id: product.id,
            resin_name: product.name,
            manufacturer: 'Catálogo',
            slug: product.slug,
            cta_label: product.cta_2_label,
            cta_url: product.cta_2_url,
            cta_type: 'Produto (Catálogo)',
            cta_position: 2
          });
        }
        
        // CTA 3
        if (product.cta_3_url && product.cta_3_label) {
          ctaList.push({
            id: `${product.id}_cta3`,
            resin_id: product.id,
            resin_name: product.name,
            manufacturer: 'Catálogo',
            slug: product.slug,
            cta_label: product.cta_3_label,
            cta_url: product.cta_3_url,
            cta_type: 'Produto (Catálogo)',
            cta_position: 3
          });
        }
      });

      // Ordenar por nome do produto e depois por posição do CTA
      ctaList.sort((a, b) => {
        const nameCompare = a.resin_name.localeCompare(b.resin_name);
        if (nameCompare !== 0) return nameCompare;
        return a.cta_position - b.cta_position;
      });
      
      setProductCTAs(ctaList);
    } catch (error: any) {
      console.error('Error fetching product CTAs:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      // Buscar documentos de resinas
      const { data: resinDocs, error: resinError } = await supabase
        .from('resin_documents')
        .select(`
          id,
          document_name,
          document_description,
          file_url,
          active,
          resins!inner(name, manufacturer)
        `)
        .eq('active', true)
        .order('document_name');

      if (resinError) throw resinError;

      // Buscar documentos do catálogo
      const { data: catalogDocs, error: catalogError } = await supabase
        .from('catalog_documents')
        .select(`
          id,
          document_name,
          document_description,
          file_url,
          active,
          system_a_catalog!inner(name, active, approved)
        `)
        .eq('active', true)
        .eq('system_a_catalog.active', true)
        .eq('system_a_catalog.approved', true)
        .order('document_name');

      if (catalogError) throw catalogError;

      // Mapear documentos de resinas
      const resinDocList: TechnicalDocument[] = resinDocs?.map((doc: any) => ({
        id: doc.id,
        document_name: doc.document_name,
        document_description: doc.document_description,
        file_url: doc.file_url,
        product_name: doc.resins.name,
        manufacturer: doc.resins.manufacturer,
        source: 'resin' as const,
        active: doc.active
      })) || [];

      // Mapear documentos do catálogo
      const catalogDocList: TechnicalDocument[] = catalogDocs?.map((doc: any) => ({
        id: doc.id,
        document_name: doc.document_name,
        document_description: doc.document_description,
        file_url: doc.file_url,
        product_name: doc.system_a_catalog.name,
        source: 'catalog' as const,
        active: doc.active
      })) || [];

      // Combinar e ordenar por nome
      const allDocs = [...resinDocList, ...catalogDocList].sort((a, b) => 
        a.document_name.localeCompare(b.document_name)
      );

      console.log('📄 Documentos carregados:', {
        resinDocs: resinDocList.length,
        catalogDocs: catalogDocList.length,
        total: allDocs.length
      });

      setDocuments(allDocs);
    } catch (error: any) {
      console.error('❌ Erro ao carregar documentos:', error);
      console.error('Stack trace:', error.stack);
      toast({
        title: '❌ Erro ao carregar PDFs',
        description: error.message || 'Verifique as permissões do banco',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchApprovedKeywords();
    fetchProductCTAs();
    fetchDocuments();
  }, []);

  const updateKeywordUrl = async (id: string, newUrl: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('external_links')
        .update({ url: newUrl, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '✅ URL atualizada',
        description: 'A URL foi atualizada com sucesso',
      });

      // Atualizar estado local
      setKeywords(prev => 
        prev.map(kw => kw.id === id ? { ...kw, url: newUrl } : kw)
      );

      return true;
    } catch (error: any) {
      console.error('Error updating keyword URL:', error);
      toast({
        title: '❌ Erro ao atualizar URL',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
      return false;
    }
  };

  return {
    keywords,
    productCTAs,
    documents,
    loading,
    refresh: fetchApprovedKeywords,
    refreshProductCTAs: fetchProductCTAs,
    refreshDocuments: fetchDocuments,
    updateKeywordUrl
  };
}
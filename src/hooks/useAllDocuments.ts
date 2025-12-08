import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DocumentSourceType = 'resin' | 'catalog';
export type DocumentLanguage = 'pt' | 'en' | 'es';

export const DOCUMENT_TYPES = [
  { value: 'ifu', label: 'IFU (Instruções de Uso)' },
  { value: 'fds', label: 'FDS (Ficha de Segurança)' },
  { value: 'manual', label: 'Manual Técnico' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'catalogo', label: 'Catálogo' },
  { value: 'guia', label: 'Guia de Aplicação' },
  { value: 'outro', label: 'Outro' },
] as const;

export const LANGUAGES = [
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

export interface DocumentWithDetails {
  id: string;
  source_type: DocumentSourceType;
  document_name: string;
  document_description: string | null;
  file_url: string;
  file_name: string;
  language: string;
  document_category: string | null;
  document_subcategory: string | null;
  document_type: string | null;
  extraction_status: string | null;
  extracted_text: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Relacionamentos
  linked_id: string;
  linked_name: string | null;
  linked_category: string | null;
  linked_subcategory: string | null;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface ProductOption {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
}

interface ResinOption {
  id: string;
  name: string;
  manufacturer: string;
}

export function useAllDocuments() {
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  // Options for dropdowns
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<CategoryOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [resins, setResins] = useState<ResinOption[]>([]);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    extracted: 0,
    pending: 0,
    failed: 0,
    pt: 0,
    en: 0,
    es: 0,
  });

  const pageSize = 50;

  // Fetch dropdown options
  useEffect(() => {
    const fetchOptions = async () => {
      // Fetch categories from products
      const { data: catData } = await supabase
        .from('system_a_catalog')
        .select('product_category, product_subcategory')
        .not('product_category', 'is', null);
      
      if (catData) {
        const uniqueCategories = [...new Set(catData.map(p => p.product_category).filter(Boolean))];
        const uniqueSubcategories = [...new Set(catData.map(p => p.product_subcategory).filter(Boolean))];
        setCategories(uniqueCategories.map(c => ({ value: c!, label: c! })));
        setSubcategories(uniqueSubcategories.map(s => ({ value: s!, label: s! })));
      }
      
      // Fetch products
      const { data: prodData } = await supabase
        .from('system_a_catalog')
        .select('id, name, product_category, product_subcategory')
        .eq('active', true)
        .order('name');
      
      if (prodData) {
        setProducts(prodData.map(p => ({
          id: p.id,
          name: p.name,
          category: p.product_category,
          subcategory: p.product_subcategory,
        })));
      }
      
      // Fetch resins
      const { data: resinData } = await supabase
        .from('resins')
        .select('id, name, manufacturer')
        .eq('active', true)
        .order('name');
      
      if (resinData) {
        setResins(resinData);
      }
    };
    
    fetchOptions();
  }, []);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch resin documents with resin info
      const { data: resinDocs, error: resinError } = await supabase
        .from('resin_documents')
        .select(`
          id,
          document_name,
          document_description,
          file_url,
          file_name,
          language,
          document_category,
          document_subcategory,
          document_type,
          extraction_status,
          extracted_text,
          created_at,
          updated_at,
          resin_id,
          resins!inner (
            id,
            name,
            manufacturer
          )
        `)
        .eq('active', true);
      
      if (resinError) {
        console.error('Error fetching resin docs:', resinError);
      }
      
      // Fetch catalog documents with product info
      const { data: catalogDocs, error: catalogError } = await supabase
        .from('catalog_documents')
        .select(`
          id,
          document_name,
          document_description,
          file_url,
          file_name,
          language,
          document_category,
          document_subcategory,
          document_type,
          extraction_status,
          extracted_text,
          created_at,
          updated_at,
          product_id,
          system_a_catalog!inner (
            id,
            name,
            product_category,
            product_subcategory
          )
        `)
        .eq('active', true);
      
      if (catalogError) {
        console.error('Error fetching catalog docs:', catalogError);
      }
      
      // Transform and combine
      const allDocs: DocumentWithDetails[] = [];
      
      if (resinDocs) {
        resinDocs.forEach((doc: any) => {
          allDocs.push({
            id: doc.id,
            source_type: 'resin',
            document_name: doc.document_name,
            document_description: doc.document_description,
            file_url: doc.file_url,
            file_name: doc.file_name,
            language: doc.language || 'pt',
            document_category: doc.document_category,
            document_subcategory: doc.document_subcategory,
            document_type: doc.document_type,
            extraction_status: doc.extraction_status,
            extracted_text: doc.extracted_text,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            linked_id: doc.resin_id,
            linked_name: doc.resins?.name || null,
            linked_category: doc.resins?.manufacturer || null,
            linked_subcategory: null,
          });
        });
      }
      
      if (catalogDocs) {
        catalogDocs.forEach((doc: any) => {
          allDocs.push({
            id: doc.id,
            source_type: 'catalog',
            document_name: doc.document_name,
            document_description: doc.document_description,
            file_url: doc.file_url,
            file_name: doc.file_name,
            language: doc.language || 'pt',
            document_category: doc.document_category,
            document_subcategory: doc.document_subcategory,
            document_type: doc.document_type,
            extraction_status: doc.extraction_status,
            extracted_text: doc.extracted_text,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            linked_id: doc.product_id,
            linked_name: doc.system_a_catalog?.name || null,
            linked_category: doc.system_a_catalog?.product_category || null,
            linked_subcategory: doc.system_a_catalog?.product_subcategory || null,
          });
        });
      }
      
      // Calculate stats
      const newStats = {
        total: allDocs.length,
        extracted: allDocs.filter(d => d.extraction_status === 'completed').length,
        pending: allDocs.filter(d => !d.extraction_status || d.extraction_status === 'pending').length,
        failed: allDocs.filter(d => d.extraction_status === 'failed').length,
        pt: allDocs.filter(d => d.language === 'pt').length,
        en: allDocs.filter(d => d.language === 'en').length,
        es: allDocs.filter(d => d.language === 'es').length,
      };
      setStats(newStats);
      
      // Apply filters
      let filtered = allDocs;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(d => 
          d.document_name.toLowerCase().includes(term) ||
          d.document_description?.toLowerCase().includes(term) ||
          d.linked_name?.toLowerCase().includes(term)
        );
      }
      
      if (languageFilter !== 'all') {
        filtered = filtered.filter(d => d.language === languageFilter);
      }
      
      if (documentTypeFilter !== 'all') {
        filtered = filtered.filter(d => d.document_type === documentTypeFilter);
      }
      
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          filtered = filtered.filter(d => !d.extraction_status || d.extraction_status === 'pending');
        } else {
          filtered = filtered.filter(d => d.extraction_status === statusFilter);
        }
      }
      
      if (sourceFilter !== 'all') {
        filtered = filtered.filter(d => d.source_type === sourceFilter);
      }
      
      setTotalCount(filtered.length);
      
      // Paginate
      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);
      
      setDocuments(paginated);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, languageFilter, documentTypeFilter, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Update document fields
  const updateDocumentFields = async (
    id: string,
    sourceType: DocumentSourceType,
    updates: Partial<{
      document_name: string;
      document_description: string;
      language: string;
      document_category: string;
      document_subcategory: string;
      document_type: string;
    }>
  ) => {
    const table = sourceType === 'resin' ? 'resin_documents' : 'catalog_documents';
    
    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating document:', error);
      toast.error('Erro ao atualizar documento');
      return false;
    }
    
    // Update local state
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, ...updates } : doc
    ));
    
    toast.success('Documento atualizado');
    return true;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    documents,
    loading,
    totalCount,
    page,
    setPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    languageFilter,
    setLanguageFilter,
    documentTypeFilter,
    setDocumentTypeFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    categories,
    subcategories,
    products,
    resins,
    stats,
    updateDocumentFields,
    refetch: fetchDocuments,
  };
}

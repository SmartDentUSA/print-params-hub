import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AdminCatalogFormSection } from '@/components/AdminCatalogFormSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, X, ExternalLink, Info, FileText, Plus, Trash2, ShoppingCart, Sparkles, BookOpen, Database } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/ImageUpload';
import { PublicAPIProductImporter } from '@/components/PublicAPIProductImporter';
import { uploadExternalImage } from '@/utils/uploadExternalImage';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseCRUD } from '@/hooks/useSupabaseCRUD';
import { useCatalogCRUD } from '@/hooks/useCatalogCRUD';
import { validateFileSize } from '@/utils/security';
import { Progress } from '@/components/ui/progress';

interface Brand {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  logo_url?: string;
}

interface Model {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  image_url?: string;
  active: boolean;
  notes?: string;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  active: boolean;
  color?: string;
  type?: string;
  image_url?: string;
  description?: string;
  price?: number;
  external_id?: string;
  system_a_product_id?: string;
  system_a_product_url?: string;
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
  cta_1_enabled?: boolean;
  cta_4_label?: string;
  cta_4_url?: string;
  cta_4_description?: string;
  cta_4_source_type?: string;
  cta_4_source_id?: string;
}

interface ParameterSet {
  id?: string;
  brand_slug: string;
  model_slug: string;
  resin_name: string;
  resin_manufacturer: string;
  layer_height: number;
  cure_time: number;
  bottom_layers?: number;
  bottom_cure_time?: number;
  lift_distance?: number;
  lift_speed?: number;
  retract_speed?: number;
  light_intensity: number;
  anti_aliasing?: boolean;
  xy_size_compensation?: number;
  xy_adjustment_x_pct?: number;
  xy_adjustment_y_pct?: number;
  wait_time_before_cure?: number;
  wait_time_after_cure?: number;
  wait_time_after_lift?: number;
  notes?: string;
  active: boolean;
}

// Validation schema for parameter sets
const parameterSetSchema = z.object({
  brand_slug: z.string().min(1, "Marca é obrigatória"),
  model_slug: z.string().min(1, "Modelo é obrigatório"),
  resin_name: z.string().min(1, "Resina é obrigatória"),
  resin_manufacturer: z.string().min(1, "Fabricante é obrigatório"),
  layer_height: z.number().min(0.01, "Mínimo 0.01mm").max(0.30, "Máximo 0.30mm"),
  cure_time: z.number().min(0, "Mínimo 0s").max(999.99, "Máximo 999.99s"),
  light_intensity: z.number().int().min(0, "Mínimo 0%").max(100, "Máximo 100%"),
  bottom_layers: z.number().int().min(0, "Mínimo 0").max(100, "Máximo 100").optional(),
  bottom_cure_time: z.number().min(0, "Mínimo 0s").max(999.99, "Máximo 999.99s").optional(),
  lift_distance: z.number().min(0, "Mínimo 0mm").max(999.99, "Máximo 999.99mm").optional(),
  lift_speed: z.number().min(0, "Mínimo 0mm/s").max(999.99, "Máximo 999.99mm/s").optional(),
  retract_speed: z.number().min(0, "Mínimo 0mm/s").max(999.99, "Máximo 999.99mm/s").optional(),
  xy_size_compensation: z.number().min(-999.99, "Mínimo -999.99mm").max(999.99, "Máximo 999.99mm").optional(),
  xy_adjustment_x_pct: z.number().int().min(0, "Mínimo 0%").max(1000, "Máximo 1000%").optional(),
  xy_adjustment_y_pct: z.number().int().min(0, "Mínimo 0%").max(1000, "Máximo 1000%").optional(),
  wait_time_before_cure: z.number().min(0, "Mínimo 0s").max(999.99, "Máximo 999.99s").optional(),
  wait_time_after_cure: z.number().min(0, "Mínimo 0s").max(999.99, "Máximo 999.99s").optional(),
  wait_time_after_lift: z.number().min(0, "Mínimo 0s").max(999.99, "Máximo 999.99s").optional(),
  active: z.boolean(),
});

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'brand' | 'model' | 'resin' | 'parameter' | 'catalog';
  item?: Brand | Model | Resin | ParameterSet | any | null;
  brands?: Brand[];
  models?: Model[];
  resins?: Resin[];
  onSave: (data: any, documents?: any[]) => Promise<void>;
}

export const AdminModal: React.FC<AdminModalProps> = ({ 
  isOpen, 
  onClose, 
  type, 
  item, 
  brands = [], 
  models = [],
  resins = [],
  onSave 
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const getInitialFormData = () => {
    if (item) {
      return { ...item };
    }
    
    switch (type) {
      case 'brand':
        return { name: '', logo_url: '', active: true };
      case 'model':
        return { name: '', brand_id: '', image_url: '', notes: '', active: true };
      case 'resin':
        return { 
          name: '', 
          manufacturer: '', 
          color: '', 
          type: 'standard', 
          description: '', 
          price: 0, 
          active: true,
          cta_1_enabled: true,
          cta_2_source_type: 'manual',
          cta_3_source_type: 'manual',
          cta_4_source_type: 'manual'
        };
      case 'catalog':
        return {
          source: 'manual',
          category: 'product',
          external_id: `manual-${Date.now()}`,
          name: '',
          slug: '',
          description: '',
          product_category: '',
          product_subcategory: '',
          price: 0,
          image_url: '',
          active: true,
          approved: true,
          visible_in_ui: false,
          cta_1_label: '',
          cta_1_url: '',
          cta_2_label: '',
          cta_2_url: '',
          cta_3_label: '',
          cta_3_url: ''
        };
      case 'parameter':
        return {
          brand_slug: '',
          model_slug: '',
          resin_name: '',
          resin_manufacturer: '',
          layer_height: 0.05,
          cure_time: 3,
          bottom_layers: 5,
          bottom_cure_time: 30,
          lift_distance: 5.0,
          lift_speed: 3.0,
          retract_speed: 3.0,
          light_intensity: 100,
          anti_aliasing: true,
          xy_size_compensation: 0.0,
          xy_adjustment_x_pct: 100,
          xy_adjustment_y_pct: 100,
          wait_time_before_cure: 0,
          wait_time_after_cure: 0,
          wait_time_after_lift: 0,
          notes: '',
          active: true,
        };
      default:
        return {};
    }
  };

  const [formData, setFormData] = useState<any>(getInitialFormData);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { fetchResinDocuments, insertResinDocument, deleteResinDocument } = useSupabaseCRUD();
  
  // 🆕 Recursos do sistema para CTA4
  const [systemResources, setSystemResources] = useState<{
    documents: any[];
    externalLinks: any[];
    knowledgeArticles: any[];
  }>({
    documents: [],
    externalLinks: [],
    knowledgeArticles: []
  });

  // Update form data when item or type changes
  useEffect(() => {
    setFormData(getInitialFormData());
    
    // Carregar documentos e recursos do sistema se for tipo resin ou catalog
    if ((type === 'resin' || type === 'catalog') && isOpen) {
      const fetchData = async () => {
        // Carregar documentos (resina ou catálogo)
        if (item && 'id' in item) {
          if (type === 'resin') {
            const docs = await fetchResinDocuments(item.id);
            setDocuments(docs);
            
            // Buscar recursos do sistema para CTA - APENAS documentos desta resina
            const { data: allDocs } = await supabase
              .from('resin_documents')
              .select('id, document_name, file_url, resins!inner(name, manufacturer)')
              .eq('active', true)
              .eq('resin_id', item.id)
              .order('document_name');
            
            const { data: links } = await supabase
              .from('external_links')
              .select('id, name, url, category')
              .eq('approved', true)
              .order('name');
            
            const { data: articles } = await supabase
              .from('knowledge_contents')
              .select('id, title, slug')
              .eq('active', true)
              .order('title');
            
            setSystemResources({
              documents: allDocs || [],
              externalLinks: links || [],
              knowledgeArticles: articles || []
            });
          } else if (type === 'catalog') {
            // Carregar documentos do catálogo
            const { data: docs } = await supabase
              .from('catalog_documents')
              .select('*')
              .eq('product_id', item.id)
              .eq('active', true)
              .order('order_index');
            
            setDocuments(docs || []);
            
            // Recursos para CTAs
            const { data: links } = await supabase
              .from('external_links')
              .select('id, name, url, category')
              .eq('approved', true)
              .order('name');
            
            const { data: articles } = await supabase
              .from('knowledge_contents')
              .select('id, title, slug')
              .eq('active', true)
              .order('title');
            
            setSystemResources({
              documents: docs || [],
              externalLinks: links || [],
              knowledgeArticles: articles || []
            });
          }
        } else {
          // Novo item: sem documentos ainda
          setDocuments([]);
          
          const { data: links } = await supabase
            .from('external_links')
            .select('id, name, url, category')
            .eq('approved', true)
            .order('name');
          
          const { data: articles } = await supabase
            .from('knowledge_contents')
            .select('id, title, slug')
            .eq('active', true)
            .order('title');
          
          setSystemResources({
            documents: [],
            externalLinks: links || [],
            knowledgeArticles: articles || []
          });
        }
      };
      
      fetchData();
    }
  }, [item, type, isOpen]);

  // Filter models based on selected brand for parameter form
  const availableModels = formData.brand_slug 
    ? models.filter(model => {
        const selectedBrand = brands.find(b => b.slug === formData.brand_slug);
        return selectedBrand && model.brand_id === selectedBrand.id;
      })
    : models;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Generate slug for brands and models if creating new ones
      if ((type === 'brand' || type === 'model') && formData.name && !item) {
        formData.slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      }
      
      // Sanitize slug for resins: prevent URLs from being used as slugs
      if (type === 'resin' && formData.slug) {
        // If slug contains protocol (http:// or https://), extract only the final path
        if (formData.slug.includes('://')) {
          const urlParts = formData.slug.split('/');
          const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'resin';
          formData.slug = lastPart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          
          console.log('⚠️ Slug corrigido de URL para:', formData.slug);
          toast({
            title: "Slug corrigido",
            description: `O slug foi corrigido de URL para: ${formData.slug}`,
          });
        }
      }
      
      // Sanitize correlation fields for resins: convert empty strings to null
      if (type === 'resin') {
        const correlationFields = ['external_id', 'system_a_product_id', 'system_a_product_url'] as const;
        correlationFields.forEach(field => {
          if (formData[field] === '' || formData[field] === undefined) {
            formData[field] = null;
          }
        });
        
        console.log('🧹 Campos de correlação sanitizados:', {
          external_id: formData.external_id,
          system_a_product_id: formData.system_a_product_id,
          system_a_product_url: formData.system_a_product_url
        });
      }
      
      // For parameters, validate and convert fields
      if (type === 'parameter') {
        // Ensure we have proper slugs and manufacturer
        if (formData.brand_slug) {
          const selectedBrand = brands.find(b => b.slug === formData.brand_slug);
          if (selectedBrand) formData.brand_slug = selectedBrand.slug;
        }
        
        if (formData.model_slug) {
          const selectedModel = models.find(m => m.slug === formData.model_slug);
          if (selectedModel) formData.model_slug = selectedModel.slug;
        }
        
        if (formData.resin_name) {
          const selectedResin = resins.find(r => r.name === formData.resin_name);
          if (selectedResin) formData.resin_manufacturer = selectedResin.manufacturer;
        }

        // Convert all numeric fields to numbers and clamp to 2 decimals
        const numericFields = [
          'layer_height', 'cure_time', 'bottom_cure_time', 'lift_distance',
          'lift_speed', 'retract_speed', 'xy_size_compensation',
          'wait_time_before_cure', 'wait_time_after_cure', 'wait_time_after_lift'
        ];

        numericFields.forEach(field => {
          if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
            const num = Number(formData[field]);
            formData[field] = Math.round(num * 100) / 100; // Round to 2 decimals
          }
        });

        // Convert integer fields
        const intFields = ['light_intensity', 'bottom_layers', 'xy_adjustment_x_pct', 'xy_adjustment_y_pct'];
        intFields.forEach(field => {
          if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
            formData[field] = Math.round(Number(formData[field]));
          }
        });

        // Validate with zod schema
        const validation = parameterSetSchema.safeParse(formData);
        
        if (!validation.success) {
          const firstError = validation.error.errors[0];
          toast({
            title: "Erro de validação",
            description: firstError.message,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }
      
      await onSave(formData, documents);
      // Don't close here - let parent component close on success
    } catch (error) {
      // Error will be handled by parent
      console.error('Error in handleSave:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    
    // If brand changes in parameter form, reset the model selection
    if (field === 'brand_slug' && type === 'parameter') {
      newFormData.model_slug = '';
    }
    
    // If resin changes, update manufacturer
    if (field === 'resin_name' && type === 'parameter') {
      const selectedResin = resins.find(r => r.name === value);
      if (selectedResin) {
        newFormData.resin_manufacturer = selectedResin.manufacturer;
      }
    }
    
    setFormData(newFormData);
  };

  const handleLojaIntegradaImport = async (importedData: any) => {
    try {
      console.log('📦 Dados recebidos do importador:', importedData);

      // 1️⃣ PREENCHER CAMPOS IMEDIATAMENTE (ANTES do upload)
      const parsedPrice = importedData.price 
        ? parseFloat(importedData.price.toString().replace(/\./g, '').replace(',', '.')) 
        : 0;
      
      setFormData((prev: any) => ({
        ...prev,
        description: importedData.description || prev.description || '',
        price: parsedPrice || prev.price || 0,
        // Usar URL externa temporariamente (funciona mesmo sem upload)
        image_url: importedData.image_url || prev.image_url || '',
        
        // 🆕 Campos de correlação entre sistemas
        external_id: importedData.external_id || prev.external_id || null,
        system_a_product_id: importedData.system_a_product_id || prev.system_a_product_id || null,
        system_a_product_url: importedData.system_a_product_url || prev.system_a_product_url || null,
        
        // 🔵 Campos SEO invisíveis (Sistema A) - mapeamento corrigido
        seo_title_override: importedData.seo_title_override || prev.seo_title_override || '',
        meta_description: importedData.meta_description || prev.meta_description || '',
        og_image_url: importedData.og_image_url || prev.og_image_url || '',
        canonical_url: importedData.canonical_url || prev.canonical_url || '',
        slug: importedData.slug || prev.slug || '',
        keywords: importedData.keywords || prev.keywords || [],
      }));

      console.log('✅ Campos preenchidos IMEDIATAMENTE:', {
        description: importedData.description?.substring(0, 50) + '...',
        price: parsedPrice,
        image_url: 'URL externa (temporária)'
      });

      // 2️⃣ TENTAR UPLOAD (não bloqueia se falhar)
      try {
        if (importedData.image_url) {
          console.log('🔄 Tentando upload da imagem para Supabase...');
          
          const timestamp = Date.now();
          const fileName = `resin-${formData.id || 'new'}-${timestamp}.webp`;
          
          const supabaseImageUrl = await uploadExternalImage(
            importedData.image_url,
            fileName
          );

          console.log('✅ Upload concluído! URL Supabase:', supabaseImageUrl);

          // Atualizar com URL do Supabase (melhora a URL)
          setFormData((prev: any) => ({
            ...prev,
            image_url: supabaseImageUrl
          }));
        }
      } catch (uploadError) {
        console.warn('⚠️ Upload da imagem falhou, mantendo URL externa:', uploadError);
        // Não faz nada - campos já estão preenchidos com URL externa
      }

      // 🆕 Indicador visual de campos enriquecidos
      const seoFieldsImported = !!(importedData.meta_description || importedData.og_image_url || importedData.keywords?.length);
      
      toast({
        title: "✅ Importação concluída!",
        description: seoFieldsImported 
          ? `✨ Produto sincronizado com catálogo público + SEO otimizado. Revise e salve.`
          : `✨ Produto importado e sincronizado. Revise e salve.`,
      });

    } catch (error) {
      console.error('❌ Erro ao processar importação:', error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : 'Erro ao processar dados',
        variant: "destructive"
      });
    }
  };

  // Funções de gerenciamento de documentos
  const handleAddDocument = () => {
    setDocuments([...documents, {
      document_name: '',
      document_description: '',
      file_url: '',
      file_name: '',
      file_size: 0,
      order_index: documents.length
    }]);
  };

  const handleDocumentChange = (index: number, field: string, value: any) => {
    const updatedDocs = [...documents];
    updatedDocs[index] = { ...updatedDocs[index], [field]: value };
    setDocuments(updatedDocs);
  };

  const handleDocumentUpload = async (index: number, file: File | undefined) => {
    if (!file) return;
    
    if (!validateFileSize(file, 50)) {
      toast({
        title: "Arquivo muito grande",
        description: "PDFs devem ter no máximo 50MB",
        variant: "destructive"
      });
      return;
    }
    
    // Validar que a resina foi salva primeiro
    if (!formData.id) {
      toast({
        title: "Salve a resina primeiro",
        description: "Clique em 'Salvar' antes de fazer upload de documentos",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.slug || formData.slug.trim() === '') {
      toast({
        title: "Slug obrigatório",
        description: "Preencha o campo 'Slug' antes de fazer upload de documentos",
        variant: "destructive"
      });
      return;
    }
    
    setUploadingDocIndex(index);
    setUploadProgress(0);
    
    // Simular progresso baseado no tamanho do arquivo
    const fileSize = file.size;
    const estimatedTime = Math.max(3000, fileSize / 50000); // ~3s mínimo
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev; // Para em 90% e espera o upload terminar
        return prev + 10;
      });
    }, estimatedTime / 9);
    
    try {
      const fileExt = 'pdf';
      const fileName = `${formData.slug || 'resin'}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('resin-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('resin-documents')
        .getPublicUrl(fileName);
      
      // Salvar no banco de dados
      const documentData = {
        resin_id: formData.id,
        document_name: documents[index].document_name || file.name.replace('.pdf', ''),
        document_description: documents[index].document_description || '',
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        order_index: index,
        active: true
      };

      const newDocument = await insertResinDocument(documentData);

      if (newDocument) {
        const updatedDocs = [...documents];
        updatedDocs[index] = newDocument;
        setDocuments(updatedDocs);
        
        toast({
          title: "Upload concluído!",
          description: `${file.name} foi salvo com sucesso`
        });
      } else {
        throw new Error('Falha ao salvar documento no banco de dados');
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setUploadingDocIndex(null);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDeleteDocument = async (docId?: string, fileUrl?: string) => {
    if (docId) {
      const success = await deleteResinDocument(docId, fileUrl || '');
      if (success) {
        setDocuments(documents.filter(doc => doc.id !== docId));
        toast({
          title: "Documento removido",
          description: "Documento técnico foi removido com sucesso"
        });
      }
    } else {
      // Remover documento não salvo ainda
      const index = documents.findIndex(doc => doc.file_url === fileUrl);
      if (index !== -1) {
        setDocuments(documents.filter((_, i) => i !== index));
      }
    }
  };

  // 📄 Handlers para documentos do CATÁLOGO
  const { insertProductDocument, deleteProductDocument } = useCatalogCRUD();

  const handleCatalogDocumentUpload = async (index: number, file: File | undefined) => {
    if (!file) return;
    
    if (!validateFileSize(file, 50)) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 50MB",
        variant: "destructive"
      });
      return;
    }
    
    setUploadingDocIndex(index);
    setUploadProgress(0);
    
    const fileSize = file.size;
    const estimatedTime = Math.max(3000, fileSize / 50000);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, estimatedTime / 9);
    
    try {
      const fileName = `${formData.slug || 'product'}-${Date.now()}.pdf`;
      
      const { data, error } = await supabase.storage
        .from('catalog-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('catalog-documents')
        .getPublicUrl(fileName);
      
      // Salvar no banco de dados
      const documentData = {
        product_id: formData.id,
        document_name: documents[index].document_name || file.name.replace('.pdf', ''),
        document_description: documents[index].document_description || '',
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        order_index: index,
        active: true
      };

      const newDocument = await insertProductDocument(documentData);

      if (newDocument) {
        const updatedDocs = [...documents];
        updatedDocs[index] = newDocument;
        setDocuments(updatedDocs);
        
        toast({
          title: "Upload concluído!",
          description: `${file.name} foi salvo com sucesso`
        });
      } else {
        throw new Error('Falha ao salvar documento no banco de dados');
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setUploadingDocIndex(null);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDeleteCatalogDocument = async (docId?: string, fileUrl?: string) => {
    if (!docId) {
      // Remover documento não salvo
      const index = documents.findIndex(doc => doc.file_url === fileUrl);
      if (index !== -1) {
        setDocuments(documents.filter((_, i) => i !== index));
      }
      return;
    }
    
    const success = await deleteProductDocument(docId, fileUrl || '');
    
    if (success) {
      setDocuments(documents.filter(doc => doc.id !== docId));
      toast({
        title: "Documento removido",
        description: "Documento técnico foi removido com sucesso"
      });
    }
  };

  // 🆕 Handler para mudar tipo de fonte do CTA4
  const handleCTA4SourceChange = (sourceType: string) => {
    setFormData({
      ...formData,
      cta_4_source_type: sourceType,
      cta_4_source_id: null,
      cta_4_url: '',
      cta_4_label: ''
    });
  };

  // 🆕 Handler para selecionar recurso do sistema
  const handleCTA4ResourceSelect = (resourceId: string) => {
    const sourceType = formData.cta_4_source_type;
    let selectedResource: any = null;
    let generatedLabel = '';
    let generatedUrl = '';
    
    if (sourceType === 'document') {
      selectedResource = systemResources.documents.find((d: any) => d.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.document_name;
        const filename = selectedResource.file_url.split('/').pop() || '';
        generatedUrl = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/document-proxy/${filename}`;
      }
    } else if (sourceType === 'external_link') {
      selectedResource = systemResources.externalLinks.find((l: any) => l.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.name;
        generatedUrl = selectedResource.url;
      }
    } else if (sourceType === 'knowledge') {
      selectedResource = systemResources.knowledgeArticles.find((a: any) => a.id === resourceId);
      if (selectedResource) {
        generatedLabel = 'Leia: ' + selectedResource.title;
        generatedUrl = `https://parametros.smartdent.com.br/base-de-conhecimento/${selectedResource.slug}`;
      }
    }
    
    setFormData({
      ...formData,
      cta_4_source_id: resourceId,
      cta_4_url: generatedUrl,
      cta_4_label: generatedLabel
    });
  };

  // 🆕 Handlers para CTA 2
  const handleCTA2SourceChange = (sourceType: string) => {
    setFormData({
      ...formData,
      cta_2_source_type: sourceType,
      cta_2_source_id: null,
      cta_2_url: '',
      cta_2_label: ''
    });
  };

  const handleCTA2ResourceSelect = (resourceId: string) => {
    const sourceType = formData.cta_2_source_type;
    let selectedResource: any = null;
    let generatedLabel = '';
    let generatedUrl = '';
    
    if (sourceType === 'document') {
      selectedResource = systemResources.documents.find((d: any) => d.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.document_name;
        const filename = selectedResource.file_url.split('/').pop() || '';
        generatedUrl = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/document-proxy/${filename}`;
      }
    } else if (sourceType === 'external_link') {
      selectedResource = systemResources.externalLinks.find((l: any) => l.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.name;
        generatedUrl = selectedResource.url;
      }
    } else if (sourceType === 'knowledge') {
      selectedResource = systemResources.knowledgeArticles.find((a: any) => a.id === resourceId);
      if (selectedResource) {
        generatedLabel = 'Leia: ' + selectedResource.title;
        generatedUrl = `https://parametros.smartdent.com.br/base-de-conhecimento/${selectedResource.slug}`;
      }
    }
    
    setFormData({
      ...formData,
      cta_2_source_id: resourceId,
      cta_2_url: generatedUrl,
      cta_2_label: generatedLabel
    });
  };

  // 🆕 Handlers para CTA 3
  const handleCTA3SourceChange = (sourceType: string) => {
    setFormData({
      ...formData,
      cta_3_source_type: sourceType,
      cta_3_source_id: null,
      cta_3_url: '',
      cta_3_label: ''
    });
  };

  const handleCTA3ResourceSelect = (resourceId: string) => {
    const sourceType = formData.cta_3_source_type;
    let selectedResource: any = null;
    let generatedLabel = '';
    let generatedUrl = '';
    
    if (sourceType === 'document') {
      selectedResource = systemResources.documents.find((d: any) => d.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.document_name;
        const filename = selectedResource.file_url.split('/').pop() || '';
        generatedUrl = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/document-proxy/${filename}`;
      }
    } else if (sourceType === 'external_link') {
      selectedResource = systemResources.externalLinks.find((l: any) => l.id === resourceId);
      if (selectedResource) {
        generatedLabel = selectedResource.name;
        generatedUrl = selectedResource.url;
      }
    } else if (sourceType === 'knowledge') {
      selectedResource = systemResources.knowledgeArticles.find((a: any) => a.id === resourceId);
      if (selectedResource) {
        generatedLabel = 'Leia: ' + selectedResource.title;
        generatedUrl = `https://parametros.smartdent.com.br/base-de-conhecimento/${selectedResource.slug}`;
      }
    }
    
    setFormData({
      ...formData,
      cta_3_source_id: resourceId,
      cta_3_url: generatedUrl,
      cta_3_label: generatedLabel
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getModalTitle = () => {
    const action = item ? 'Editar' : 'Criar';
    switch (type) {
      case 'brand': return `${action} Marca`;
      case 'model': return `${action} Modelo`;
      case 'resin': return `${action} Resina`;
      case 'catalog': return `${action} Produto`;
      case 'parameter': return `${action} Parâmetros`;
      default: return action;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            {type === 'parameter' && 'Configure os parâmetros de impressão para esta combinação'}
            {type === 'brand' && 'Adicione ou edite informações da marca'}
            {type === 'model' && 'Adicione ou edite informações do modelo'}
            {type === 'resin' && 'Adicione ou edite informações da resina'}
            {type === 'catalog' && 'Adicione ou edite informações do produto do catálogo'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {type === 'brand' && (
            <>
              <div>
                <Label htmlFor="name">Nome da Marca</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: ELEGOO"
                />
              </div>
              <div>
                <Label htmlFor="logo-url">URL do Logo</Label>
                <Input
                  id="logo-url"
                  value={formData.logo_url || ''}
                  onChange={(e) => handleInputChange('logo_url', e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                />
                {formData.logo_url && (
                  <div className="mt-2">
                    <img 
                      src={formData.logo_url} 
                      alt="Preview"
                      className="w-16 h-16 object-contain rounded border"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'model' && (
            <>
              <div>
                <Label htmlFor="brand-id">Marca</Label>
                <Select value={formData.brand_id || ''} onValueChange={(value) => handleInputChange('brand_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.filter(brand => brand.id && brand.id.trim() !== '').map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Nome do Modelo</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Mars 2"
                />
              </div>
              <div>
                <Label htmlFor="image-url">URL da Imagem</Label>
                <Input
                  id="image-url"
                  value={formData.image_url || ''}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                {formData.image_url && (
                  <div className="mt-2">
                    <img 
                      src={formData.image_url} 
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Notas sobre o modelo..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'resin' && (
            <>
              <PublicAPIProductImporter
                onImportSuccess={handleLojaIntegradaImport}
                onImportError={(error) => console.error('Erro ao importar:', error)}
              />

              <div>
                <Label htmlFor="name">Nome da Resina</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Smart Print Model Ocre"
                />
              </div>
              <div>
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer || ''}
                  onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  placeholder="Ex: Smart Print"
                />
              </div>
              
              {/* 🆕 Campos de Correlação de Sistemas */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">IDs de Correlação entre Sistemas</Label>
                </div>
                
                <div>
                  <Label htmlFor="external_id">
                    ID Loja Integrada
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 ml-1 inline text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>ID numérico da Loja Integrada</p>
                          <p className="text-xs text-muted-foreground">Ex: 365210617</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="external_id"
                    value={formData.external_id || ''}
                    onChange={(e) => handleInputChange('external_id', e.target.value)}
                    placeholder="365210617"
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="system_a_product_id">
                    UUID Sistema A
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 ml-1 inline text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>UUID único do produto no Sistema A</p>
                          <p className="text-xs text-muted-foreground">Ex: 832fa3e7-b24c-471f-966e-4ded6270fa67</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="system_a_product_id"
                    value={formData.system_a_product_id || ''}
                    onChange={(e) => handleInputChange('system_a_product_id', e.target.value)}
                    placeholder="832fa3e7-..."
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="system_a_product_url">
                    URL do Produto
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 ml-1 inline text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>URL canônica do produto na loja</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="system_a_product_url"
                    value={formData.system_a_product_url || ''}
                    onChange={(e) => handleInputChange('system_a_product_url', e.target.value)}
                    placeholder="https://loja.smartdent.com.br/..."
                    className="text-sm"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="color">Cor</Label>
                <Input
                  id="color"
                  value={formData.color || ''}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  placeholder="Ex: #FF5733"
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select value={formData.type || 'standard'} onValueChange={(value) => handleInputChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="tough">Tough</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                    <SelectItem value="water_washable">Water Washable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campo Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição do Produto</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrição detalhada (preenchida automaticamente na importação)"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Este campo é preenchido automaticamente ao importar do Sistema A
                </p>
              </div>

              {/* Campo Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price || ''}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Usado para SEO (Schema.org Offers)
                </p>
              </div>

              {/* Image Upload Section */}
              <ImageUpload
                currentImageUrl={formData.image_url || ''}
                onImageUploaded={(url) => {
                  setFormData(prev => ({ ...prev, image_url: url }));
                }}
                modelSlug={`resin-${formData.id || 'new'}`}
                disabled={false}
              />
              
              {/* CTAs Customizáveis */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Botões de Ação (CTAs)</Label>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="cta-1">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span>CTA 1 - E-commerce</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      {/* 🆕 Toggle Ativar/Desativar */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="cta_1_enabled" className="cursor-pointer">
                            Ativar botão E-commerce
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm">Desative para ocultar o botão de compra</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          id="cta_1_enabled"
                          checked={formData.cta_1_enabled !== false}
                          onCheckedChange={(checked) => handleInputChange('cta_1_enabled', checked)}
                        />
                      </div>
                      
                      {/* Campos só aparecem se ativado */}
                      {formData.cta_1_enabled !== false && (
                        <>
                          <div>
                            <Label htmlFor="cta_1_label">Nome do Botão</Label>
                        <Input
                          id="cta_1_label"
                          value={formData.cta_1_label || ''}
                          onChange={(e) => handleInputChange('cta_1_label', e.target.value)}
                          placeholder="Ex: Comprar"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cta_1_url">URL</Label>
                        <Input
                          id="cta_1_url"
                          type="url"
                          value={formData.cta_1_url || ''}
                          onChange={(e) => handleInputChange('cta_1_url', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="cta_1_description">Descrição SEO</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">Descrição invisível para usuários, usada para SEO e acessibilidade. Máx: 200 caracteres.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          id="cta_1_description"
                          value={formData.cta_1_description || ''}
                          onChange={(e) => handleInputChange('cta_1_description', e.target.value)}
                          placeholder="Ex: Compre Smart Print Model Ocre no nosso e-commerce com entrega rápida"
                          maxLength={200}
                          className="resize-none"
                          rows={3}
                        />
                            <p className="text-xs text-muted-foreground mt-1">
                              {(formData.cta_1_description || '').length}/200 caracteres
                            </p>
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="cta-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>CTA 2 - Seletor Inteligente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      {/* Seletor de Tipo de Fonte */}
                      <div>
                        <Label className="mb-2 block">Tipo de Conteúdo</Label>
                        <RadioGroup 
                          value={formData.cta_2_source_type || 'manual'} 
                          onValueChange={handleCTA2SourceChange}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="manual" id="cta2-manual" />
                            <Label htmlFor="cta2-manual" className="flex-1 cursor-pointer">
                              <div className="font-medium">URL Manual</div>
                              <p className="text-xs text-muted-foreground">Digite um link customizado</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="document" id="cta2-document" />
                            <Label htmlFor="cta2-document" className="flex-1 cursor-pointer">
                              <div className="font-medium">Documento Técnico</div>
                              <p className="text-xs text-muted-foreground">Vincular PDF cadastrado no sistema</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="external_link" id="cta2-external" />
                            <Label htmlFor="cta2-external" className="flex-1 cursor-pointer">
                              <div className="font-medium">Link Externo Aprovado</div>
                              <p className="text-xs text-muted-foreground">Usar link da base de externos</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="knowledge" id="cta2-knowledge" />
                            <Label htmlFor="cta2-knowledge" className="flex-1 cursor-pointer">
                              <div className="font-medium">Artigo da Base de Conhecimento</div>
                              <p className="text-xs text-muted-foreground">Landing page interna</p>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      {/* MANUAL: Input de URL customizada */}
                      {formData.cta_2_source_type === 'manual' && (
                        <>
                          <div>
                            <Label htmlFor="cta_2_label">Nome do Botão</Label>
                            <Input
                              id="cta_2_label"
                              value={formData.cta_2_label || ''}
                              onChange={(e) => handleInputChange('cta_2_label', e.target.value)}
                              placeholder="Ex: Ficha Técnica"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cta_2_url">URL</Label>
                            <Input
                              id="cta_2_url"
                              type="url"
                              value={formData.cta_2_url || ''}
                              onChange={(e) => handleInputChange('cta_2_url', e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </>
                      )}
                      
                      {/* DOCUMENT: Seletor de documentos técnicos */}
                      {formData.cta_2_source_type === 'document' && (
                        <div>
                          <Label htmlFor="cta_2_doc_select">Selecionar Documento</Label>
                          
                          {systemResources.documents.length === 0 ? (
                            <div className="border rounded-lg p-4 bg-muted/50 text-center">
                              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">
                                {!item || !('id' in item) 
                                  ? "💡 Salve a resina primeiro para vincular documentos técnicos"
                                  : "📄 Nenhum documento técnico cadastrado para esta resina ainda"
                                }
                              </p>
                            </div>
                          ) : (
                            <>
                              <Select 
                                value={formData.cta_2_source_id || ''} 
                                onValueChange={handleCTA2ResourceSelect}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha um documento técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {systemResources.documents.map((doc: any) => (
                                    <SelectItem key={doc.id} value={doc.id}>
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <div>
                                          <div className="font-medium">{doc.document_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {doc.resins.name} - {doc.resins.manufacturer}
                                          </div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {formData.cta_2_url && (
                                <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                  <strong>Label gerado:</strong> {formData.cta_2_label}<br/>
                                  <strong>URL:</strong> <a href={formData.cta_2_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_2_url}</a>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* EXTERNAL_LINK: Seletor de links externos */}
                      {formData.cta_2_source_type === 'external_link' && (
                        <div>
                          <Label htmlFor="cta_2_link_select">Selecionar Link Externo</Label>
                          <Select 
                            value={formData.cta_2_source_id || ''} 
                            onValueChange={handleCTA2ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um link aprovado..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.externalLinks.map((link: any) => (
                                <SelectItem key={link.id} value={link.id}>
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    <div>
                                      <div className="font-medium">{link.name}</div>
                                      <div className="text-xs text-muted-foreground">{link.category}</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_2_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_2_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_2_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_2_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* KNOWLEDGE: Seletor de artigos */}
                      {formData.cta_2_source_type === 'knowledge' && (
                        <div>
                          <Label htmlFor="cta_2_article_select">Selecionar Artigo</Label>
                          <Select 
                            value={formData.cta_2_source_id || ''} 
                            onValueChange={handleCTA2ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um artigo da base..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.knowledgeArticles.map((article: any) => (
                                <SelectItem key={article.id} value={article.id}>
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    <div className="font-medium">{article.title}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_2_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_2_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_2_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_2_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Descrição SEO (comum para todos os tipos) */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="cta_2_description">Descrição SEO</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">Descrição invisível para usuários, usada para SEO e acessibilidade. Máx: 200 caracteres.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          id="cta_2_description"
                          value={formData.cta_2_description || ''}
                          onChange={(e) => handleInputChange('cta_2_description', e.target.value)}
                          placeholder="Ex: Acesse dados técnicos completos da resina"
                          maxLength={200}
                          className="resize-none"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(formData.cta_2_description || '').length}/200 caracteres
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="cta-3">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>CTA 3 - Seletor Inteligente</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      {/* Seletor de Tipo de Fonte */}
                      <div>
                        <Label className="mb-2 block">Tipo de Conteúdo</Label>
                        <RadioGroup 
                          value={formData.cta_3_source_type || 'manual'} 
                          onValueChange={handleCTA3SourceChange}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="manual" id="cta3-manual" />
                            <Label htmlFor="cta3-manual" className="flex-1 cursor-pointer">
                              <div className="font-medium">URL Manual</div>
                              <p className="text-xs text-muted-foreground">Digite um link customizado</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="document" id="cta3-document" />
                            <Label htmlFor="cta3-document" className="flex-1 cursor-pointer">
                              <div className="font-medium">Documento Técnico</div>
                              <p className="text-xs text-muted-foreground">Vincular PDF cadastrado no sistema</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="external_link" id="cta3-external" />
                            <Label htmlFor="cta3-external" className="flex-1 cursor-pointer">
                              <div className="font-medium">Link Externo Aprovado</div>
                              <p className="text-xs text-muted-foreground">Usar link da base de externos</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="knowledge" id="cta3-knowledge" />
                            <Label htmlFor="cta3-knowledge" className="flex-1 cursor-pointer">
                              <div className="font-medium">Artigo da Base de Conhecimento</div>
                              <p className="text-xs text-muted-foreground">Landing page interna</p>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      {/* MANUAL: Input de URL customizada */}
                      {formData.cta_3_source_type === 'manual' && (
                        <>
                          <div>
                            <Label htmlFor="cta_3_label">Nome do Botão</Label>
                            <Input
                              id="cta_3_label"
                              value={formData.cta_3_label || ''}
                              onChange={(e) => handleInputChange('cta_3_label', e.target.value)}
                              placeholder="Ex: Suporte"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cta_3_url">URL</Label>
                            <Input
                              id="cta_3_url"
                              type="url"
                              value={formData.cta_3_url || ''}
                              onChange={(e) => handleInputChange('cta_3_url', e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </>
                      )}
                      
                      {/* DOCUMENT: Seletor de documentos técnicos */}
                      {formData.cta_3_source_type === 'document' && (
                        <div>
                          <Label htmlFor="cta_3_doc_select">Selecionar Documento</Label>
                          
                          {systemResources.documents.length === 0 ? (
                            <div className="border rounded-lg p-4 bg-muted/50 text-center">
                              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">
                                {!item || !('id' in item) 
                                  ? "💡 Salve a resina primeiro para vincular documentos técnicos"
                                  : "📄 Nenhum documento técnico cadastrado para esta resina ainda"
                                }
                              </p>
                            </div>
                          ) : (
                            <>
                              <Select 
                                value={formData.cta_3_source_id || ''} 
                                onValueChange={handleCTA3ResourceSelect}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha um documento técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {systemResources.documents.map((doc: any) => (
                                    <SelectItem key={doc.id} value={doc.id}>
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <div>
                                          <div className="font-medium">{doc.document_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {doc.resins.name} - {doc.resins.manufacturer}
                                          </div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {formData.cta_3_url && (
                                <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                  <strong>Label gerado:</strong> {formData.cta_3_label}<br/>
                                  <strong>URL:</strong> <a href={formData.cta_3_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_3_url}</a>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* EXTERNAL_LINK: Seletor de links externos */}
                      {formData.cta_3_source_type === 'external_link' && (
                        <div>
                          <Label htmlFor="cta_3_link_select">Selecionar Link Externo</Label>
                          <Select 
                            value={formData.cta_3_source_id || ''} 
                            onValueChange={handleCTA3ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um link aprovado..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.externalLinks.map((link: any) => (
                                <SelectItem key={link.id} value={link.id}>
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    <div>
                                      <div className="font-medium">{link.name}</div>
                                      <div className="text-xs text-muted-foreground">{link.category}</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_3_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_3_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_3_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_3_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* KNOWLEDGE: Seletor de artigos */}
                      {formData.cta_3_source_type === 'knowledge' && (
                        <div>
                          <Label htmlFor="cta_3_article_select">Selecionar Artigo</Label>
                          <Select 
                            value={formData.cta_3_source_id || ''} 
                            onValueChange={handleCTA3ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um artigo da base..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.knowledgeArticles.map((article: any) => (
                                <SelectItem key={article.id} value={article.id}>
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    <div className="font-medium">{article.title}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_3_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_3_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_3_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_3_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Descrição SEO (comum para todos os tipos) */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="cta_3_description">Descrição SEO</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">Descrição invisível para usuários, usada para SEO e acessibilidade. Máx: 200 caracteres.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          id="cta_3_description"
                          value={formData.cta_3_description || ''}
                          onChange={(e) => handleInputChange('cta_3_description', e.target.value)}
                          placeholder="Ex: Baixe manual e e-book gratuito sobre impressão 3D"
                          maxLength={200}
                          className="resize-none"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(formData.cta_3_description || '').length}/200 caracteres
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  {/* 🆕 CTA 4 - Seletor Inteligente */}
                  <AccordionItem value="cta-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>CTA 4 - Seletor Inteligente</span>
                        <Badge variant="secondary" className="ml-2">NOVO</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      {/* Seletor de Tipo de Fonte */}
                      <div>
                        <Label className="mb-2 block">Tipo de Conteúdo</Label>
                        <RadioGroup 
                          value={formData.cta_4_source_type || 'manual'} 
                          onValueChange={handleCTA4SourceChange}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="manual" id="cta4-manual" />
                            <Label htmlFor="cta4-manual" className="flex-1 cursor-pointer">
                              <div className="font-medium">URL Manual</div>
                              <p className="text-xs text-muted-foreground">Digite um link customizado</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="document" id="cta4-document" />
                            <Label htmlFor="cta4-document" className="flex-1 cursor-pointer">
                              <div className="font-medium">Documento Técnico</div>
                              <p className="text-xs text-muted-foreground">Vincular PDF cadastrado no sistema</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="external_link" id="cta4-external" />
                            <Label htmlFor="cta4-external" className="flex-1 cursor-pointer">
                              <div className="font-medium">Link Externo Aprovado</div>
                              <p className="text-xs text-muted-foreground">Usar link da base de externos</p>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-3 border rounded hover:bg-muted/30 cursor-pointer">
                            <RadioGroupItem value="knowledge" id="cta4-knowledge" />
                            <Label htmlFor="cta4-knowledge" className="flex-1 cursor-pointer">
                              <div className="font-medium">Artigo da Base de Conhecimento</div>
                              <p className="text-xs text-muted-foreground">Landing page interna</p>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      {/* Campos condicionais baseados no tipo */}
                      {formData.cta_4_source_type === 'manual' && (
                        <>
                          <div>
                            <Label htmlFor="cta_4_label">Nome do Botão</Label>
                            <Input
                              id="cta_4_label"
                              value={formData.cta_4_label || ''}
                              onChange={(e) => handleInputChange('cta_4_label', e.target.value)}
                              placeholder="Ex: Solicitar Orçamento"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cta_4_url">URL</Label>
                            <Input
                              id="cta_4_url"
                              type="url"
                              value={formData.cta_4_url || ''}
                              onChange={(e) => handleInputChange('cta_4_url', e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </>
                      )}
                      
                      {formData.cta_4_source_type === 'document' && (
                        <div>
                          <Label htmlFor="cta_4_doc_select">Selecionar Documento</Label>
                          
                          {systemResources.documents.length === 0 ? (
                            <div className="border rounded-lg p-4 bg-muted/50 text-center">
                              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">
                                {!item || !('id' in item) 
                                  ? "💡 Salve a resina primeiro para vincular documentos técnicos"
                                  : "📄 Nenhum documento técnico cadastrado para esta resina ainda"
                                }
                              </p>
                            </div>
                          ) : (
                            <>
                              <Select 
                                value={formData.cta_4_source_id || ''} 
                                onValueChange={handleCTA4ResourceSelect}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha um documento técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {systemResources.documents.map((doc: any) => (
                                    <SelectItem key={doc.id} value={doc.id}>
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <div>
                                          <div className="font-medium">{doc.document_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {doc.resins.name} - {doc.resins.manufacturer}
                                          </div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {formData.cta_4_url && (
                                <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                  <strong>Label gerado:</strong> {formData.cta_4_label}<br/>
                                  <strong>URL:</strong> <a href={formData.cta_4_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_4_url}</a>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      
                      {formData.cta_4_source_type === 'external_link' && (
                        <div>
                          <Label htmlFor="cta_4_link_select">Selecionar Link Externo</Label>
                          <Select 
                            value={formData.cta_4_source_id || ''} 
                            onValueChange={handleCTA4ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um link aprovado..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.externalLinks.map((link: any) => (
                                <SelectItem key={link.id} value={link.id}>
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    <div>
                                      <div className="font-medium">{link.name}</div>
                                      <div className="text-xs text-muted-foreground">{link.category}</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_4_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_4_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_4_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_4_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {formData.cta_4_source_type === 'knowledge' && (
                        <div>
                          <Label htmlFor="cta_4_article_select">Selecionar Artigo</Label>
                          <Select 
                            value={formData.cta_4_source_id || ''} 
                            onValueChange={handleCTA4ResourceSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um artigo da base..." />
                            </SelectTrigger>
                            <SelectContent>
                              {systemResources.knowledgeArticles.map((article: any) => (
                                <SelectItem key={article.id} value={article.id}>
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    <div className="font-medium">{article.title}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {formData.cta_4_url && (
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                              <strong>Label gerado:</strong> {formData.cta_4_label}<br/>
                              <strong>URL:</strong> <a href={formData.cta_4_url} target="_blank" rel="noopener" className="text-primary underline">{formData.cta_4_url}</a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Descrição SEO (comum para todos) */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="cta_4_description">Descrição SEO</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">Descrição invisível para usuários, usada para SEO e acessibilidade. Máx: 200 caracteres.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Textarea
                          id="cta_4_description"
                          value={formData.cta_4_description || ''}
                          onChange={(e) => handleInputChange('cta_4_description', e.target.value)}
                          placeholder="Ex: Solicite orçamento personalizado para sua clínica"
                          maxLength={200}
                          className="resize-none"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(formData.cta_4_description || '').length}/200 caracteres
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              
              {/* NOVA SEÇÃO: Documentos Técnicos */}
              <div className="space-y-4 mt-6">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  📄 Documentos Técnicos
                </Label>
                <p className="text-sm text-muted-foreground">
                  PDFs que serão hospedados no sistema e disponibilizados para hyperlinks da IA
                </p>
                
                {/* Lista de documentos existentes */}
                {documents.map((doc, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Documento #{idx + 1}</Label>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label htmlFor={`doc_name_${idx}`}>Nome do Documento</Label>
                      <Input
                        id={`doc_name_${idx}`}
                        value={doc.document_name}
                        onChange={(e) => handleDocumentChange(idx, 'document_name', e.target.value)}
                        placeholder="Ex: Ficha Técnica Smart Print Model Ocre"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`doc_desc_${idx}`}>Descrição SEO</Label>
                      <Textarea
                        id={`doc_desc_${idx}`}
                        value={doc.document_description}
                        onChange={(e) => handleDocumentChange(idx, 'document_description', e.target.value)}
                        placeholder="Ex: Ficha técnica completa da resina Smart Print Model Ocre com dados técnicos de cura e impressão"
                        rows={2}
                      />
                    </div>
                    
                    {doc.file_url ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-500" />
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {doc.file_name}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{formatFileSize(doc.file_size)}</Badge>
                          {doc.created_at && (
                            <>
                              <span>•</span>
                              <span>
                                Criado em {new Date(doc.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} às {new Date(doc.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label>Upload PDF (até 50MB)</Label>
                          <Input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => handleDocumentUpload(idx, e.target.files?.[0])}
                            disabled={uploadingDocIndex === idx}
                          />
                        </div>
                        
                        {uploadingDocIndex === idx && (
                          <div className="space-y-2">
                            <Progress value={uploadProgress} className="h-2" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Enviando PDF...
                              </span>
                              <span className="font-semibold text-primary">
                                {uploadProgress}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                <Button 
                  variant="outline"
                  onClick={handleAddDocument}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  ADICIONAR DOCUMENTO
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'catalog' && (
            <>
              {/* Badge IDs de Correlação */}
              {(formData.external_id || formData.system_a_product_id) && (
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">IDs de Correlação entre Sistemas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.external_id && (
                      <Badge variant="secondary" className="text-xs">
                        <span className="font-semibold mr-1">Loja Integrada:</span>
                        {formData.external_id}
                      </Badge>
                    )}
                    {formData.system_a_product_id && (
                      <Badge variant="secondary" className="text-xs">
                        <span className="font-semibold mr-1">Sistema A ID:</span>
                        {formData.system_a_product_id}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <AdminCatalogFormSection
                formData={formData}
                handleInputChange={handleInputChange}
                handleLojaIntegradaImport={handleLojaIntegradaImport}
              />
              
              {/* SEÇÃO: Documentos Técnicos para Catálogo */}
              <div className="space-y-4 mt-6 pt-6 border-t">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  📄 Documentos Técnicos
                </Label>
                <p className="text-sm text-muted-foreground">
                  PDFs que serão hospedados no sistema e disponibilizados para hyperlinks da IA
                </p>
                
                {/* Lista de documentos */}
                {documents.map((doc, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Documento #{idx + 1}</Label>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteCatalogDocument(doc.id, doc.file_url)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label htmlFor={`catalog_doc_name_${idx}`}>Nome do Documento</Label>
                      <Input
                        id={`catalog_doc_name_${idx}`}
                        value={doc.document_name}
                        onChange={(e) => handleDocumentChange(idx, 'document_name', e.target.value)}
                        placeholder="Ex: Ficha Técnica Produto XYZ"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`catalog_doc_desc_${idx}`}>Descrição SEO</Label>
                      <Textarea
                        id={`catalog_doc_desc_${idx}`}
                        value={doc.document_description}
                        onChange={(e) => handleDocumentChange(idx, 'document_description', e.target.value)}
                        placeholder="Ex: Ficha técnica completa do produto XYZ"
                        rows={2}
                      />
                    </div>
                    
                    {doc.file_url ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-500" />
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {doc.file_name}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{formatFileSize(doc.file_size)}</Badge>
                          {doc.created_at && (
                            <>
                              <span>•</span>
                              <span>
                                Criado em {new Date(doc.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} às {new Date(doc.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label>Upload PDF (até 50MB)</Label>
                          <Input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => handleCatalogDocumentUpload(idx, e.target.files?.[0])}
                            disabled={uploadingDocIndex === idx}
                          />
                        </div>
                        
                        {uploadingDocIndex === idx && (
                          <div className="space-y-2">
                            <Progress value={uploadProgress} className="h-2" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Enviando PDF...
                              </span>
                              <span className="font-semibold text-primary">
                                {uploadProgress}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                <Button 
                  variant="outline"
                  onClick={handleAddDocument}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  ADICIONAR DOCUMENTO
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'parameter' && (
            <>
              {/* Seleção de Marca, Modelo e Resina */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand-slug">Marca</Label>
                  <Select value={formData.brand_slug || ''} onValueChange={(value) => handleInputChange('brand_slug', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.filter(brand => brand.slug && brand.slug.trim() !== '').map((brand) => (
                        <SelectItem key={brand.id} value={brand.slug}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="model-slug">Modelo</Label>
                  <Select 
                    value={formData.model_slug || ''} 
                    onValueChange={(value) => handleInputChange('model_slug', value)} 
                    disabled={!formData.brand_slug}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!formData.brand_slug ? "Selecione uma marca primeiro" : "Selecione um modelo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.filter(model => model.slug && model.slug.trim() !== '').map((model) => (
                        <SelectItem key={model.id} value={model.slug}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="resin-name">Resina</Label>
                <Select value={formData.resin_name || ''} onValueChange={(value) => handleInputChange('resin_name', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma resina" />
                  </SelectTrigger>
                  <SelectContent>
                    {resins.filter(resin => resin.name && resin.name.trim() !== '').map((resin) => (
                      <SelectItem key={resin.id} value={resin.name}>
                        {resin.name} ({resin.manufacturer})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CAMADAS NORMAIS */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-4 text-primary">CAMADAS NORMAIS</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="layer-height">Altura da camada (mm)</Label>
                    <Input
                      id="layer-height"
                      type="number"
                      step="0.001"
                      min="0.01"
                      max="0.30"
                      value={formData.layer_height || ''}
                      onChange={(e) => handleInputChange('layer_height', Number(e.target.value))}
                      placeholder="Ex: 0.05"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cure-time">Tempo de cura (seg)</Label>
                    <Input
                      id="cure-time"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.cure_time || ''}
                      onChange={(e) => handleInputChange('cure_time', Number(e.target.value))}
                      placeholder="Ex: 3.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wait-before-cure">Espera antes da cura (s)</Label>
                    <Input
                      id="wait-before-cure"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.wait_time_before_cure || ''}
                      onChange={(e) => handleInputChange('wait_time_before_cure', Number(e.target.value))}
                      placeholder="Ex: 0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wait-after-cure">Espera após a cura (s)</Label>
                    <Input
                      id="wait-after-cure"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.wait_time_after_cure || ''}
                      onChange={(e) => handleInputChange('wait_time_after_cure', Number(e.target.value))}
                      placeholder="Ex: 0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="light-intensity">Intensidade da luz (%)</Label>
                    <Input
                      id="light-intensity"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={formData.light_intensity || ''}
                      onChange={(e) => handleInputChange('light_intensity', Number(e.target.value))}
                      placeholder="Ex: 100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="x-adjustment">Ajuste X (%)</Label>
                      <Input
                        id="x-adjustment"
                        type="number"
                        step="1"
                        min="0"
                        max="1000"
                        value={formData.xy_adjustment_x_pct || ''}
                        onChange={(e) => handleInputChange('xy_adjustment_x_pct', Number(e.target.value))}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="y-adjustment">Ajuste Y (%)</Label>
                      <Input
                        id="y-adjustment"
                        type="number"
                        step="1"
                        min="0"
                        max="1000"
                        value={formData.xy_adjustment_y_pct || ''}
                        onChange={(e) => handleInputChange('xy_adjustment_y_pct', Number(e.target.value))}
                        placeholder="100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CAMADAS INFERIORES */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-4 text-primary">CAMADAS INFERIORES</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bottom-cure-time">Tempo de adesão (seg)</Label>
                    <Input
                      id="bottom-cure-time"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.bottom_cure_time || ''}
                      onChange={(e) => handleInputChange('bottom_cure_time', Number(e.target.value))}
                      placeholder="Ex: 30.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bottom-layers">Camadas base</Label>
                    <Input
                      id="bottom-layers"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={formData.bottom_layers || ''}
                      onChange={(e) => handleInputChange('bottom_layers', Number(e.target.value))}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wait-before-cure-base">Espera antes da cura base (s)</Label>
                    <Input
                      id="wait-before-cure-base"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.wait_time_before_cure || ''}
                      onChange={(e) => handleInputChange('wait_time_before_cure', Number(e.target.value))}
                      placeholder="Ex: 0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wait-after-cure-base">Espera após a cura base (s)</Label>
                    <Input
                      id="wait-after-cure-base"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.wait_time_after_cure || ''}
                      onChange={(e) => handleInputChange('wait_time_after_cure', Number(e.target.value))}
                      placeholder="Ex: 0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wait-after-lift">Espera após elevação (s)</Label>
                    <Input
                      id="wait-after-lift"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={formData.wait_time_after_lift || ''}
                      onChange={(e) => handleInputChange('wait_time_after_lift', Number(e.target.value))}
                      placeholder="Ex: 0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Notas sobre este conjunto de parâmetros..."
                />
              </div>

              {/* Status */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleInputChange('active', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex items-center gap-2">
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
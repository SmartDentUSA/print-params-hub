import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, X, ExternalLink, Info } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/ImageUpload';
import { PublicAPIProductImporter } from '@/components/PublicAPIProductImporter';
import { uploadExternalImage } from '@/utils/uploadExternalImage';

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
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
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
  type: 'brand' | 'model' | 'resin' | 'parameter';
  item?: Brand | Model | Resin | ParameterSet | null;
  brands?: Brand[];
  models?: Model[];
  resins?: Resin[];
  onSave: (data: any) => void;
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
        return { name: '', manufacturer: '', color: '', type: 'standard', description: '', price: 0, active: true };
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

  // Update form data when item or type changes
  useEffect(() => {
    setFormData(getInitialFormData());
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
      
      await onSave(formData);
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

  const getModalTitle = () => {
    const action = item ? 'Editar' : 'Criar';
    switch (type) {
      case 'brand': return `${action} Marca`;
      case 'model': return `${action} Modelo`;
      case 'resin': return `${action} Resina`;
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
                        <ExternalLink className="w-4 h-4" />
                        <span>CTA 1</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
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
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="cta-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        <span>CTA 2</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
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
                          placeholder="Ex: Acesse dados técnicos completos da resina Smart Print Model Ocre"
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
                        <ExternalLink className="w-4 h-4" />
                        <span>CTA 3</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
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
                          placeholder="Ex: Baixe manual e e-book gratuito sobre impressão 3D com Smart Print"
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
                </Accordion>
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
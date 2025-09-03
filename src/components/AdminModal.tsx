import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, X } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface Model {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  notes?: string;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  isActive: boolean;
}

interface Parameter {
  brand: string;
  model: string;
  resin: string;
  variant_label: string;
  altura_da_camada_mm: number;
  tempo_cura_seg: number;
  tempo_adesao_seg: number;
  camadas_transicao: number;
  intensidade_luz_pct: number;
  ajuste_x_pct: number;
  ajuste_y_pct: number;
  notes: string;
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'brand' | 'model' | 'resin' | 'parameter';
  item?: Brand | Model | Resin | Parameter | null;
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
  const getInitialFormData = () => {
    if (item && type === 'parameter') {
      // For parameters, we need to ensure the data matches what's available in dropdowns
      const parameterItem = item as Parameter;
      return {
        ...parameterItem,
        brand: parameterItem.brand || '',
        model: parameterItem.model || '',
        resin: parameterItem.resin || ''
      };
    } else if (item) {
      return { ...item };
    }
    
    switch (type) {
      case 'brand':
        return { name: '', isActive: true };
      case 'model':
        return { name: '', brandId: '', imageUrl: '', isActive: true, notes: '' };
      case 'resin':
        return { name: '', manufacturer: '', isActive: true };
      case 'parameter':
        return {
          brand: '',
          model: '',
          resin: '',
          variant_label: '50 microns',
          altura_da_camada_mm: 0.05,
          tempo_cura_seg: 5,
          tempo_adesao_seg: 30,
          camadas_transicao: 8,
          intensidade_luz_pct: 100,
          ajuste_x_pct: 100,
          ajuste_y_pct: 100,
          notes: ''
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
  const availableModels = formData.brand 
    ? models.filter(model => {
        const selectedBrand = brands.find(b => b.name === formData.brand);
        return selectedBrand && model.brandId === selectedBrand.id;
      })
    : models;

  const handleSave = () => {
    if (type === 'brand' || type === 'model' || type === 'resin') {
      // Generate slug for brands and models
      if (type === 'brand' || type === 'model') {
        formData.slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      }
      
      // Generate ID if creating new item
      if (!formData.id) {
        formData.id = Date.now().toString();
      }
    }
    
    onSave(formData);
    onClose();
  };

  const handleInputChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    
    // If brand changes in parameter form, reset the model selection
    if (field === 'brand' && type === 'parameter') {
      newFormData.model = '';
    }
    
    setFormData(newFormData);
  };

  const getModalTitle = () => {
    const action = item ? 'Editar' : 'Criar';
    switch (type) {
      case 'brand': return `${action} Marca`;
      case 'model': return `${action} Modelo`;
      case 'resin': return `${action} Resina`;
      case 'parameter': return `${action} Parâmetro`;
      default: return action;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {type === 'brand' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Marca</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: ELEGOO"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'model' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="brandId">Marca</Label>
                <Select value={formData.brandId || ''} onValueChange={(value) => handleInputChange('brandId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Modelo</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Mars 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL da Imagem</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl || ''}
                  onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={formData.imageUrl} 
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
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
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'resin' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Resina</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Smart Print Model Ocre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer || ''}
                  onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  placeholder="Ex: Smart Print"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </>
          )}

          {type === 'parameter' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marca</Label>
                  <Select value={formData.brand || ''} onValueChange={(value) => handleInputChange('brand', value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione uma marca" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.name}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select 
                    value={formData.model || ''} 
                    onValueChange={(value) => handleInputChange('model', value)} 
                    disabled={!formData.brand}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={!formData.brand ? "Selecione uma marca primeiro" : "Selecione um modelo"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.name}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resin">Resina</Label>
                <Select value={formData.resin || ''} onValueChange={(value) => handleInputChange('resin', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione uma resina" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {resins.map((resin) => (
                      <SelectItem key={resin.id} value={resin.name}>
                        {resin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="variant_label">Variante</Label>
                <Select value={formData.variant_label || ''} onValueChange={(value) => handleInputChange('variant_label', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione a variante" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    <SelectItem value="25 microns">25 microns</SelectItem>
                    <SelectItem value="50 microns">50 microns</SelectItem>
                    <SelectItem value="100 microns">100 microns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="altura_da_camada_mm">Altura da Camada (mm)</Label>
                  <Input
                    id="altura_da_camada_mm"
                    type="number"
                    step="0.001"
                    value={formData.altura_da_camada_mm || ''}
                    onChange={(e) => handleInputChange('altura_da_camada_mm', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tempo_cura_seg">Tempo de Cura (s)</Label>
                  <Input
                    id="tempo_cura_seg"
                    type="number"
                    step="0.1"
                    value={formData.tempo_cura_seg || ''}
                    onChange={(e) => handleInputChange('tempo_cura_seg', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tempo_adesao_seg">Tempo de Adesão (s)</Label>
                  <Input
                    id="tempo_adesao_seg"
                    type="number"
                    value={formData.tempo_adesao_seg || ''}
                    onChange={(e) => handleInputChange('tempo_adesao_seg', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camadas_transicao">Camadas de Transição</Label>
                  <Input
                    id="camadas_transicao"
                    type="number"
                    value={formData.camadas_transicao || ''}
                    onChange={(e) => handleInputChange('camadas_transicao', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intensidade_luz_pct">Luz (%)</Label>
                  <Input
                    id="intensidade_luz_pct"
                    type="number"
                    value={formData.intensidade_luz_pct || ''}
                    onChange={(e) => handleInputChange('intensidade_luz_pct', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ajuste_x_pct">Ajuste X (%)</Label>
                  <Input
                    id="ajuste_x_pct"
                    type="number"
                    value={formData.ajuste_x_pct || ''}
                    onChange={(e) => handleInputChange('ajuste_x_pct', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ajuste_y_pct">Ajuste Y (%)</Label>
                  <Input
                    id="ajuste_y_pct"
                    type="number"
                    value={formData.ajuste_y_pct || ''}
                    onChange={(e) => handleInputChange('ajuste_y_pct', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Notas sobre este conjunto de parâmetros..."
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="flex items-center gap-2">
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
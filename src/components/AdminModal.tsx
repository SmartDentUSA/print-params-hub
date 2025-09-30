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
        return { name: '', manufacturer: '', color: '', type: 'standard', active: true };
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

  const handleSave = () => {
    // Generate slug for brands and models if creating new ones
    if ((type === 'brand' || type === 'model') && formData.name && !item) {
      formData.slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
    
    // For parameters, ensure we have proper slugs and manufacturer
    if (type === 'parameter') {
      // Validate required fields
      if (!formData.brand_slug || !formData.model_slug || !formData.resin_name) {
        console.error('Missing required fields for parameter');
        return;
      }

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

      // Ensure all numeric fields are properly converted to numbers
      const numericFields = [
        'layer_height', 'cure_time', 'bottom_cure_time', 'lift_distance',
        'lift_speed', 'retract_speed', 'light_intensity', 'xy_size_compensation',
        'xy_adjustment_x_pct', 'xy_adjustment_y_pct', 'wait_time_before_cure',
        'wait_time_after_cure', 'wait_time_after_lift', 'bottom_layers'
      ];

      numericFields.forEach(field => {
        if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
          formData[field] = Number(formData[field]);
        }
      });
    }
    
    onSave(formData);
    onClose();
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
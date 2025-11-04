import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PublicAPIProductImporter } from '@/components/PublicAPIProductImporter';
import { useCatalogCRUD } from '@/hooks/useCatalogCRUD';

interface AdminCatalogFormSectionProps {
  formData: any;
  handleInputChange: (field: string, value: any) => void;
  handleLojaIntegradaImport?: (data: any) => void;
}

export function AdminCatalogFormSection({ 
  formData, 
  handleInputChange,
  handleLojaIntegradaImport 
}: AdminCatalogFormSectionProps) {
  const { fetchCategories, fetchSubcategories } = useCatalogCRUD();
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (formData.product_category) {
      loadSubcategories(formData.product_category);
    }
  }, [formData.product_category]);

  const loadCategories = async () => {
    const cats = await fetchCategories();
    setCategories(cats);
  };

  const loadSubcategories = async (category: string) => {
    const subs = await fetchSubcategories(category);
    setSubcategories(subs);
  };

  return (
    <>
      {handleLojaIntegradaImport && (
        <PublicAPIProductImporter
          onImportSuccess={handleLojaIntegradaImport}
          onImportError={(error) => console.error('Erro ao importar:', error)}
        />
      )}

      {/* Nome e Slug */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome do Produto *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Ex: Resina Smart Print"
            required
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={formData.slug || ''}
            onChange={(e) => handleInputChange('slug', e.target.value)}
            placeholder="resina-smart-print"
          />
        </div>
      </div>

      {/* Categorias */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <div className="space-y-2">
          <Label htmlFor="product_category">Categoria *</Label>
          <div className="relative">
            <input
              id="product_category"
              list="categories-list"
              value={formData.product_category || ''}
              onChange={(e) => handleInputChange('product_category', e.target.value)}
              placeholder="Digite ou selecione..."
              className="w-full p-2 border border-border rounded-md bg-background"
              required
            />
            <datalist id="categories-list">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {categories.slice(0, 3).map(cat => (
                <Badge 
                  key={cat} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => handleInputChange('product_category', cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="product_subcategory">Subcategoria</Label>
          <div className="relative">
            <input
              id="product_subcategory"
              list="subcategories-list"
              value={formData.product_subcategory || ''}
              onChange={(e) => handleInputChange('product_subcategory', e.target.value)}
              placeholder="Digite ou selecione..."
              className="w-full p-2 border border-border rounded-md bg-background"
            />
            <datalist id="subcategories-list">
              {subcategories.map(sub => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
          </div>
          {subcategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {subcategories.slice(0, 3).map(sub => (
                <Badge 
                  key={sub} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => handleInputChange('product_subcategory', sub)}
                >
                  {sub}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Descrição completa do produto..."
          rows={4}
        />
      </div>

      {/* Preços */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price || 0}
            onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="promo_price">Preço Promocional (R$)</Label>
          <Input
            id="promo_price"
            type="number"
            step="0.01"
            value={formData.promo_price || ''}
            onChange={(e) => handleInputChange('promo_price', parseFloat(e.target.value) || null)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Imagem */}
      <div>
        <Label htmlFor="image_url">URL da Imagem</Label>
        <Input
          id="image_url"
          value={formData.image_url || ''}
          onChange={(e) => handleInputChange('image_url', e.target.value)}
          placeholder="https://..."
        />
        {formData.image_url && (
          <div className="mt-2">
            <img 
              src={formData.image_url} 
              alt="Preview"
              className="w-32 h-32 object-cover rounded border"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
        <Label className="text-sm font-semibold">Call-to-Actions (CTAs)</Label>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cta_1_label" className="text-xs">CTA 1 - Label</Label>
            <Input
              id="cta_1_label"
              value={formData.cta_1_label || ''}
              onChange={(e) => handleInputChange('cta_1_label', e.target.value)}
              placeholder="Ex: Comprar Agora"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="cta_1_url" className="text-xs">CTA 1 - URL</Label>
            <Input
              id="cta_1_url"
              value={formData.cta_1_url || ''}
              onChange={(e) => handleInputChange('cta_1_url', e.target.value)}
              placeholder="https://..."
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cta_2_label" className="text-xs">CTA 2 - Label</Label>
            <Input
              id="cta_2_label"
              value={formData.cta_2_label || ''}
              onChange={(e) => handleInputChange('cta_2_label', e.target.value)}
              placeholder="Ex: Mais Informações"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="cta_2_url" className="text-xs">CTA 2 - URL</Label>
            <Input
              id="cta_2_url"
              value={formData.cta_2_url || ''}
              onChange={(e) => handleInputChange('cta_2_url', e.target.value)}
              placeholder="https://..."
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cta_3_label" className="text-xs">CTA 3 - Label</Label>
            <Input
              id="cta_3_label"
              value={formData.cta_3_label || ''}
              onChange={(e) => handleInputChange('cta_3_label', e.target.value)}
              placeholder="Ex: Suporte"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="cta_3_url" className="text-xs">CTA 3 - URL</Label>
            <Input
              id="cta_3_url"
              value={formData.cta_3_url || ''}
              onChange={(e) => handleInputChange('cta_3_url', e.target.value)}
              placeholder="https://..."
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => handleInputChange('active', checked)}
          />
          <Label htmlFor="active">Ativo</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="approved"
            checked={formData.approved}
            onCheckedChange={(checked) => handleInputChange('approved', checked)}
          />
          <Label htmlFor="approved">Aprovado</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="visible_in_ui"
            checked={formData.visible_in_ui || false}
            onCheckedChange={(checked) => handleInputChange('visible_in_ui', checked)}
          />
          <Label htmlFor="visible_in_ui">Visível na UI</Label>
        </div>
      </div>
    </>
  );
}

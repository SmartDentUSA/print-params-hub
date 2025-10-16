import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { Loader2, Download, CheckCircle2 } from 'lucide-react';
import { EXTERNAL_API_CONFIG } from '@/config/externalAPI';

interface ProductData {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  color?: string;
  image_url?: string;
  description?: string;
  price?: number;
  active?: boolean;
  resource_cta1?: { label?: string; url?: string; visible?: boolean };
  resource_cta2?: { label?: string; url?: string; visible?: boolean };
  resource_cta3?: { label?: string; url?: string; visible?: boolean };
  resource_descriptions?: { cta1?: string; cta2?: string; cta3?: string };
}

interface PublicAPIProductImporterProps {
  onImportSuccess?: (productData: any) => void;
  onImportError?: (error: string) => void;
}

export function PublicAPIProductImporter({ 
  onImportSuccess,
  onImportError
}: PublicAPIProductImporterProps) {
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const handleImport = async () => {
    if (!slug.trim()) {
      toast.error('Por favor, insira um slug ou URL');
      return;
    }

    setIsLoading(true);
    setPreviewData(null);
    console.log('🔍 Iniciando importação para slug:', slug);

    try {
      // Extrair slug da URL se necessário
      let productSlug = slug.trim();
      if (productSlug.includes('http')) {
        const urlParts = productSlug.split('/');
        productSlug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
      }

      // Montar URL da API
      const apiUrl = new URL(EXTERNAL_API_CONFIG.PRODUCTS_API_URL);
      apiUrl.searchParams.append('slug', productSlug);
      apiUrl.searchParams.append('approved', EXTERNAL_API_CONFIG.DEFAULT_PARAMS.approved);

      console.log('📡 Fazendo requisição para:', apiUrl.toString());

      // Fazer requisição
      const response = await fetch(apiUrl.toString());
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('📦 Resposta da API:', result);

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Produto não encontrado');
      }

      const productData: ProductData = result.data;
      console.log('📦 Dados originais da API:', productData);

      // MAPEAMENTO CORRIGIDO
      const mappedData = {
        // OBRIGATÓRIOS (4 campos)
        id: productData.id,
        name: productData.name,
        manufacturer: productData.brand || 'SmartDent', // ← CORRIGIDO: brand → manufacturer
        active: productData.active ?? true,
        
        // BÁSICOS OPCIONAIS (5 campos)
        color: productData.color || null,
        type: productData.subcategory || productData.category || null, // ← NOVO: extrair de subcategory
        image_url: productData.image_url || null,
        description: productData.description || null,
        price: productData.price || null,
        
        // CTA 1 (3 campos) ← CORRIGIDO: extrair dos objetos resource_cta
        cta_1_label: productData.resource_cta1?.label || null,
        cta_1_url: productData.resource_cta1?.url || null,
        cta_1_description: productData.resource_descriptions?.cta1 || null,
        
        // CTA 2 (3 campos)
        cta_2_label: productData.resource_cta2?.label || null,
        cta_2_url: productData.resource_cta2?.url || null,
        cta_2_description: productData.resource_descriptions?.cta2 || null,
        
        // CTA 3 (3 campos)
        cta_3_label: productData.resource_cta3?.label || null,
        cta_3_url: productData.resource_cta3?.url || null,
        cta_3_description: productData.resource_descriptions?.cta3 || null,
      };

      console.log('🔄 Dados mapeados:', mappedData);

      // Validar campos obrigatórios
      const requiredFields = ['id', 'name', 'manufacturer'];
      const missingFields = requiredFields.filter(field => !mappedData[field as keyof typeof mappedData]);

      console.log('✅ Validação de campos obrigatórios:', {
        id: mappedData.id ? '✅' : '❌',
        name: mappedData.name ? '✅' : '❌',
        manufacturer: mappedData.manufacturer ? '✅' : '❌',
        active: mappedData.active !== undefined ? '✅' : '❌',
      });

      if (missingFields.length > 0) {
        throw new Error(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
      }

      // Mostrar preview
      setPreviewData(mappedData);

      // Chamar callback de sucesso
      if (onImportSuccess) {
        onImportSuccess(mappedData);
      }

      console.log('✅ Dados importados com sucesso!');
      toast.success('✅ Produto importado com sucesso!');

    } catch (error) {
      console.error('❌ Erro ao importar produto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao importar dados';
      
      toast.error(`Erro ao importar: ${errorMessage}`);

      if (onImportError) {
        onImportError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product-slug">
          Slug ou URL do Produto (Sistema A)
        </Label>
        <div className="flex gap-2">
          <Input
            id="product-slug"
            placeholder="Ex: resina-smart-print-bio-vitality"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            disabled={isLoading}
          />
          <Button 
            onClick={handleImport}
            disabled={isLoading || !slug.trim()}
            className="min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Cole o slug (ex: resina-smart-print-bio-vitality) ou a URL completa do produto
        </p>
      </div>

      {previewData && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">📦 Dados Importados:</h4>
          </div>
          <div className="space-y-1 text-sm text-blue-900 dark:text-blue-100">
            <p><strong>Nome:</strong> {previewData.name}</p>
            <p><strong>Fabricante:</strong> {previewData.manufacturer}</p>
            {previewData.color && <p><strong>Cor:</strong> {previewData.color}</p>}
            {previewData.type && <p><strong>Tipo:</strong> {previewData.type}</p>}
            {previewData.price && <p><strong>Preço:</strong> R$ {Number(previewData.price).toFixed(2)}</p>}
            {previewData.cta_1_label && (
              <p><strong>CTA 1:</strong> {previewData.cta_1_label}</p>
            )}
            {previewData.cta_2_label && (
              <p><strong>CTA 2:</strong> {previewData.cta_2_label}</p>
            )}
            {previewData.cta_3_label && (
              <p><strong>CTA 3:</strong> {previewData.cta_3_label}</p>
            )}
          </div>
        </Card>
      )}
    </Card>
  );
}

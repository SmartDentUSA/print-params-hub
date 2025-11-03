import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';
import { EXTERNAL_API_CONFIG } from '@/config/externalAPI';

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
      toast.error('Digite um slug ou URL');
      return;
    }

    setIsLoading(true);
    setPreviewData(null);

    try {
      // Extrair slug de URL completa se necessário
      let cleanSlug = slug.trim();
      if (cleanSlug.includes('loja.smartdent.com.br/')) {
        cleanSlug = cleanSlug.split('loja.smartdent.com.br/')[1].split('?')[0];
      }

      const apiUrl = new URL(EXTERNAL_API_CONFIG.PRODUCTS_API_URL);
      apiUrl.searchParams.append('slug', cleanSlug);
      apiUrl.searchParams.append('approved', 'true');

      const response = await fetch(apiUrl.toString());
      
      if (!response.ok) {
        throw new Error('Produto não encontrado');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Produto não encontrado');
      }

          // 12 CAMPOS: 3 visíveis + 6 SEO + 3 correlação
          const mappedData = {
            // Campos visíveis (básicos)
            image_url: result.data.image_url || null,
            description: result.data.description || null,
            price: result.data.price || null,
            // 🔵 Campos SEO invisíveis (Sistema A) - mapeamento corrigido
            seo_title_override: result.data.seo_title_override || null,
            meta_description: result.data.seo_description_override || null,
            og_image_url: result.data.image_url || null,
            canonical_url: result.data.canonical_url || null,
            slug: result.data.slug || null,
            keywords: result.data.keywords || [],
            // 🆕 Campos de correlação (Sistema A)
            system_a_product_id: result.data.id || result.data.uuid || null,
            system_a_product_url: result.data.url || (result.data.slug ? `https://loja.smartdent.com.br/${result.data.slug}` : null),
            external_id: null, // Sistema A não tem ID Loja Integrada
          };

      setPreviewData(mappedData);
      
      if (onImportSuccess) {
        onImportSuccess(mappedData);
      }
      
      toast.success('✅ 12 campos importados (3 visíveis + 6 SEO + 3 correlação)!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao importar';
      toast.error(`Erro: ${errorMessage}`);
      
      if (onImportError) {
        onImportError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="resina-smart-print-bio-vitality"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          disabled={isLoading}
        />
        <Button 
          onClick={handleImport}
          disabled={isLoading || !slug.trim()}
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Importar
            </>
          )}
        </Button>
      </div>

    </div>
  );
}

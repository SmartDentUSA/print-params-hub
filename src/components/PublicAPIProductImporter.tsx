import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { EXTERNAL_API_CONFIG } from '@/config/externalAPI';

interface ProductData {
  id?: string;
  name: string;
  manufacturer: string;
  description?: string;
  price?: number;
  promo_price?: number;
  image_url?: string;
  images_gallery?: any[];
  brand?: string;
  category?: string;
  subcategory?: string;
  slug?: string;
  keywords?: any[];
  benefits?: any[];
  features?: any[];
  technical_specifications?: any[];
  faq?: any[];
  color?: string;
  type?: string;
  variations?: any[];
  [key: string]: any;
}

interface PublicAPIProductImporterProps {
  onImportSuccess?: (data: ProductData) => void;
  onImportError?: (error: string) => void;
}

export function PublicAPIProductImporter({
  onImportSuccess,
  onImportError
}: PublicAPIProductImporterProps) {
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleImport = async () => {
    if (!slug.trim()) {
      setResult({
        type: 'error',
        message: 'Por favor, digite um slug válido'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('🔍 Buscando produto com slug:', slug);

      const url = `${EXTERNAL_API_CONFIG.BASE_URL}?slug=${encodeURIComponent(slug.trim())}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      console.log('📦 Resposta da API:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erro ao buscar produto');
      }

      if (!data.data) {
        throw new Error('Produto não encontrado');
      }

      // Normalizar dados
      const productData: ProductData = {
        name: data.data.name || '',
        manufacturer: data.data.brand || '',
        description: data.data.description || '',
        price: parseFloat(data.data.promo_price || data.data.price || 0),
        image_url: data.data.image_url || '',
        color: data.data.color || '',
        type: data.data.subcategory || data.data.type || '',
        // Campos extras para referência
        promo_price: data.data.promo_price || 0,
        images_gallery: data.data.images_gallery || [],
        brand: data.data.brand || '',
        category: data.data.category || '',
        subcategory: data.data.subcategory || '',
        slug: data.data.slug || '',
        keywords: data.data.keywords || [],
        benefits: data.data.benefits || [],
        features: data.data.features || [],
        technical_specifications: data.data.technical_specifications || [],
        faq: data.data.faq || [],
        variations: data.data.variations || [],
      };

      console.log('✅ Dados normalizados:', productData);

      setResult({
        type: 'success',
        message: `Produto "${productData.name}" importado com sucesso!`
      });

      if (onImportSuccess) {
        onImportSuccess(productData);
      }

    } catch (error) {
      console.error('❌ Erro ao importar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao importar dados';
      
      setResult({
        type: 'error',
        message: errorMessage
      });

      if (onImportError) {
        onImportError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Download className="h-4 w-4" />
            <span>Importar dados do Sistema A (landing-craftsman-76)</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-slug">Slug do Produto</Label>
            <div className="flex gap-2">
              <Input
                id="product-slug"
                placeholder="Ex: disco-de-zirconia-98mm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                disabled={loading}
              />
              <Button
                onClick={handleImport}
                disabled={loading || !slug.trim()}
              >
                {loading ? (
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
              Digite o slug do produto cadastrado no Sistema A
            </p>
          </div>

          {result && (
            <Alert variant={result.type === 'success' ? 'default' : 'destructive'}>
              {result.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

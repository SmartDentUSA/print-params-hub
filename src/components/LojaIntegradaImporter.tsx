import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download } from 'lucide-react';

interface ImportedResinData {
  name: string;
  manufacturer: string;
  color: string;
  type: string;
  description: string;
  price: number;
  image_url: string;
  
  // 🆕 Campos de correlação
  external_id?: string;
  system_a_product_id?: string;
  system_a_product_url?: string;
  
  images_gallery: Array<{
    url: string;
    alt: string;
    order: number;
    is_main: boolean;
  }>;
}

interface LojaIntegradaImporterProps {
  onImportSuccess: (data: ImportedResinData) => void;
  onImportError?: (error: string) => void;
}

export function LojaIntegradaImporter({ 
  onImportSuccess, 
  onImportError 
}: LojaIntegradaImporterProps) {
  const [productUrl, setProductUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    const input = productUrl.trim();
    
    if (!input) {
      toast({
        title: "Campo vazio",
        description: "Cole a URL do produto ou o ID numérico",
        variant: "destructive"
      });
      return;
    }
    
    // Validar input básico
    if (input.includes('\n') || input.length > 500) {
      toast({
        title: "Entrada inválida",
        description: "Cole apenas a URL completa ou o ID numérico do produto",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('import-loja-integrada', {
        body: { productUrl: input }
      });

      if (error) throw error;

      if (!data?.success) {
        const errorMsg = data?.error || 'Erro ao importar produto';
        
        // Mensagem específica para erro 401
        if (errorMsg.includes('401')) {
          throw new Error('Chaves de API inválidas ou não autorizadas. Verifique LOJA_INTEGRADA_API_KEY e LOJA_INTEGRADA_APP_KEY nas configurações de Secrets do projeto.');
        }
        
        throw new Error(errorMsg);
      }

      onImportSuccess(data.data);
      
      toast({
        title: "✅ Produto importado!",
        description: "Dados e imagem carregados automaticamente. Revise e salve.",
      });

      setProductUrl('');

    } catch (error) {
      console.error('Erro na importação:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      onImportError?.(errorMsg);
      toast({
        title: "Erro na importação",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="border-2 border-dashed rounded-lg p-4 bg-accent/10 mb-4">
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <Download className="h-4 w-4" />
        Importar da Loja Integrada
      </h4>
      <div className="flex gap-2">
        <Input
          placeholder="Cole a URL do produto ou ID (ex: 123456)"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          disabled={importing}
          className="flex-1"
        />
        <Button 
          onClick={handleImport}
          disabled={importing || !productUrl.trim()}
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            'Importar'
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        💡 Aceita URL completa ou ID numérico: <code className="text-xs">https://loja.smartdent.com.br/resina-bio-vitality</code> ou <code className="text-xs">123456</code>
      </p>
    </div>
  );
}

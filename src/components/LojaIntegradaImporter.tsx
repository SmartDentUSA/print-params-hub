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
  image_url: string;
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
    if (!productUrl.trim()) {
      toast({
        title: "URL necessária",
        description: "Informe a URL ou ID do produto da Loja Integrada",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('import-loja-integrada', {
        body: { productUrl }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao importar produto');
      }

      onImportSuccess(data.data);
      
      toast({
        title: "Produto importado!",
        description: "Dados preenchidos. Agora faça upload da imagem.",
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
          placeholder="Cole a URL do produto aqui"
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
        💡 Exemplo: https://smartdent.com.br/produto/resina-ocre-123 ou apenas o ID
      </p>
    </div>
  );
}

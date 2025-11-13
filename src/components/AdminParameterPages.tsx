import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AdminParameterPages() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; generated: number } | null>(null);
  const { toast } = useToast();

  const generatePages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('generate-parameter-pages');
      
      if (error) throw error;
      
      if (data?.success) {
        setStats({ total: data.pages, generated: data.pages });
        toast({
          title: 'Páginas geradas com sucesso',
          description: `${data.pages} páginas técnicas de parâmetros foram criadas.`,
        });
      }
    } catch (error) {
      console.error('Error generating pages:', error);
      toast({
        title: 'Erro ao gerar páginas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categoria F - Páginas Técnicas de Parâmetros</CardTitle>
        <CardDescription>
          Gerar páginas técnicas para todas as combinações de parâmetros (Impressora + Resina)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Categoria F Oculta:</strong> As páginas geradas não aparecem na navegação da Base de Conhecimento, mas são acessíveis via URL pública (/base-conhecimento/f/...) para SEO e indexação do Google.
          </AlertDescription>
        </Alert>

        {stats && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Estatísticas</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Total de páginas geradas: <strong>{stats.generated}</strong>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Status: ✅ Páginas públicas para SEO (Category F oculta na navegação)
            </p>
          </div>
        )}

        <Button 
          onClick={generatePages} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando páginas...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Páginas Técnicas
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Gera uma página para cada combinação Impressora + Resina</p>
          <p>• Inclui FAQs técnicas reformuladas</p>
          <p>• Schema.org para Featured Snippets</p>
          <p>• URLs públicas: /base-conhecimento/f/:slug</p>
          <p>• Incluso no sitemap para indexação</p>
        </div>
      </CardContent>
    </Card>
  );
}

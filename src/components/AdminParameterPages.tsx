import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, AlertCircle, Package, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface GenerationStats {
  pages: number;
  cardsInjected: number;
  avgCardsPerPage: number;
  languages: number;
  totalIndexablePages: number;
}

export function AdminParameterPages() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const { toast } = useToast();

  const generatePages = async () => {
    try {
      setLoading(true);
      setStats(null); // Reset stats
      
      toast({
        title: 'Gerando páginas...',
        description: 'Processando parâmetros técnicos e injetando cards de produtos. Isso pode levar alguns minutos.',
      });
      
      const { data, error } = await supabase.functions.invoke('generate-parameter-pages');
      
      if (error) throw error;
      
      if (data?.success) {
        setStats({
          pages: data.pages || 0,
          cardsInjected: data.cardsInjected || 0,
          avgCardsPerPage: data.avgCardsPerPage || 0,
          languages: data.languages || 3,
          totalIndexablePages: data.totalIndexablePages || 0
        });
        
        toast({
          title: '✅ Geração concluída com sucesso!',
          description: `${data.pages} páginas criadas com ${data.cardsInjected} cards de produtos injetados.`,
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
    <Card id="parametros-tecnicos" className="scroll-mt-24 bg-gradient-card border-border shadow-medium">
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

        {loading && (
          <div className="space-y-3">
            <Progress value={undefined} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Gerando páginas multilíngues e injetando cards de produtos...
            </p>
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Resultado da Geração</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-background/50 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Páginas PT</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pages}</p>
                </div>
                <div className="bg-background/50 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Total (3 idiomas)</p>
                  <p className="text-2xl font-bold text-primary">{stats.totalIndexablePages}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Cards de produtos injetados:
                  </span>
                  <strong className="text-lg text-foreground">{stats.cardsInjected}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Média de cards por página:
                  </span>
                  <strong className="text-foreground">{stats.avgCardsPerPage.toFixed(1)}</strong>
                </div>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ Status:</strong> Páginas públicas indexáveis (Category F oculta na navegação, mas acessível via URL direta e sitemaps)
              </AlertDescription>
            </Alert>
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
          <p>• ✅ Gera páginas em 3 idiomas (PT, EN, ES)</p>
          <p>• 🎴 Injeta cards de produtos automaticamente</p>
          <p>• 🔍 Detecta menções de produtos e resinas no conteúdo</p>
          <p>• 📋 Inclui FAQs técnicas com Schema.org</p>
          <p>• 🌐 URLs públicas: /base-conhecimento/f/:slug</p>
          <p>• 🗺️ Incluído em sitemaps multilíngues</p>
          <p>• 🛒 Links diretos para e-commerce nos cards</p>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Eye, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Article {
  id: string;
  title: string;
  slug: string;
  content_html: string | null;
  has_tables: boolean;
  has_links: boolean;
  word_count: number;
}

export function AdminArticleReformatter() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProblematicArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('id, title, slug, content_html')
        .eq('active', true)
        .not('content_html', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Analisar HTML de cada artigo
      const analyzed = data?.map(article => {
        const html = article.content_html || '';
        const hasTableTag = html.includes('<table');
        const hasLinkTag = html.includes('<a href');
        const wordCount = html.split(/\s+/).length;

        // Heurística: artigo problemático se tem muito texto mas poucas tags estruturais
        const tableMatches = html.match(/\|\s*\w+\s*\|/g);
        const hasTables = hasTableTag || (tableMatches && tableMatches.length > 3);
        const hasLinks = hasLinkTag;

        return {
          ...article,
          has_tables: hasTables,
          has_links: hasLinks,
          word_count: wordCount,
        };
      }) || [];

      // Priorizar artigos sem estrutura mas com conteúdo
      const problematic = analyzed.filter(a => 
        (!a.has_tables || !a.has_links) && a.word_count > 200
      );

      setArticles(problematic);
    } catch (error) {
      console.error('Erro ao buscar artigos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os artigos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblematicArticles();
  }, []);

  const handlePreview = async (articleId: string) => {
    setProcessing(articleId);
    setPreviewHtml(null);
    setPreviewArticleId(null);

    try {
      const { data, error } = await supabase.functions.invoke('reformat-article-html', {
        body: { contentId: articleId, previewOnly: true },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar preview');
      }

      setPreviewHtml(data.reformatted);
      setPreviewArticleId(articleId);

      toast({
        title: 'Preview gerado',
        description: `${data.originalSize} → ${data.reformattedSize} chars`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar preview:', error);
      toast({
        title: 'Erro no preview',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleSave = async (articleId: string) => {
    if (!confirm('Confirma salvar o HTML reformatado? Esta ação substituirá o HTML atual.')) {
      return;
    }

    setProcessing(articleId);

    try {
      const { data, error } = await supabase.functions.invoke('reformat-article-html', {
        body: { contentId: articleId, previewOnly: false },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      toast({
        title: '✅ HTML Reformatado',
        description: data.message,
      });

      // Remover da lista
      setArticles(prev => prev.filter(a => a.id !== articleId));
      setPreviewHtml(null);
      setPreviewArticleId(null);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reformatar HTML de Artigos</h2>
          <p className="text-muted-foreground">
            {articles.length} artigos com HTML desestruturado detectados
          </p>
        </div>
        <Button onClick={fetchProblematicArticles} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {articles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum artigo problemático encontrado. Todos os artigos parecem estar bem estruturados!
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {articles.map(article => (
            <Card key={article.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{article.title}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      /{article.slug}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!article.has_tables && (
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        Sem tabelas
                      </Badge>
                    )}
                    {!article.has_links && (
                      <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20">
                        Sem links
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handlePreview(article.id)}
                    disabled={processing === article.id}
                    variant="outline"
                    size="sm"
                  >
                    {processing === article.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Preview
                  </Button>

                  <Button
                    onClick={() => handleSave(article.id)}
                    disabled={processing === article.id}
                    variant="default"
                    size="sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Reformatar e Salvar
                  </Button>

                  <Button
                    onClick={() => window.open(`/base-de-conhecimento/${article.slug}`, '_blank')}
                    variant="ghost"
                    size="sm"
                  >
                    Ver artigo →
                  </Button>
                </div>

                {previewArticleId === article.id && previewHtml && (
                  <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
                    <p className="text-sm font-semibold mb-2">Preview do HTML Reformatado:</p>
                    <div 
                      className="article-content max-h-96 overflow-y-auto text-sm"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LinkInjectionReport {
  productId: string;
  productName: string;
  existingLinks: number;
  injectedLinks: number;
  finalLinks: number;
  status: 'success' | 'skipped' | 'error';
}

export function AdminLinkBuildingValidator() {
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<LinkInjectionReport[]>([]);
  const [htmlBefore, setHtmlBefore] = useState('');
  const [htmlAfter, setHtmlAfter] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('id, title, content_html, recommended_products')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Erro ao carregar artigos:', error);
      toast({
        title: 'Erro ao carregar artigos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createTestArticles = async () => {
    setLoading(true);
    try {
      toast({
        title: 'Criando artigos de teste...',
        description: 'Isso pode levar alguns segundos'
      });
      
      const { data, error } = await supabase.functions.invoke('create-test-articles');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: '✅ Artigos criados',
          description: `${data.articles.length} artigos de teste foram criados com sucesso`
        });
        await loadArticles();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro ao criar artigos de teste:', error);
      toast({
        title: 'Erro ao criar artigos',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const injectPriorityLinks = async (html: string, productIds: string[]): Promise<{
    modifiedHTML: string;
    report: LinkInjectionReport[];
  }> => {
    if (!productIds || productIds.length === 0) {
      return { modifiedHTML: html, report: [] };
    }
    
    const injectionReport: LinkInjectionReport[] = [];
    
    try {
      // Buscar dados dos produtos selecionados
      const { data: products, error } = await supabase
        .from('system_a_catalog')
        .select('id, name, slug, canonical_url')
        .in('id', productIds);
      
      if (error || !products) {
        console.warn('⚠️ Erro ao buscar produtos:', error);
        return { modifiedHTML: html, report: [] };
      }
      
      let modifiedHTML = html;
      
      // Para cada produto, garantir pelo menos 2 links no HTML
      for (const product of products) {
        const productUrl = product.canonical_url || `/produtos/${product.slug}`;
        const linkRegex = new RegExp(`<a[^>]*href=["']${productUrl}["'][^>]*>`, 'gi');
        const existingLinksCount = (modifiedHTML.match(linkRegex) || []).length;
        
        const reportEntry: LinkInjectionReport = {
          productId: product.id,
          productName: product.name,
          existingLinks: existingLinksCount,
          injectedLinks: 0,
          finalLinks: existingLinksCount,
          status: 'skipped'
        };
        
        // Se já existem 2 ou mais links, pular
        if (existingLinksCount >= 2) {
          reportEntry.status = 'skipped';
          injectionReport.push(reportEntry);
          continue;
        }
        
        // Criar link HTML com classe especial para destacar
        const linkHTML = `<a href="${productUrl}" class="product-link priority injected-link" data-product-id="${product.id}" style="background-color: #fef3c7; padding: 2px 4px; border-radius: 3px;">${product.name}</a>`;
        
        // Tentar inserir após o primeiro <h2>
        const h2Regex = /<h2[^>]*>.*?<\/h2>/gi;
        const h2Matches = modifiedHTML.match(h2Regex);
        
        let injected = false;
        
        if (h2Matches && h2Matches.length > 0) {
          const firstH2Index = modifiedHTML.indexOf(h2Matches[0]);
          const nextParagraphIndex = modifiedHTML.indexOf('<p>', firstH2Index);
          
          if (nextParagraphIndex !== -1) {
            const insertionPoint = modifiedHTML.indexOf('</p>', nextParagraphIndex);
            if (insertionPoint !== -1) {
              modifiedHTML = modifiedHTML.slice(0, insertionPoint) + 
                            ` Saiba mais sobre ${linkHTML}.` + 
                            modifiedHTML.slice(insertionPoint);
              injected = true;
              reportEntry.injectedLinks = 1;
              reportEntry.finalLinks = existingLinksCount + 1;
              reportEntry.status = 'success';
            }
          }
        }
        
        // Fallback: tentar inserir no primeiro parágrafo
        if (!injected) {
          const firstParagraphMatch = modifiedHTML.match(/<p[^>]*>.*?<\/p>/i);
          if (firstParagraphMatch) {
            const insertionPoint = modifiedHTML.indexOf('</p>');
            if (insertionPoint !== -1) {
              modifiedHTML = modifiedHTML.slice(0, insertionPoint) + 
                            ` Confira ${linkHTML}.` + 
                            modifiedHTML.slice(insertionPoint);
              reportEntry.injectedLinks = 1;
              reportEntry.finalLinks = existingLinksCount + 1;
              reportEntry.status = 'success';
            }
          } else {
            reportEntry.status = 'error';
          }
        }
        
        injectionReport.push(reportEntry);
      }
      
      return { modifiedHTML, report: injectionReport };
    } catch (error) {
      console.error('❌ Erro ao injetar links:', error);
      return { modifiedHTML: html, report: [] };
    }
  };

  const handleTestInjection = async () => {
    if (!selectedArticleId) {
      toast({
        title: 'Selecione um artigo',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setReport([]);
    setHtmlBefore('');
    setHtmlAfter('');

    try {
      const article = articles.find(a => a.id === selectedArticleId);
      if (!article) throw new Error('Artigo não encontrado');

      const originalHTML = article.content_html || '';
      const productIds = article.recommended_products || [];

      if (productIds.length === 0) {
        toast({
          title: 'Artigo sem produtos recomendados',
          description: 'Selecione um artigo com produtos recomendados configurados',
          variant: 'destructive'
        });
        setTesting(false);
        return;
      }

      setHtmlBefore(originalHTML);

      const { modifiedHTML, report: injectionReport } = await injectPriorityLinks(
        originalHTML,
        productIds
      );

      setHtmlAfter(modifiedHTML);
      setReport(injectionReport);

      const totalInjected = injectionReport.reduce((sum, r) => sum + r.injectedLinks, 0);
      
      toast({
        title: '✅ Teste concluído',
        description: `${totalInjected} links injetados em ${injectionReport.length} produtos`
      });
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast({
        title: 'Erro no teste',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Validador de Link Building (Fase 3)
            </CardTitle>
            <Button
              onClick={createTestArticles}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              ➕ Criar Artigos de Teste
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Esta ferramenta testa a função <code>injectPriorityLinks</code> que injeta automaticamente
              links de produtos prioritários nos artigos gerados. Selecione um artigo para ver o antes/depois.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Artigo</label>
            <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um artigo para testar..." />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  articles.map(article => (
                    <SelectItem key={article.id} value={article.id}>
                      {article.title} ({article.recommended_products?.length || 0} produtos)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedArticle && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Artigo:</strong> {selectedArticle.title}</p>
              <p><strong>Produtos recomendados:</strong> {selectedArticle.recommended_products?.length || 0}</p>
              <p><strong>Tamanho HTML:</strong> {(selectedArticle.content_html?.length || 0).toLocaleString()} caracteres</p>
            </div>
          )}

          <Button 
            onClick={handleTestInjection}
            disabled={!selectedArticleId || testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando injeção de links...
              </>
            ) : (
              'Executar Teste de Link Building'
            )}
          </Button>
        </CardContent>
      </Card>

      {report.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Relatório de Injeção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.map((entry, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(entry.status)}
                      <h4 className="font-semibold">{entry.productName}</h4>
                    </div>
                    <Badge variant={entry.status === 'success' ? 'default' : 'secondary'}>
                      {entry.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Links Existentes</p>
                      <p className="font-medium">{entry.existingLinks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Links Injetados</p>
                      <p className="font-medium text-green-600">+{entry.injectedLinks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Final</p>
                      <p className="font-medium">{entry.finalLinks}</p>
                    </div>
                  </div>

                  {entry.status === 'skipped' && (
                    <p className="text-xs text-yellow-600 mt-2">
                      ⚠️ Artigo já possui 2+ links para este produto
                    </p>
                  )}
                  {entry.status === 'error' && (
                    <p className="text-xs text-red-600 mt-2">
                      ❌ Não foi possível inserir link (sem &lt;h2&gt; ou &lt;p&gt; disponível)
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Resumo</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-green-700">Total de Produtos</p>
                  <p className="text-2xl font-bold text-green-800">{report.length}</p>
                </div>
                <div>
                  <p className="text-green-700">Links Injetados</p>
                  <p className="text-2xl font-bold text-green-800">
                    {report.reduce((sum, r) => sum + r.injectedLinks, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-green-700">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold text-green-800">
                    {Math.round((report.filter(r => r.status === 'success').length / report.length) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {htmlAfter && (
        <Card>
          <CardHeader>
            <CardTitle>🔍 Visualização do HTML Modificado</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                Links injetados aparecem com fundo amarelo no HTML abaixo. Compare com o original.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">HTML Antes ({htmlBefore.length.toLocaleString()} caracteres)</h4>
                <div className="border rounded p-4 max-h-96 overflow-auto bg-gray-50">
                  <pre className="text-xs whitespace-pre-wrap">{htmlBefore.slice(0, 2000)}...</pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">HTML Depois ({htmlAfter.length.toLocaleString()} caracteres)</h4>
                <div className="border rounded p-4 max-h-96 overflow-auto bg-gray-50">
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: htmlAfter.slice(0, 3000) + '...' }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle, AlertTriangle, Package, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LinkInjectionReport {
  productId: string;
  productName: string;
  existingLinks: number;
  injectedLinks: number;
  finalLinks: number;
  status: 'success' | 'skipped' | 'error';
}

interface CardInjectionReport {
  articleId: string;
  articleTitle: string;
  detectedProducts: number;
  cardsInjected: number;
  productsLinked: string[];
  resinsLinked: string[];
  status: 'success' | 'error';
  error?: string;
}

export function AdminLinkBuildingValidator() {
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<LinkInjectionReport[]>([]);
  const [htmlBefore, setHtmlBefore] = useState('');
  const [htmlAfter, setHtmlAfter] = useState('');
  const [processingCards, setProcessingCards] = useState(false);
  const [cardReports, setCardReports] = useState<CardInjectionReport[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
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

  const handleInjectProductCards = async (batchProcess: boolean = false) => {
    setProcessingCards(true);
    setCardReports([]);
    setBatchProgress(null);

    try {
      if (batchProcess) {
        toast({
          title: '🚀 Processamento em lote iniciado',
          description: 'Analisando todos os artigos ativos...'
        });

        const { data, error } = await supabase.functions.invoke('auto-inject-product-cards', {
          body: { batchProcess: true }
        });

        if (error) throw error;

        setCardReports(data.reports || []);
        
        toast({
          title: '✅ Processamento concluído',
          description: `${data.totalCardsInjected} cards injetados em ${data.totalArticles} artigos`
        });
      } else {
        if (!selectedArticleId) {
          toast({
            title: 'Selecione um artigo',
            variant: 'destructive'
          });
          return;
        }

        toast({
          title: '🔍 Analisando artigo...',
          description: 'Detectando produtos mencionados'
        });

        const { data, error } = await supabase.functions.invoke('auto-inject-product-cards', {
          body: { articleId: selectedArticleId }
        });

        if (error) throw error;

        setCardReports([data.report]);
        
        toast({
          title: '✅ Cards injetados',
          description: `${data.report.cardsInjected} cards adicionados ao artigo`
        });

        // Recarregar artigo para ver mudanças
        await loadArticles();
      }
    } catch (error: any) {
      console.error('Erro ao injetar cards:', error);
      toast({
        title: 'Erro ao injetar cards',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessingCards(false);
      setBatchProgress(null);
    }
  };

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="cards" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cards">
            <Package className="mr-2 h-4 w-4" />
            Cards Visuais de Produtos
          </TabsTrigger>
          <TabsTrigger value="links">
            <ExternalLink className="mr-2 h-4 w-4" />
            Link Building (Fase 3)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Injeção Automática de Cards de Produtos
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Esta ferramenta detecta automaticamente menções a produtos e resinas nos artigos e
                  injeta cards visuais com links diretos para o e-commerce. Também atualiza os campos
                  <code className="mx-1">recommended_products</code> e <code>recommended_resins</code>
                  automaticamente.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Artigos Ativos</p>
                  <p className="text-2xl font-bold">{articles.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cards Injetados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {cardReports.reduce((sum, r) => sum + r.cardsInjected, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Produtos Linkados</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {cardReports.reduce((sum, r) => sum + r.productsLinked.length + r.resinsLinked.length, 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Testar em Artigo Específico</label>
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
                          {article.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedArticle && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Artigo:</strong> {selectedArticle.title}</p>
                  <p><strong>Tamanho HTML:</strong> {(selectedArticle.content_html?.length || 0).toLocaleString()} caracteres</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={() => handleInjectProductCards(false)}
                  disabled={!selectedArticleId || processingCards}
                  className="flex-1"
                  variant="outline"
                >
                  {processingCards ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-4 w-4" />
                      Testar Artigo Selecionado
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => handleInjectProductCards(true)}
                  disabled={processingCards}
                  className="flex-1"
                >
                  {processingCards ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Processar Todos os Artigos
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {cardReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Relatório de Injeção de Cards</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cardReports.map((report, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {report.status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          )}
                          <h4 className="font-semibold">{report.articleTitle}</h4>
                        </div>
                        <Badge variant={report.status === 'success' ? 'default' : 'destructive'}>
                          {report.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground">Produtos Detectados</p>
                          <p className="font-medium text-lg">{report.detectedProducts}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cards Injetados</p>
                          <p className="font-medium text-lg text-green-600">+{report.cardsInjected}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Produtos Linkados</p>
                          <p className="font-medium text-lg text-blue-600">{report.productsLinked.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Resinas Linkadas</p>
                          <p className="font-medium text-lg text-purple-600">{report.resinsLinked.length}</p>
                        </div>
                      </div>

                      {report.productsLinked.length > 0 && (
                        <div className="text-xs">
                          <p className="text-muted-foreground mb-1">Produtos:</p>
                          <div className="flex flex-wrap gap-1">
                            {report.productsLinked.map((name, i) => (
                              <Badge key={i} variant="secondary">{name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.resinsLinked.length > 0 && (
                        <div className="text-xs mt-2">
                          <p className="text-muted-foreground mb-1">Resinas:</p>
                          <div className="flex flex-wrap gap-1">
                            {report.resinsLinked.map((name, i) => (
                              <Badge key={i} variant="outline">{name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.error && (
                        <p className="text-xs text-red-600 mt-2">
                          ❌ Erro: {report.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Resumo Geral</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-green-700">Artigos Processados</p>
                      <p className="text-2xl font-bold text-green-800">{cardReports.length}</p>
                    </div>
                    <div>
                      <p className="text-green-700">Total de Cards</p>
                      <p className="text-2xl font-bold text-green-800">
                        {cardReports.reduce((sum, r) => sum + r.cardsInjected, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">Taxa de Sucesso</p>
                      <p className="text-2xl font-bold text-green-800">
                        {Math.round((cardReports.filter(r => r.status === 'success').length / cardReports.length) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="links" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

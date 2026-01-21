import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Eye, Save, AlertCircle, Check, X, Filter, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Article {
  id: string;
  title: string;
  slug: string;
  content_html: string | null;
  has_tables: boolean;
  has_links: boolean;
  has_veredict_box: boolean;
  has_ai_summary: boolean;
  has_author_signature: boolean;
  has_semantic_html: boolean;
  word_count: number;
  needs_reformatting: boolean;
}

type IssueFilter = 'all' | 'no-tables' | 'no-links' | 'no-veredict' | 'no-summary' | 'no-signature' | 'no-semantic';

export function AdminArticleReformatter() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const { toast } = useToast();

  const analyzeArticle = (article: { id: string; title: string; slug: string; content_html: string | null }): Article => {
    const html = article.content_html || '';
    
    // Detectar elementos estruturais
    const hasTableTag = html.includes('<table');
    const tableMatches = html.match(/\|\s*\w+\s*\|/g);
    const hasTables = hasTableTag || (tableMatches && tableMatches.length > 3);
    
    const hasLinks = html.includes('<a href');
    const hasVeredictBox = html.includes('veredict-box') || html.includes('class="veredict') || html.includes('ai-summary-box');
    const hasAiSummary = html.includes('class="ai-') || html.includes('summary-box') || html.includes('article-summary');
    const hasAuthorSignature = html.includes('author-signature') || html.includes('{{AUTHOR_SIGNATURE}}') || html.includes('assinatura-autor');
    const hasSemanticHtml = html.includes('role="') || html.includes('itemscope') || html.includes('aria-');
    
    const wordCount = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    
    // Critérios expandidos para reformatação
    const needsReformatting = 
      (!hasTables && wordCount > 500) ||
      (!hasLinks && wordCount > 300) ||
      (!hasVeredictBox && wordCount > 800) ||
      (!hasAiSummary && wordCount > 1000) ||
      !hasAuthorSignature ||
      (!hasSemanticHtml && wordCount > 500);

    return {
      ...article,
      has_tables: !!hasTables,
      has_links: hasLinks,
      has_veredict_box: hasVeredictBox,
      has_ai_summary: hasAiSummary,
      has_author_signature: hasAuthorSignature,
      has_semantic_html: hasSemanticHtml,
      word_count: wordCount,
      needs_reformatting: needsReformatting,
    };
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('id, title, slug, content_html')
        .eq('active', true)
        .not('content_html', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const analyzed = data?.map(analyzeArticle) || [];
      setArticles(analyzed);
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
    fetchArticles();
  }, []);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const total = articles.length;
    const withoutTables = articles.filter(a => !a.has_tables && a.word_count > 500).length;
    const withoutLinks = articles.filter(a => !a.has_links && a.word_count > 300).length;
    const withoutVeredict = articles.filter(a => !a.has_veredict_box && a.word_count > 800).length;
    const withoutSummary = articles.filter(a => !a.has_ai_summary && a.word_count > 1000).length;
    const withoutSignature = articles.filter(a => !a.has_author_signature).length;
    const withoutSemantic = articles.filter(a => !a.has_semantic_html && a.word_count > 500).length;
    const needsWork = articles.filter(a => a.needs_reformatting).length;
    const fullyStructured = total - needsWork;

    return { total, withoutTables, withoutLinks, withoutVeredict, withoutSummary, withoutSignature, withoutSemantic, needsWork, fullyStructured };
  }, [articles]);

  // Artigos filtrados
  const filteredArticles = useMemo(() => {
    let result = showAll ? articles : articles.filter(a => a.needs_reformatting);
    
    switch (issueFilter) {
      case 'no-tables':
        result = result.filter(a => !a.has_tables);
        break;
      case 'no-links':
        result = result.filter(a => !a.has_links);
        break;
      case 'no-veredict':
        result = result.filter(a => !a.has_veredict_box);
        break;
      case 'no-summary':
        result = result.filter(a => !a.has_ai_summary);
        break;
      case 'no-signature':
        result = result.filter(a => !a.has_author_signature);
        break;
      case 'no-semantic':
        result = result.filter(a => !a.has_semantic_html);
        break;
    }
    
    return result;
  }, [articles, showAll, issueFilter]);

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

      // Atualizar lista
      await fetchArticles();
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

  const SEOIndicator = ({ present, label }: { present: boolean; label: string }) => (
    <Badge 
      variant="outline" 
      className={present 
        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200" 
        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200"
      }
    >
      {present ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.needsWork}</p>
            <p className="text-xs text-muted-foreground">Precisam</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.fullyStructured}</p>
            <p className="text-xs text-muted-foreground">OK</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.withoutTables}</p>
            <p className="text-xs text-muted-foreground">Sem Tabelas</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.withoutLinks}</p>
            <p className="text-xs text-muted-foreground">Sem Links</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.withoutVeredict}</p>
            <p className="text-xs text-muted-foreground">Sem Veredict</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.withoutSummary}</p>
            <p className="text-xs text-muted-foreground">Sem Summary</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.withoutSignature}</p>
            <p className="text-xs text-muted-foreground">Sem Assinatura</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
            <Label htmlFor="show-all" className="text-sm">
              <List className="w-4 h-4 inline mr-1" />
              Mostrar todos ({articles.length})
            </Label>
          </div>
          
          <Select value={issueFilter} onValueChange={(v) => setIssueFilter(v as IssueFilter)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os problemas</SelectItem>
              <SelectItem value="no-tables">Sem tabelas</SelectItem>
              <SelectItem value="no-links">Sem links</SelectItem>
              <SelectItem value="no-veredict">Sem VeredictBox</SelectItem>
              <SelectItem value="no-summary">Sem AI Summary</SelectItem>
              <SelectItem value="no-signature">Sem assinatura</SelectItem>
              <SelectItem value="no-semantic">Sem HTML semântico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Exibindo {filteredArticles.length} artigos
          </span>
          <Button onClick={fetchArticles} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de Artigos */}
      {filteredArticles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {showAll 
              ? 'Nenhum artigo encontrado com o filtro selecionado.' 
              : 'Todos os artigos estão bem estruturados! Ative "Mostrar todos" para ver a lista completa.'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {filteredArticles.map(article => (
            <Card key={article.id} className={article.needs_reformatting ? 'border-orange-200 dark:border-orange-800' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{article.title}</CardTitle>
                    <CardDescription className="font-mono text-xs truncate">
                      /{article.slug} • {article.word_count} palavras
                    </CardDescription>
                  </div>
                  {article.needs_reformatting && (
                    <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 shrink-0">
                      Precisa reformatar
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Indicadores SEO */}
                <div className="flex flex-wrap gap-1.5">
                  <SEOIndicator present={article.has_tables} label="Tabelas" />
                  <SEOIndicator present={article.has_links} label="Links" />
                  <SEOIndicator present={article.has_veredict_box} label="Veredict" />
                  <SEOIndicator present={article.has_ai_summary} label="Summary" />
                  <SEOIndicator present={article.has_author_signature} label="Assinatura" />
                  <SEOIndicator present={article.has_semantic_html} label="Semântico" />
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
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

                {/* Preview */}
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

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, CheckCircle, XCircle, AlertCircle, FileText, Link, Table, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnrichmentReport {
  articleId: string;
  articleTitle: string;
  slug: string;
  changes: {
    summaryBoxAdded: boolean;
    dataTablesCreated: number;
    internalLinksAdded: number;
    externalLinksAdded: number;
    relatedArticlesSection: boolean;
  };
  beforeLength: number;
  afterLength: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

interface EnrichmentSummary {
  total: number;
  enriched: number;
  skipped: number;
  errors: number;
}

export default function AdminArticleEnricher() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [reports, setReports] = useState<EnrichmentReport[]>([]);
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);

  const runEnrichment = async (batchProcess: boolean = true) => {
    setLoading(true);
    setReports([]);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-article-seo', {
        body: {
          batchProcess,
          minLength: 5000,
          dryRun,
          limit: 20,
        },
      });

      if (error) throw error;

      if (data.success) {
        setReports(data.reports || []);
        setSummary(data.summary);
        
        toast({
          title: dryRun ? '🔍 Preview Gerado' : '✅ Enriquecimento Concluído',
          description: `${data.summary.enriched} artigos ${dryRun ? 'serão' : 'foram'} enriquecidos`,
        });
      } else {
        throw new Error(data.error || 'Falha no enriquecimento');
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao processar artigos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Enriquecido</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Ignorado</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enriquecedor de Artigos SEO
          </CardTitle>
          <CardDescription>
            Adiciona automaticamente Featured Snippets, tabelas estruturadas, links internos e externos E-E-A-T aos artigos substanciais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
              <Label htmlFor="dry-run" className="text-sm">
                Modo Preview (não salva alterações)
              </Label>
            </div>
            
            <Button 
              onClick={() => runEnrichment(true)} 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {dryRun ? 'Gerar Preview' : 'Executar Enriquecimento'}
                </>
              )}
            </Button>
          </div>

          {/* What it does */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Summary Box</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Table className="h-4 w-4 text-green-500" />
              <span>Tabelas Técnicas</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link className="h-4 w-4 text-purple-500" />
              <span>Links Internos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4 text-orange-500" />
              <span>Links E-E-A-T</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">Total Analisados</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{summary.enriched}</div>
              <p className="text-xs text-muted-foreground">Enriquecidos</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-500">{summary.skipped}</div>
              <p className="text-xs text-muted-foreground">Já Otimizados</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{summary.errors}</div>
              <p className="text-xs text-muted-foreground">Erros</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports List */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Relatório de Processamento</CardTitle>
            <CardDescription>
              {dryRun ? 'Preview das alterações (nada foi salvo)' : 'Alterações aplicadas aos artigos'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {reports.map((report) => (
                  <div 
                    key={report.articleId}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(report.status)}
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{report.articleTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          /base-conhecimento/a/{report.slug}
                        </div>
                        
                        {report.status === 'success' && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {report.changes.summaryBoxAdded && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Summary Box
                              </Badge>
                            )}
                            {report.changes.dataTablesCreated > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Table className="h-3 w-3 mr-1" />
                                {report.changes.dataTablesCreated} Tabela(s)
                              </Badge>
                            )}
                            {report.changes.internalLinksAdded > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Link className="h-3 w-3 mr-1" />
                                {report.changes.internalLinksAdded} Links KB
                              </Badge>
                            )}
                            {report.changes.externalLinksAdded > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {report.changes.externalLinksAdded} E-E-A-T
                              </Badge>
                            )}
                            {report.changes.relatedArticlesSection && (
                              <Badge variant="outline" className="text-xs">
                                📚 Relacionados
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {report.error && (
                          <div className="text-xs text-red-500 mt-1">{report.error}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(report.status)}
                      {report.status === 'success' && (
                        <div className="text-xs text-muted-foreground">
                          {Math.round(report.beforeLength / 1024)}KB → {Math.round(report.afterLength / 1024)}KB
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && !summary && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Clique em "Gerar Preview" para analisar os artigos substanciais</p>
            <p className="text-xs mt-1">Artigos com mais de 5KB de conteúdo serão processados</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Search, CheckCircle2, AlertCircle, TrendingUp, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AuditSource = 'resin' | 'product' | 'article';

interface AuditRow {
  id: string;
  name: string;
  group: string; // fabricante (resina) | categoria (produto) | categoria da KB (artigo)
  source: AuditSource;
  has_meta_description: boolean;
  has_og_image: boolean;
  has_keywords: boolean;
  keywords_count: number;
  has_translation_en: boolean | null; // null = não aplicável (não é artigo)
  has_translation_es: boolean | null;
}

interface SEOStats {
  total: number;
  with_meta_description: number;
  with_og_image: number;
  with_keywords: number;
  complete_coverage: number;
}

interface TranslationStats {
  total_articles: number;
  with_en: number;
  with_es: number;
}

const SOURCE_LABEL: Record<AuditSource, string> = {
  resin: 'Resina',
  product: 'Produto',
  article: 'Artigo',
};

export function SEOAuditPanel() {
  const [stats, setStats] = useState<SEOStats>({
    total: 0,
    with_meta_description: 0,
    with_og_image: 0,
    with_keywords: 0,
    complete_coverage: 0,
  });
  const [translationStats, setTranslationStats] = useState<TranslationStats>({
    total_articles: 0,
    with_en: 0,
    with_es: 0,
  });
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSEOAudit();
  }, []);

  const loadSEOAudit = async () => {
    try {
      setLoading(true);

      const [resinsRes, productsRes, articlesRes] = await Promise.all([
        supabase
          .from('resins')
          .select('id, name, manufacturer, meta_description, og_image_url, keywords')
          .eq('active', true)
          .order('name'),
        supabase
          .from('system_a_catalog')
          .select('id, name, product_category, meta_description, og_image_url, keywords')
          .eq('category', 'product')
          .eq('active', true)
          .eq('approved', true)
          .order('name'),
        supabase
          .from('knowledge_contents')
          .select('id, title, meta_description, excerpt, og_image_url, content_image_url, keywords, title_en, content_html_en, title_es, content_html_es, knowledge_categories(name)')
          .eq('active', true)
          .order('title'),
      ]);

      if (resinsRes.error) throw resinsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (articlesRes.error) throw articlesRes.error;

      const resinRows: AuditRow[] = (resinsRes.data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        group: r.manufacturer || '—',
        source: 'resin',
        has_meta_description: !!r.meta_description,
        has_og_image: !!r.og_image_url,
        has_keywords: !!(r.keywords && r.keywords.length > 0),
        keywords_count: r.keywords?.length || 0,
        has_translation_en: null,
        has_translation_es: null,
      }));

      const productRows: AuditRow[] = (productsRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        group: p.product_category || '—',
        source: 'product',
        has_meta_description: !!p.meta_description,
        has_og_image: !!p.og_image_url,
        has_keywords: !!(p.keywords && p.keywords.length > 0),
        keywords_count: p.keywords?.length || 0,
        has_translation_en: null,
        has_translation_es: null,
      }));

      const articleRows: AuditRow[] = (articlesRes.data || []).map((a: any) => ({
        id: a.id,
        name: a.title,
        group: a.knowledge_categories?.name || '—',
        source: 'article',
        has_meta_description: !!(a.meta_description || a.excerpt),
        has_og_image: !!(a.og_image_url || a.content_image_url),
        has_keywords: !!(a.keywords && a.keywords.length > 0),
        keywords_count: a.keywords?.length || 0,
        has_translation_en: !!(a.title_en && a.content_html_en),
        has_translation_es: !!(a.title_es && a.content_html_es),
      }));

      const allRows = [...resinRows, ...productRows, ...articleRows];

      const total = allRows.length;
      const with_meta = allRows.filter((r) => r.has_meta_description).length;
      const with_og = allRows.filter((r) => r.has_og_image).length;
      const with_kw = allRows.filter((r) => r.has_keywords).length;
      const complete = allRows.filter((r) => r.has_meta_description && r.has_og_image && r.has_keywords).length;

      setStats({
        total,
        with_meta_description: with_meta,
        with_og_image: with_og,
        with_keywords: with_kw,
        complete_coverage: complete,
      });

      setTranslationStats({
        total_articles: articleRows.length,
        with_en: articleRows.filter((r) => r.has_translation_en).length,
        with_es: articleRows.filter((r) => r.has_translation_es).length,
      });

      setRows(allRows);
    } catch (error) {
      console.error('Error loading SEO audit:', error);
      toast({
        title: 'Erro ao carregar auditoria',
        description: 'Não foi possível carregar os dados de SEO.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (value: number, total: number = stats.total): number => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  const rowsWithMissingData = rows.filter(
    (r) =>
      !r.has_meta_description ||
      !r.has_og_image ||
      !r.has_keywords ||
      r.has_translation_en === false ||
      r.has_translation_es === false,
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando auditoria SEO...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais — resinas + produtos + artigos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meta Descriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(stats.with_meta_description)}%
              </div>
              <Progress value={calculatePercentage(stats.with_meta_description)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.with_meta_description} de {stats.total} itens
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              OG Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(stats.with_og_image)}%
              </div>
              <Progress value={calculatePercentage(stats.with_og_image)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.with_og_image} de {stats.total} itens
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(stats.with_keywords)}%
              </div>
              <Progress value={calculatePercentage(stats.with_keywords)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.with_keywords} de {stats.total} itens
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Cobertura Completa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(stats.complete_coverage)}%
              </div>
              <Progress value={calculatePercentage(stats.complete_coverage)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.complete_coverage} de {stats.total} itens
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cobertura de tradução EN/ES — só artigos da Base de Conhecimento têm campos _en/_es */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Artigos traduzidos (EN)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(translationStats.with_en, translationStats.total_articles)}%
              </div>
              <Progress value={calculatePercentage(translationStats.with_en, translationStats.total_articles)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {translationStats.with_en} de {translationStats.total_articles} artigos — sem tradução, bots (llms-full.txt, seo-proxy) recebem português rotulado como PT
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Artigos traduzidos (ES)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {calculatePercentage(translationStats.with_es, translationStats.total_articles)}%
              </div>
              <Progress value={calculatePercentage(translationStats.with_es, translationStats.total_articles)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {translationStats.with_es} de {translationStats.total_articles} artigos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Itens com Dados Faltando — resinas, produtos e artigos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Itens com Dados SEO Incompletos
          </CardTitle>
          <CardDescription>
            {rowsWithMissingData.length === 0
              ? '✅ Resinas, produtos e artigos possuem dados SEO completos!'
              : `${rowsWithMissingData.length} item(ns) — resinas, produtos e artigos da Base de Conhecimento — precisam de enriquecimento`}
          </CardDescription>
        </CardHeader>
        {rowsWithMissingData.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria/Fabricante</TableHead>
                  <TableHead className="text-center">Meta Description</TableHead>
                  <TableHead className="text-center">OG Image</TableHead>
                  <TableHead className="text-center">Keywords</TableHead>
                  <TableHead className="text-center">EN</TableHead>
                  <TableHead className="text-center">ES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithMissingData.map((row) => (
                  <TableRow key={`${row.source}-${row.id}`}>
                    <TableCell>
                      <Badge variant="outline">{SOURCE_LABEL[row.source]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.group}</TableCell>
                    <TableCell className="text-center">
                      {row.has_meta_description ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.has_og_image ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.has_keywords ? (
                        <Badge variant="default">{row.keywords_count} kw</Badge>
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.has_translation_en === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.has_translation_en ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.has_translation_es === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.has_translation_es ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

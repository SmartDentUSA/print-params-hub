import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Search, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResinSEOStatus {
  id: string;
  name: string;
  manufacturer: string;
  has_meta_description: boolean;
  has_og_image: boolean;
  has_keywords: boolean;
  keywords_count: number;
}

interface SEOStats {
  total: number;
  with_meta_description: number;
  with_og_image: number;
  with_keywords: number;
  complete_coverage: number;
}

export function SEOAuditPanel() {
  const [stats, setStats] = useState<SEOStats>({
    total: 0,
    with_meta_description: 0,
    with_og_image: 0,
    with_keywords: 0,
    complete_coverage: 0
  });
  const [resins, setResins] = useState<ResinSEOStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSEOAudit();
  }, []);

  const loadSEOAudit = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('resins')
        .select('id, name, manufacturer, meta_description, og_image_url, keywords')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      if (data) {
        // Calcular estatísticas
        const total = data.length;
        const with_meta = data.filter(r => r.meta_description).length;
        const with_og = data.filter(r => r.og_image_url).length;
        const with_kw = data.filter(r => r.keywords && r.keywords.length > 0).length;
        const complete = data.filter(r => 
          r.meta_description && r.og_image_url && r.keywords && r.keywords.length > 0
        ).length;

        setStats({
          total,
          with_meta_description: with_meta,
          with_og_image: with_og,
          with_keywords: with_kw,
          complete_coverage: complete
        });

        // Mapear resinas com status SEO
        const resinStatus: ResinSEOStatus[] = data.map(r => ({
          id: r.id,
          name: r.name,
          manufacturer: r.manufacturer,
          has_meta_description: !!r.meta_description,
          has_og_image: !!r.og_image_url,
          has_keywords: !!(r.keywords && r.keywords.length > 0),
          keywords_count: r.keywords?.length || 0
        }));

        setResins(resinStatus);
      }
    } catch (error) {
      console.error('Error loading SEO audit:', error);
      toast({
        title: 'Erro ao carregar auditoria',
        description: 'Não foi possível carregar os dados de SEO.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (value: number): number => {
    return stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
  };

  const resinsWithMissingData = resins.filter(r => 
    !r.has_meta_description || !r.has_og_image || !r.has_keywords
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
      {/* Estatísticas Gerais */}
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
                {stats.with_meta_description} de {stats.total} resinas
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
                {stats.with_og_image} de {stats.total} resinas
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
                {stats.with_keywords} de {stats.total} resinas
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
                {stats.complete_coverage} de {stats.total} resinas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resinas com Dados Faltando */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Resinas com Dados SEO Incompletos
          </CardTitle>
          <CardDescription>
            {resinsWithMissingData.length === 0 
              ? '✅ Todas as resinas possuem dados SEO completos!'
              : `${resinsWithMissingData.length} resina(s) precisam de enriquecimento do Sistema A`
            }
          </CardDescription>
        </CardHeader>
        {resinsWithMissingData.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resina</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-center">Meta Description</TableHead>
                  <TableHead className="text-center">OG Image</TableHead>
                  <TableHead className="text-center">Keywords</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resinsWithMissingData.map((resin) => (
                  <TableRow key={resin.id}>
                    <TableCell className="font-medium">{resin.name}</TableCell>
                    <TableCell>{resin.manufacturer}</TableCell>
                    <TableCell className="text-center">
                      {resin.has_meta_description ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {resin.has_og_image ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {resin.has_keywords ? (
                        <Badge variant="default">{resin.keywords_count} kw</Badge>
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

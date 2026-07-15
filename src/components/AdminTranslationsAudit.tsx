import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Download, Languages, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Row {
  id: string;
  title: string;
  slug: string;
  has_en: boolean;
  has_es: boolean;
  has_faq_pt: boolean;
  has_faq_en: boolean;
  has_faq_es: boolean;
}

type Filter = 'all' | 'no-en' | 'no-es' | 'no-faq-any' | 'no-faq-all';

function hasFaqs(v: any): boolean {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}

function hasText(v: any): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function AdminTranslationsAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const { toast } = useToast();

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('id, title, slug, title_en, title_es, content_html_en, content_html_es, faqs, faqs_en, faqs_es')
        .eq('active', true)
        .order('title');
      if (error) throw error;
      const analyzed: Row[] = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        has_en: hasText(r.title_en) && hasText(r.content_html_en),
        has_es: hasText(r.title_es) && hasText(r.content_html_es),
        has_faq_pt: hasFaqs(r.faqs),
        has_faq_en: hasFaqs(r.faqs_en),
        has_faq_es: hasFaqs(r.faqs_es),
      }));
      setRows(analyzed);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    noEn: rows.filter(r => !r.has_en).length,
    noEs: rows.filter(r => !r.has_es).length,
    noFaqPt: rows.filter(r => !r.has_faq_pt).length,
    noFaqEn: rows.filter(r => !r.has_faq_en).length,
    noFaqEs: rows.filter(r => !r.has_faq_es).length,
  }), [rows]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'no-en': return rows.filter(r => !r.has_en);
      case 'no-es': return rows.filter(r => !r.has_es);
      case 'no-faq-any': return rows.filter(r => !r.has_faq_pt || !r.has_faq_en || !r.has_faq_es);
      case 'no-faq-all': return rows.filter(r => !r.has_faq_pt && !r.has_faq_en && !r.has_faq_es);
      default: return rows;
    }
  }, [rows, filter]);

  const exportCsv = () => {
    const header = ['id', 'slug', 'title', 'has_en', 'has_es', 'has_faq_pt', 'has_faq_en', 'has_faq_es'];
    const lines = [header.join(',')];
    for (const r of filtered) {
      const cells = [r.id, r.slug, `"${(r.title || '').replace(/"/g, '""')}"`, r.has_en, r.has_es, r.has_faq_pt, r.has_faq_en, r.has_faq_es];
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-traducoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Ind = ({ ok, label }: { ok: boolean; label: string }) => (
    <Badge variant="outline" className={ok
      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200"
      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200"}>
      {ok ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="w-5 h-5" />
          Auditoria de Traduções e FAQs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-red-500">{stats.noEn}</p><p className="text-xs text-muted-foreground">Sem EN</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-red-500">{stats.noEs}</p><p className="text-xs text-muted-foreground">Sem ES</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-500">{stats.noFaqPt}</p><p className="text-xs text-muted-foreground">Sem FAQ PT</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-500">{stats.noFaqEn}</p><p className="text-xs text-muted-foreground">Sem FAQ EN</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-500">{stats.noFaqEs}</p><p className="text-xs text-muted-foreground">Sem FAQ ES</p></CardContent></Card>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="no-en">Sem tradução EN</SelectItem>
                  <SelectItem value="no-es">Sem tradução ES</SelectItem>
                  <SelectItem value="no-faq-any">Sem FAQ em ao menos 1 idioma</SelectItem>
                  <SelectItem value="no-faq-all">Sem FAQ em nenhum idioma</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{filtered.length} artigos</span>
                <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
                <Button onClick={exportCsv} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />CSV</Button>
              </div>
            </div>

            <div className="grid gap-2 max-h-[600px] overflow-y-auto">
              {filtered.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-md bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">/{r.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Ind ok={r.has_en} label="EN" />
                    <Ind ok={r.has_es} label="ES" />
                    <Ind ok={r.has_faq_pt} label="FAQ PT" />
                    <Ind ok={r.has_faq_en} label="FAQ EN" />
                    <Ind ok={r.has_faq_es} label="FAQ ES" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => window.open(`/base-de-conhecimento/${r.slug}`, '_blank')}>Ver →</Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
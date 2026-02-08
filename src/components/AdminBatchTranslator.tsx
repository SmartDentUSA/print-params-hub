import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages, Play, Pause, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ArticleTranslationStatus {
  id: string;
  title: string;
  slug: string;
  has_en: boolean;
  has_es: boolean;
  content_length: number;
  status: 'pending' | 'translating' | 'done' | 'error';
  error?: string;
}

export function AdminBatchTranslator() {
  const [articles, setArticles] = useState<ArticleTranslationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [paused, setPaused] = useState(false);
  const [targetLang, setTargetLang] = useState<'en' | 'es'>('en');
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });
  const [currentArticle, setCurrentArticle] = useState<string | null>(null);
  const [includeShortArticles, setIncludeShortArticles] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('id, title, slug, title_en, title_es, content_html_en, content_html_es, content_html')
        .eq('active', true)
        .order('order_index');

      if (error) throw error;

      const mapped: ArticleTranslationStatus[] = (data || []).map(a => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        has_en: !!(a.title_en && a.content_html_en),
        has_es: !!(a.title_es && a.content_html_es),
        content_length: a.content_html?.length || 0,
        status: 'pending' as const,
      }));

      setArticles(mapped);
    } catch (err) {
      console.error('Error fetching articles:', err);
      toast.error('Erro ao carregar artigos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const pendingArticles = articles.filter(a => {
    const needsTranslation = targetLang === 'en' ? !a.has_en : !a.has_es;
    if (!includeShortArticles && a.content_length < 500) return false;
    return needsTranslation;
  });

  const translateArticle = async (articleId: string): Promise<boolean> => {
    try {
      // Fetch full article data
      const { data: article, error: fetchErr } = await supabase
        .from('knowledge_contents')
        .select('title, excerpt, content_html, faqs, ai_context')
        .eq('id', articleId)
        .single();

      if (fetchErr || !article) throw new Error('Article not found');

      // Call translate-content edge function
      const { data: translated, error: translateErr } = await supabase.functions.invoke('translate-content', {
        body: {
          title: article.title,
          excerpt: article.excerpt,
          htmlContent: article.content_html,
          faqs: article.faqs,
          targetLanguage: targetLang,
        },
      });

      if (translateErr) throw translateErr;

      // Save translation to database
      const updateFields = targetLang === 'en'
        ? {
            title_en: translated.translatedTitle,
            excerpt_en: translated.translatedExcerpt,
            content_html_en: translated.translatedHTML,
            faqs_en: translated.translatedFAQs,
          }
        : {
            title_es: translated.translatedTitle,
            excerpt_es: translated.translatedExcerpt,
            content_html_es: translated.translatedHTML,
            faqs_es: translated.translatedFAQs,
          };

      const { error: updateErr } = await supabase
        .from('knowledge_contents')
        .update(updateFields)
        .eq('id', articleId);

      if (updateErr) throw updateErr;

      return true;
    } catch (err) {
      console.error(`Translation error for ${articleId}:`, err);
      return false;
    }
  };

  const startBatchTranslation = async () => {
    setTranslating(true);
    setPaused(false);

    const toTranslate = [...pendingArticles];
    setProgress({ current: 0, total: toTranslate.length, success: 0, errors: 0 });

    for (let i = 0; i < toTranslate.length; i++) {
      // Check if paused
      if (paused) {
        toast.info(`Tradução pausada em ${i}/${toTranslate.length}`);
        break;
      }

      const article = toTranslate[i];
      setCurrentArticle(article.title);
      setProgress(p => ({ ...p, current: i + 1 }));

      // Update status
      setArticles(prev =>
        prev.map(a => a.id === article.id ? { ...a, status: 'translating' } : a)
      );

      const success = await translateArticle(article.id);

      setArticles(prev =>
        prev.map(a =>
          a.id === article.id
            ? {
                ...a,
                status: success ? 'done' : 'error',
                ...(success ? (targetLang === 'en' ? { has_en: true } : { has_es: true }) : {}),
                error: success ? undefined : 'Falha na tradução',
              }
            : a
        )
      );

      setProgress(p => ({
        ...p,
        success: p.success + (success ? 1 : 0),
        errors: p.errors + (success ? 0 : 1),
      }));

      // Rate limit: wait 2s between translations
      if (i < toTranslate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setTranslating(false);
    setCurrentArticle(null);
    toast.success(`Tradução em lote concluída! ${progress.success} traduzidos, ${progress.errors} erros.`);
  };

  const totalEN = articles.filter(a => a.has_en).length;
  const totalES = articles.filter(a => a.has_es).length;
  const total = articles.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total de Artigos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalEN}</p>
            <p className="text-xs text-muted-foreground">Com Inglês 🇺🇸</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalES}</p>
            <p className="text-xs text-muted-foreground">Com Espanhol 🇪🇸</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{pendingArticles.length}</p>
            <p className="text-xs text-muted-foreground">Pendentes ({targetLang.toUpperCase()})</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={targetLang} onValueChange={(v) => setTargetLang(v as 'en' | 'es')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">🇺🇸 Inglês (EN)</SelectItem>
            <SelectItem value="es">🇪🇸 Espanhol (ES)</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            checked={includeShortArticles}
            onCheckedChange={setIncludeShortArticles}
            id="include-short"
          />
          <label htmlFor="include-short" className="text-sm text-muted-foreground cursor-pointer">
            Incluir artigos curtos (&lt;500 chars)
          </label>
        </div>

        {!translating ? (
          <Button
            onClick={startBatchTranslation}
            disabled={pendingArticles.length === 0}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Traduzir {pendingArticles.length} Artigos para {targetLang.toUpperCase()}
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setPaused(true)}
            className="gap-2"
          >
            <Pause className="w-4 h-4" />
            Pausar Tradução
          </Button>
        )}
      </div>

      {/* Progress */}
      {translating && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Traduzindo {progress.current}/{progress.total}...
              </span>
              <span className="text-xs">
                ✅ {progress.success} | ❌ {progress.errors}
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} />
            {currentArticle && (
              <p className="text-xs text-muted-foreground truncate">
                📝 {currentArticle}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Article List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {pendingArticles.slice(0, 50).map(article => (
          <div
            key={article.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{article.title}</p>
              <p className="text-xs text-muted-foreground">
                {(article.content_length / 1000).toFixed(1)}k chars
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {article.status === 'done' && (
                <Badge variant="default" className="bg-green-600 text-white gap-1">
                  <CheckCircle className="w-3 h-3" /> OK
                </Badge>
              )}
              {article.status === 'error' && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" /> Erro
                </Badge>
              )}
              {article.status === 'translating' && (
                <Badge variant="outline" className="gap-1 animate-pulse">
                  <Clock className="w-3 h-3" /> Traduzindo...
                </Badge>
              )}
              {article.status === 'pending' && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> Pendente
                </Badge>
              )}
            </div>
          </div>
        ))}

        {pendingArticles.length > 50 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            +{pendingArticles.length - 50} artigos não mostrados
          </p>
        )}
      </div>
    </div>
  );
}

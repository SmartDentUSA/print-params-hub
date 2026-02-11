import { useEffect, useState, useMemo } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ExternalLink } from 'lucide-react';
import { useKnowledge, getVideoEmbedUrl } from '@/hooks/useKnowledge';
import { AuthorSignature } from '@/components/AuthorSignature';
import { renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { KnowledgeSEOHead } from '@/components/KnowledgeSEOHead';
import { KnowledgeCTA } from '@/components/KnowledgeCTA';
import { VideoSchema } from '@/components/VideoSchema';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedTitle, getLocalizedExcerpt } from '@/utils/i18nPaths';
import { KnowledgeFAQ } from '@/components/KnowledgeFAQ';
import { PDFContentRenderer } from '@/components/PDFContentRenderer';
import { PDFViewerEmbed } from '@/components/PDFViewerEmbed';
import { useIsMobile } from '@/hooks/use-mobile';
import { LanguageFlags } from '@/components/LanguageFlags';
import { VideoLanguageIndicator } from '@/components/VideoLanguageIndicator';
import { toast } from 'sonner';
import { ArticleSummary } from '@/components/ArticleSummary';
import { ArticleMeta } from '@/components/ArticleMeta';
import { VeredictBox } from '@/components/VeredictBox';

function getFriendlyLabel(url: string): string {
  if (url.includes('drive.google.com')) return 'Ver Documento';
  if (url.includes('docs.google.com')) return 'Ver Documento';
  if (url.includes('loja.smartdent.com.br')) {
    const slug = url.split('/').pop();
    return slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Ver na Loja';
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Assistir Vídeo';
  if (url.includes('pubmed')) return 'Ver Estudo (PubMed)';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Ver Link';
  }
}

function prettifyLinkLabels(html: string): string {
  return html.replace(
    /<a\s([^>]*href="([^"]*)"[^>]*)>(https?:\/\/[^<]+)<\/a>/gi,
    (_match, attrs, href) => {
      const label = getFriendlyLabel(href);
      return `<a ${attrs}>${label} ↗</a>`;
    }
  );
}

interface KnowledgeContentViewerProps {
  content: any;
}

export function KnowledgeContentViewer({ content }: KnowledgeContentViewerProps) {
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [videos, setVideos] = useState<any[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [ctaResins, setCtaResins] = useState<any[]>([]);
  const [relatedDocuments, setRelatedDocuments] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedPdfs, setSelectedPdfs] = useState<any[]>([]);
  const { fetchVideosByContent, fetchRelatedContents } = useKnowledge();
  const [translating, setTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<{
    title: string;
    excerpt: string;
    content_html: string;
    faqs: any;
  } | null>(null);

  // Check if translation exists for requested language
  const hasTranslation = useMemo(() => {
    if (language === 'pt') return true;
    if (language === 'en') return !!(content.title_en && content.content_html_en);
    if (language === 'es') return !!(content.title_es && content.content_html_es);
    return false;
  }, [language, content]);

  // Auto-translate when translation is missing
  useEffect(() => {
    if (language === 'pt' || hasTranslation || translating) return;
    // Reset previous translation when content/language changes
    setTranslatedContent(null);

    let cancelled = false;
    const translate = async () => {
      setTranslating(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate-content', {
          body: {
            title: content.title,
            excerpt: content.excerpt,
            htmlContent: content.content_html,
            faqs: content.faqs,
            targetLanguage: language,
          }
        });

        if (error || !data) {
          console.error('Translation error:', error);
          toast.error(language === 'en' 
            ? 'Failed to translate content. Showing original.' 
            : 'Error al traducir el contenido. Mostrando original.');
          setTranslating(false);
          return;
        }

        // Save translation to database for future visits
        const langSuffix = language === 'en' ? '_en' : '_es';
        const updatePayload: Record<string, any> = {};
        if (data.translatedTitle) updatePayload[`title${langSuffix}`] = data.translatedTitle;
        if (data.translatedExcerpt) updatePayload[`excerpt${langSuffix}`] = data.translatedExcerpt;
        if (data.translatedHTML) updatePayload[`content_html${langSuffix}`] = data.translatedHTML;
        if (data.translatedFAQs) updatePayload[`faqs${langSuffix}`] = data.translatedFAQs;

        if (Object.keys(updatePayload).length > 0) {
          const { error: saveError } = await supabase
            .from('knowledge_contents')
            .update(updatePayload)
            .eq('id', content.id);
          
          if (saveError) {
            console.error('Failed to save translation:', saveError);
          }
        }

        if (!cancelled) {
          setTranslatedContent({
            title: data.translatedTitle || content.title,
            excerpt: data.translatedExcerpt || content.excerpt,
            content_html: data.translatedHTML || content.content_html,
            faqs: data.translatedFAQs || content.faqs,
          });
        }
      } catch (err) {
        console.error('Translation failed:', err);
        toast.error(language === 'en' 
          ? 'Translation service unavailable.' 
          : 'Servicio de traducción no disponible.');
      } finally {
        if (!cancelled) setTranslating(false);
      }
    };

    translate();
    return () => { cancelled = true; };
  }, [content?.id, language, hasTranslation]);

  // Fetch data - dependencies simplified since functions are now memoized
  useEffect(() => {
    if (!content?.id) return;
    
    const load = async () => {
      // Determinar array de PDF IDs baseado no idioma
      const pdfIds = language === 'es' 
        ? content.selected_pdf_ids_es || []
        : language === 'en'
        ? content.selected_pdf_ids_en || []
        : content.selected_pdf_ids_pt || [];

      // Fetch paralelo: videos + artigos relacionados + resinas CTA + documentos relacionados + PDFs selecionados
      const [vids, related, resinsData, documentsData, pdfsData] = await Promise.all([
        fetchVideosByContent(content.id),
        fetchRelatedContents(
          content.id, 
          content.category_id, 
          content.keywords || []
        ),
        // Fetch resinas apenas se necessário
        content.recommended_resins?.length > 0
          ? (async () => {
              const { data } = await supabase
                .from('resins')
                .select('id, name, manufacturer, image_url, cta_1_url')
                .in('id', content.recommended_resins)
                .eq('active', true);
              return data || [];
            })()
          : Promise.resolve([]),
        // Fetch documentos relacionados às resinas recomendadas
        content.recommended_resins?.length > 0
          ? (async () => {
              const { data } = await supabase
                .from('resin_documents')
                .select(`
                  id,
                  document_name,
                  document_description,
                  file_url,
                  file_size,
                  updated_at,
                  resins!inner(name, manufacturer)
                `)
                .in('resin_id', content.recommended_resins)
                .eq('active', true)
                .limit(5);
              
              return data ? data.map((doc: any) => ({
                ...doc,
                resin_name: doc.resins.name,
                resin_manufacturer: doc.resins.manufacturer
              })) : [];
            })()
          : Promise.resolve([]),
        // Fetch PDFs selecionados de AMBAS as tabelas (resinas + catálogo)
        pdfIds.length > 0
          ? (async () => {
              // Buscar de resin_documents
              const { data: resinDocs } = await supabase
                .from('resin_documents')
                .select(`
                  id,
                  document_name,
                  document_description,
                  file_url,
                  resins!inner(name, manufacturer)
                `)
                .in('id', pdfIds)
                .eq('active', true);
              
              // Buscar de catalog_documents
              const { data: catalogDocs } = await supabase
                .from('catalog_documents')
                .select(`
                  id,
                  document_name,
                  document_description,
                  file_url,
                  system_a_catalog!inner(name)
                `)
                .in('id', pdfIds)
                .eq('active', true);
              
              // Normalizar estrutura de resin_documents
              const resinPdfs = resinDocs?.map((doc: any) => ({
                id: doc.id,
                document_name: doc.document_name,
                document_description: doc.document_description,
                file_url: doc.file_url,
                resin_name: doc.resins.name,
                resin_manufacturer: doc.resins.manufacturer,
                source: 'resin' as const
              })) || [];
              
              // Normalizar estrutura de catalog_documents
              const catalogPdfs = catalogDocs?.map((doc: any) => ({
                id: doc.id,
                document_name: doc.document_name,
                document_description: doc.document_description,
                file_url: doc.file_url,
                resin_name: doc.system_a_catalog.name,
                resin_manufacturer: '',
                source: 'catalog' as const
              })) || [];
              
              // Combinar e ordenar por nome
              return [...resinPdfs, ...catalogPdfs].sort((a, b) => 
                a.document_name.localeCompare(b.document_name)
              );
            })()
          : Promise.resolve([])
      ]);

      setVideos(vids);
      setRelatedArticles(related);
      setCtaResins(resinsData);
      setRelatedDocuments(documentsData);
      setSelectedPdfs(pdfsData);
      setVideosLoading(false);
    };
    
    load();
  }, [content?.id, language, fetchVideosByContent, fetchRelatedContents]);

  if (!content) return null;

  // Select correct language content (prioritize translatedContent from auto-translation)
  const displayContent = {
    ...content,
    title: 
      translatedContent?.title
        ? translatedContent.title
        : language === 'es' && content.title_es 
        ? content.title_es 
        : language === 'en' && content.title_en 
        ? content.title_en 
        : content.title,
    excerpt: 
      translatedContent?.excerpt
        ? translatedContent.excerpt
        : language === 'es' && content.excerpt_es 
        ? content.excerpt_es 
        : language === 'en' && content.excerpt_en 
        ? content.excerpt_en 
        : content.excerpt,
    content_html: 
      translatedContent?.content_html
        ? translatedContent.content_html
        : language === 'es' && content.content_html_es 
        ? content.content_html_es 
        : language === 'en' && content.content_html_en 
        ? content.content_html_en 
        : content.content_html,
    faqs: 
      translatedContent?.faqs
        ? translatedContent.faqs
        : language === 'es' && content.faqs_es 
        ? content.faqs_es 
        : language === 'en' && content.faqs_en 
        ? content.faqs_en 
        : content.faqs
  };

  // Dynamic base path based on current language
  const basePath = language === 'en' 
    ? '/en/knowledge-base' 
    : language === 'es' 
    ? '/es/base-conocimiento' 
    : '/base-conhecimento';

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: t('knowledge.knowledge_base'), href: basePath },
    { 
      label: content.knowledge_categories?.name || t('knowledge.categories'), 
      href: `${basePath}/${content.knowledge_categories?.letter?.toLowerCase() || 'a'}` 
    },
    { label: displayContent.title }
  ];

  const processedHTML = displayContent.content_html 
    ? prettifyLinkLabels(renderAuthorSignaturePlaceholders(displayContent.content_html, content.authors, language as 'pt' | 'en' | 'es'))
    : '';

  return (
    <div className="space-y-6">
      <KnowledgeSEOHead 
        content={content}
        category={content.knowledge_categories}
        videos={videos}
        relatedDocuments={relatedDocuments}
      />
      <VideoSchema videos={videos} productName={displayContent.title} />
      <Breadcrumb items={breadcrumbItems} />

      {/* Translation loading indicator */}
      {translating && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg animate-pulse">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">
            {language === 'en' ? 'Translating content...' : 'Traduciendo contenido...'}
          </span>
        </div>
      )}
      
      {/* Hero Section with Category and Title */}
      {(content.content_image_url || content.og_image_url) && (
        <header className="hero mb-6">
          <div className="hero-image">
            <img 
              src={content.content_image_url || content.og_image_url} 
              alt={content.content_image_alt || content.title}
              loading="eager"
              style={{ aspectRatio: '16/9', objectFit: 'cover' }}
            />
          </div>
          <div className="hero-content">
            {content.knowledge_categories?.name && (
              <span className="eyebrow">{content.knowledge_categories.name}</span>
            )}
            <h1>{displayContent.title}</h1>
            {displayContent.excerpt && (
              <p className="hero-excerpt">
                {displayContent.excerpt.length > 160 
                  ? displayContent.excerpt.substring(0, 160) + '...' 
                  : displayContent.excerpt
                }
              </p>
            )}
            <ArticleMeta 
              createdAt={content.created_at} 
              updatedAt={content.updated_at} 
            />
          </div>
        </header>
      )}

      {/* VeredictBox - Featured Snippet para AI Search (posição zero) */}
      {content.veredict_data && (
        <VeredictBox data={content.veredict_data} />
      )}

      {/* Article Summary (TL;DR) */}
      <ArticleSummary 
        aiContext={content.ai_context}
        aiContextEn={content.ai_context_en}
        aiContextEs={content.ai_context_es}
      />
      
      <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
        {/* PDFs selecionados - sempre no topo */}
        {selectedPdfs.length > 0 && (
          <div className="space-y-4 mb-8">
            {selectedPdfs.map((pdf) => (
              <PDFViewerEmbed
                key={pdf.id}
                url={pdf.file_url}
                title={pdf.document_name}
                subtitle={`${pdf.resin_name} - ${pdf.resin_manufacturer}`}
              />
            ))}
          </div>
        )}

        {/* Videos - com skeleton durante loading */}
        {videosLoading && (
          <div className="space-y-4 mb-6">
            <div className="aspect-video rounded-lg bg-muted animate-pulse" />
          </div>
        )}
        {!videosLoading && videos.length > 0 && (
          <div className="space-y-4 mb-6" style={{ minHeight: '300px' }}>
            {videos.map((video, idx) => (
              <div key={video.id} className="space-y-2">
                {video.title && (
                  <div className="text-sm font-medium text-muted-foreground break-words">
                    📹 {t('knowledge.video')} {idx + 1} — {video.title}
                  </div>
                )}
                
                {/* Language Indicator for PandaVideo */}
                {video.video_type === 'pandavideo' && video.panda_config && (
                  <VideoLanguageIndicator 
                    audios={video.panda_config.audios}
                    subtitles={video.panda_config.subtitles}
                  />
                )}
                
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={getVideoEmbedUrl(video, language)}
                    className="w-full h-full"
                    allowFullScreen
                    title={video.title || `Vídeo ${idx + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA MIDDLE */}
        {content.recommended_resins?.length > 0 && (
          <div className="my-6">
            <KnowledgeCTA 
              recommendedResins={content.recommended_resins}
              articleTitle={content.title}
              position="middle"
              resins={ctaResins}
            />
          </div>
        )}

        {/* Download File */}
        {content.file_url && (
          <div className="mb-6">
            <Button 
              onClick={() => window.open(content.file_url, '_blank')}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('knowledge.download')} {content.file_name || t('knowledge.download_file')}
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Rich Content */}
        {processedHTML && (
          <PDFContentRenderer
            htmlContent={processedHTML}
            deviceMode={isMobile ? "mobile" : "desktop"}
          />
        )}

        {/* FAQ Section - antes da assinatura do autor */}
        {displayContent.faqs && displayContent.faqs.length > 0 && (
          <KnowledgeFAQ faqs={displayContent.faqs} />
        )}

        {/* Author Signature - only show if token not in content */}
        {content.authors && !/\[\[ASSINATURA_AUTOR\]\]/i.test(displayContent.content_html || '') && (
          <AuthorSignature author={content.authors} />
        )}

        {/* Transparency Disclaimer */}
        <div className="mt-8 p-4 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
          {t('knowledge.transparency_disclaimer')}
        </div>
      </div>

      {/* CTA BOTTOM */}
      {content.recommended_resins?.length > 0 && (
        <KnowledgeCTA 
          recommendedResins={content.recommended_resins}
          articleTitle={content.title}
          position="bottom"
          resins={ctaResins}
        />
      )}

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="mt-12 border-t border-border pt-8">
          <h3 className="text-2xl font-bold text-foreground mb-6">📚 {t('knowledge.related_articles')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedArticles.map(article => (
              <Link 
                key={article.id} 
                to={`${basePath}/${article.knowledge_categories?.letter?.toLowerCase()}/${article.slug}`}
              >
                <Card className="hover:shadow-lg transition-shadow h-full">
                  {article.og_image_url && (
                    <img 
                      src={article.og_image_url} 
                      alt={article.title} 
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                  )}
                  <CardContent className="p-4">
                    <h4 className="font-semibold line-clamp-2 mb-2 text-foreground">
                      {getLocalizedTitle(article, language)}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {getLocalizedExcerpt(article, language)}
                    </p>
                    
                    <LanguageFlags size="xs" showBorder />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

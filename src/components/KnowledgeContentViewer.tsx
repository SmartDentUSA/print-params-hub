import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ExternalLink, Globe } from 'lucide-react';
import { useKnowledge, getVideoEmbedUrl } from '@/hooks/useKnowledge';
import { AuthorSignature } from '@/components/AuthorSignature';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { KnowledgeSEOHead } from '@/components/KnowledgeSEOHead';
import { KnowledgeCTA } from '@/components/KnowledgeCTA';
import { VideoSchema } from '@/components/VideoSchema';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { KnowledgeFAQ } from '@/components/KnowledgeFAQ';
import { BlogPreviewFrame } from '@/components/BlogPreviewFrame';
import { useIsMobile } from '@/hooks/use-mobile';
import { LanguageFlags } from '@/components/LanguageFlags';
import { VideoLanguageIndicator } from '@/components/VideoLanguageIndicator';

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
  const { fetchVideosByContent, fetchRelatedContents } = useKnowledge();

  useEffect(() => {
    if (content?.id) {
      const load = async () => {
        // Fetch paralelo: videos + artigos relacionados + resinas CTA + documentos relacionados
        const [vids, related, resinsData, documentsData] = await Promise.all([
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
          // 🆕 Fetch documentos relacionados às resinas recomendadas
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
            : Promise.resolve([])
        ]);

        setVideos(vids);
        setRelatedArticles(related);
        setCtaResins(resinsData);
        setRelatedDocuments(documentsData);
        setVideosLoading(false);
      };
      load();
    }
  }, [content?.id, fetchVideosByContent, fetchRelatedContents]);

  if (!content) return null;

  // Select correct language content
  const displayContent = {
    ...content,
    title: 
      language === 'es' && content.title_es 
        ? content.title_es 
        : language === 'en' && content.title_en 
        ? content.title_en 
        : content.title,
    excerpt: 
      language === 'es' && content.excerpt_es 
        ? content.excerpt_es 
        : language === 'en' && content.excerpt_en 
        ? content.excerpt_en 
        : content.excerpt,
    content_html: 
      language === 'es' && content.content_html_es 
        ? content.content_html_es 
        : language === 'en' && content.content_html_en 
        ? content.content_html_en 
        : content.content_html,
    faqs: 
      language === 'es' && content.faqs_es 
        ? content.faqs_es 
        : language === 'en' && content.faqs_en 
        ? content.faqs_en 
        : content.faqs
  };

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: t('knowledge.knowledge_base'), href: '/base-conhecimento' },
    { 
      label: content.knowledge_categories?.name || t('knowledge.categories'), 
      href: `/base-conhecimento/${content.knowledge_categories?.letter?.toLowerCase() || 'a'}` 
    },
    { label: content.title }
  ];


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
          </div>
        </header>
      )}
      
      <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
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
          {displayContent.content_html && (
            <BlogPreviewFrame
              htmlContent={renderAuthorSignaturePlaceholders(displayContent.content_html, content.authors)}
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
                to={`/base-conhecimento/${article.knowledge_categories?.letter?.toLowerCase()}/${article.slug}`}
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
                      {article.title}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {article.excerpt}
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

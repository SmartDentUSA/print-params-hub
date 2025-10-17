import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ExternalLink } from 'lucide-react';
import { useKnowledge } from '@/hooks/useKnowledge';
import { AuthorSignature } from '@/components/AuthorSignature';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { KnowledgeSEOHead } from '@/components/KnowledgeSEOHead';
import { KnowledgeCTA } from '@/components/KnowledgeCTA';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface KnowledgeContentViewerProps {
  content: any;
}

export function KnowledgeContentViewer({ content }: KnowledgeContentViewerProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [ctaResins, setCtaResins] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const { fetchVideosByContent, fetchRelatedContents } = useKnowledge();

  useEffect(() => {
    if (content?.id) {
      const load = async () => {
        // Fetch paralelo: videos + artigos relacionados + resinas CTA
        const [vids, related, resinsData] = await Promise.all([
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
            : Promise.resolve([])
        ]);

        setVideos(vids);
        setRelatedArticles(related);
        setCtaResins(resinsData);
        setVideosLoading(false);
      };
      load();
    }
  }, [content?.id, fetchVideosByContent, fetchRelatedContents]);

  if (!content) return null;

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Base de Conhecimento', href: '/base-conhecimento' },
    { 
      label: content.knowledge_categories?.name || 'Categoria', 
      href: `/base-conhecimento/${content.knowledge_categories?.letter?.toLowerCase() || 'a'}` 
    },
    { label: content.title }
  ];

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    if (url.includes('youtu.be/')) {
      return url.replace('youtu.be/', 'youtube.com/embed/');
    }
    return url;
  };

  return (
    <div className="space-y-6">
      <KnowledgeSEOHead 
        content={content}
        category={content.knowledge_categories}
        videos={videos}
      />
      <Breadcrumb items={breadcrumbItems} />
      
      <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4 break-words">
          {content.title}
        </h2>

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
                    📹 Vídeo {idx + 1} — {video.title}
                  </div>
                )}
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={getEmbedUrl(video.url)}
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
              Baixar {content.file_name || 'Arquivo'}
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Rich Content */}
        {content.content_html && (
          <div 
            className="prose prose-sm sm:prose-base max-w-none break-words prose-headings:break-words prose-p:break-words prose-li:break-words"
            dangerouslySetInnerHTML={{ 
              __html: renderAuthorSignaturePlaceholders(content.content_html, content.authors)
            }}
          />
        )}

        {/* Author Signature - only show if token not in content */}
        {content.authors && !/\[\[ASSINATURA_AUTOR\]\]/i.test(content.content_html || '') && (
          <AuthorSignature author={content.authors} />
        )}

        {/* Transparency Disclaimer */}
        <div className="mt-8 p-4 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
          <strong className="text-foreground">Transparência:</strong> Este artigo foi escrito com base em testes práticos realizados pelo autor. Smart Dent apenas fornece materiais necessários para desenvolvimento do conteúdo, mas isso não afeta nossas recomendações.
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
          <h3 className="text-2xl font-bold text-foreground mb-6">📚 Artigos Relacionados</h3>
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
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {article.excerpt}
                    </p>
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

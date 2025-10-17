import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { useKnowledge } from '@/hooks/useKnowledge';
import { AuthorSignature } from '@/components/AuthorSignature';
import { AUTHOR_SIGNATURE_TOKEN, renderAuthorSignaturePlaceholders } from '@/utils/authorSignatureToken';
import { KnowledgeSEOHead } from '@/components/KnowledgeSEOHead';

interface KnowledgeContentViewerProps {
  content: any;
}

export function KnowledgeContentViewer({ content }: KnowledgeContentViewerProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const { fetchVideosByContent } = useKnowledge();

  useEffect(() => {
    if (content?.id) {
      const load = async () => {
        console.log('🎬 Carregando vídeos para:', content.id);
        const vids = await fetchVideosByContent(content.id);
        console.log('✅ Vídeos carregados:', vids.length, vids);
        setVideos(vids);
      };
      load();
    }
  }, [content?.id, fetchVideosByContent]);

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
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {content.title}
        </h2>

        {/* Videos */}
        {videos.length > 0 && (
          <div className="space-y-4 mb-6">
            {videos.map((video, idx) => (
              <div key={video.id} className="space-y-2">
                {video.title && (
                  <div className="text-sm font-medium text-muted-foreground">
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
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: renderAuthorSignaturePlaceholders(content.content_html, content.authors)
            }}
          />
        )}

        {/* Author Signature - only show if token not in content */}
        {content.authors && !/\[\[ASSINATURA_AUTOR\]\]/i.test(content.content_html || '') && (
          <AuthorSignature author={content.authors} />
        )}
      </div>
    </div>
  );
}

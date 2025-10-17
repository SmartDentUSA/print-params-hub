import { useEffect, useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { useKnowledge } from '@/hooks/useKnowledge';
import { AuthorSignature } from '@/components/AuthorSignature';

interface KnowledgeContentViewerProps {
  content: any;
}

export function KnowledgeContentViewer({ content }: KnowledgeContentViewerProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const { fetchVideosByContent } = useKnowledge();

  useEffect(() => {
    if (content?.id) {
      const load = async () => {
        const vids = await fetchVideosByContent(content.id);
        setVideos(vids);
      };
      load();
    }
  }, [content]);

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
      <Breadcrumb items={breadcrumbItems} />
      
      <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {content.title}
        </h2>

        {/* Videos Tabs */}
        {videos.length > 0 && (
          <div className="mb-6">
            <Tabs defaultValue={videos[0].id} className="w-full">
              <TabsList>
                {videos.map((video, idx) => (
                  <TabsTrigger key={video.id} value={video.id}>
                    📹 {video.title || `Vídeo ${idx + 1}`}
                  </TabsTrigger>
                ))}
              </TabsList>
              {videos.map((video) => (
                <TabsContent key={video.id} value={video.id}>
                  <div className="aspect-video rounded-lg overflow-hidden border border-border mt-4">
                    <iframe 
                      src={getEmbedUrl(video.url)}
                      className="w-full h-full"
                      allowFullScreen
                      title={video.title}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
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
            dangerouslySetInnerHTML={{ __html: content.content_html }}
          />
        )}

        {/* Author Signature */}
        {content.authors && (
          <AuthorSignature author={content.authors} />
        )}
      </div>
    </div>
  );
}

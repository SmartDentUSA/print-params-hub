import { KnowledgeVideo } from '@/hooks/useKnowledge';

interface VideoSchemaProps {
  videos: KnowledgeVideo[];
  productName?: string;
}

export const VideoSchema = ({ videos, productName }: VideoSchemaProps) => {
  if (!videos || videos.length === 0) return null;

  const schemas = videos
    .filter(v => v.video_type === 'pandavideo')
    .map((video) => ({
      "@type": "VideoObject",
      "name": video.title,
      "description": video.description || productName,
      "thumbnailUrl": video.thumbnail_url,
      "uploadDate": video.created_at,
      "duration": video.video_duration_seconds ? `PT${video.video_duration_seconds}S` : undefined,
      "contentUrl": video.embed_url,
      "embedUrl": video.embed_url,
    }));

  if (schemas.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemas.length === 1 ? schemas[0] : schemas)
      }}
    />
  );
};

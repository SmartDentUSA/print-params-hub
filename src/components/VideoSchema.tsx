import { KnowledgeVideo } from '@/hooks/useKnowledge';

interface VideoSchemaProps {
  videos: KnowledgeVideo[];
  productName?: string;
  currentLang?: 'pt' | 'en' | 'es';
}

export const VideoSchema = ({ videos, productName, currentLang = 'pt' }: VideoSchemaProps) => {
  if (!videos || videos.length === 0) return null;

  const langMap = {
    'pt': 'pt-BR',
    'en': 'en-US',
    'es': 'es-ES'
  };

  const schemas = videos
    .filter(v => v.video_type === 'pandavideo')
    .map((video) => {
      const audioLanguages = video.panda_config?.audios?.map((aud: any) => aud.srclang).filter(Boolean) || [];
      const captions = video.panda_config?.subtitles?.map((sub: any) => ({
        "@type": "AudioObject",
        "inLanguage": sub.srclang,
        "name": sub.label,
        "encodingFormat": "text/vtt",
        "contentUrl": sub.src
      })) || [];

      return {
        "@type": "VideoObject",
        "name": video.title,
        "description": video.description || productName,
        "thumbnailUrl": video.thumbnail_url,
        "uploadDate": video.created_at,
        "duration": video.video_duration_seconds ? `PT${video.video_duration_seconds}S` : undefined,
        "contentUrl": video.embed_url,
        "embedUrl": video.embed_url,
        "inLanguage": langMap[currentLang],
        ...(audioLanguages.length > 0 && { "audioLanguage": audioLanguages }),
        "transcript": video.video_transcript || undefined,
        ...(captions.length > 0 && { "caption": captions })
      };
    });

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

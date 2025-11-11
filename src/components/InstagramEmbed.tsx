import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface InstagramEmbedProps {
  url: string;
}

export const InstagramEmbed = ({ url }: InstagramEmbedProps) => {
  useEffect(() => {
    // Carregar script do Instagram se ainda não estiver carregado
    if (!(window as any).instgrm) {
      const script = document.createElement('script');
      script.src = '//www.instagram.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    } else {
      // Se já está carregado, processar embeds
      (window as any).instgrm.Embeds.process();
    }
  }, [url]);

  return (
    <Card className="mb-8">
      <CardContent className="p-4 md:p-6 flex justify-center">
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          style={{
            maxWidth: '540px',
            minWidth: '326px',
            width: '100%',
            background: '#FFF',
            border: 0,
            borderRadius: '3px',
            boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
            margin: '1px',
            padding: 0,
          }}
        >
          <div style={{ padding: '16px' }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#FFFFFF',
                lineHeight: 0,
                padding: '0 0',
                textAlign: 'center',
                textDecoration: 'none',
                width: '100%',
              }}
            >
              Ver esta publicação no Instagram
            </a>
          </div>
        </blockquote>
      </CardContent>
    </Card>
  );
};

import React, { useRef, useEffect } from 'react';

interface BlogPreviewFrameProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export const BlogPreviewFrame: React.FC<BlogPreviewFrameProps> = ({ 
  htmlContent, 
  deviceMode = 'desktop' 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const widths = {
    mobile: '375px',
    tablet: '768px',
    desktop: '100%'
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const adjustHeight = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframeDoc.body) {
          const height = iframeDoc.body.scrollHeight;
          iframe.style.height = `${height + 20}px`;
        }
      } catch (e) {
        console.error('Error adjusting iframe height:', e);
      }
    };

    iframe.addEventListener('load', adjustHeight);
    
    // Ajustar altura após um delay para garantir que o conteúdo foi renderizado
    const timer = setTimeout(adjustHeight, 100);

    return () => {
      iframe.removeEventListener('load', adjustHeight);
      clearTimeout(timer);
    };
  }, [htmlContent]);

  return (
    <div className="preview-container" style={{ width: '100%', minHeight: '200px' }}>
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        style={{
          width: widths[deviceMode],
          minHeight: '200px',
          border: 'none',
          margin: '0 auto',
          display: 'block',
          background: 'white'
        }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
        title="Blog Preview"
      />
    </div>
  );
};

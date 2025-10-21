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

  const fullDocument = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: system-ui, -apple-system, sans-serif;
            padding: 20px;
            line-height: 1.6;
            color: #333;
            overflow-x: hidden;
          }
          /* GARANTIR QUE IMAGENS NUNCA EXTRAPOLEM */
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px 0;
          }
          /* Links funcionais */
          a {
            color: #0066cc;
            text-decoration: underline;
          }
          a:hover {
            color: #0052a3;
          }
          /* Espaçamento de headings */
          h1, h2, h3, h4, h5, h6 { 
            margin: 20px 0 10px 0;
            line-height: 1.3;
          }
          h1 { font-size: 2em; }
          h2 { font-size: 1.5em; }
          h3 { font-size: 1.17em; }
          /* Parágrafos */
          p { margin-bottom: 15px; }
          /* Listas */
          ul, ol {
            margin: 15px 0;
            padding-left: 30px;
          }
          li {
            margin-bottom: 8px;
          }
          /* Blockquotes */
          blockquote { 
            border-left: 4px solid #ddd; 
            padding-left: 15px; 
            margin: 15px 0;
            color: #666;
            font-style: italic;
          }
          /* Tabelas */
          table {
            width: 100%;
            max-width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  return (
    <div className="preview-container" style={{ width: '100%', minHeight: '200px' }}>
      <iframe
        ref={iframeRef}
        srcDoc={fullDocument}
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

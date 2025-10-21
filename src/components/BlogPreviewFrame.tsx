import React from 'react';

interface BlogPreviewFrameProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export const BlogPreviewFrame: React.FC<BlogPreviewFrameProps> = ({ 
  htmlContent, 
  deviceMode = 'desktop' 
}) => {
  const widths = {
    mobile: '375px',
    tablet: '768px',
    desktop: '100%'
  };

  return (
    <div className="preview-container" style={{ width: '100%', height: '100%' }}>
      <iframe
        srcDoc={htmlContent}
        style={{
          width: widths[deviceMode],
          height: '100%',
          border: 'none',
          margin: '0 auto',
          display: 'block',
          background: 'white'
        }}
        sandbox="allow-same-origin allow-scripts"
        title="Blog Preview"
      />
    </div>
  );
};

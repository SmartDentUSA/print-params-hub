import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

declare global {
  interface Window {
    ElfsightWidget?: {
      process: () => void;
    };
    refreshElfsight?: () => void;
  }
}

interface GoogleReviewsWidgetProps {
  widgetId?: string;
}

export const GoogleReviewsWidget = ({ 
  widgetId = "9712ee98-7bd4-4bcb-a3fb-750091c97b0a" 
}: GoogleReviewsWidgetProps) => {
  const [timestamp] = useState(Date.now());

  useEffect(() => {
    const existingScript = document.querySelector('script[src*="elfsightcdn.com"]');
    
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://elfsightcdn.com/platform.js';
      script.async = true;
      script.onload = () => {
        if (window.ElfsightWidget) {
          window.ElfsightWidget.process();
        }
      };
      document.body.appendChild(script);
    } else {
      // Script já existe, forçar reprocessamento
      if (window.ElfsightWidget) {
        window.ElfsightWidget.process();
      }
    }

    // Expor função global para debug/refresh manual
    window.refreshElfsight = () => {
      if (window.ElfsightWidget) {
        window.ElfsightWidget.process();
        console.log('✅ Elfsight widgets reprocessados');
      }
    };
  }, [widgetId]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">O que nossos clientes dizem</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          key={`elfsight-${widgetId}-${timestamp}`}
          className={`elfsight-app-${widgetId}`} 
          data-elfsight-app-lazy
        />
      </CardContent>
    </Card>
  );
};

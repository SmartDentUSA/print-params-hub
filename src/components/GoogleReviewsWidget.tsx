import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GoogleReviewsWidgetProps {
  widgetId?: string;
}

export const GoogleReviewsWidget = ({ 
  widgetId = "9712ee98-7bd4-4bcb-a3fb-750091c97b0a" 
}: GoogleReviewsWidgetProps) => {
  useEffect(() => {
    // Carregar script do Elfsight se ainda não existir
    if (!document.querySelector('script[src*="elfsightcdn.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://elfsightcdn.com/platform.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>O que nossos clientes dizem</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className={`elfsight-app-${widgetId}`} 
          data-elfsight-app-lazy
        />
      </CardContent>
    </Card>
  );
};

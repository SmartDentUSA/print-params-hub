import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface KnowledgeCTAProps {
  recommendedResins: string[];
  articleTitle: string;
  position: 'top' | 'middle' | 'bottom';
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  image_url?: string;
}

export function KnowledgeCTA({ recommendedResins, articleTitle, position }: KnowledgeCTAProps) {
  const [resins, setResins] = useState<Resin[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!recommendedResins || recommendedResins.length === 0) {
      setLoading(false);
      return;
    }

    const fetchResins = async () => {
      const { data } = await supabase
        .from('resins')
        .select('id, name, manufacturer, image_url')
        .in('id', recommendedResins)
        .eq('active', true);

      if (data) {
        setResins(data);
        
        // Track CTA view
        if (typeof (window as any).gtag === 'function') {
          (window as any).gtag('event', 'cta_view', {
            event_category: 'conversion',
            event_label: articleTitle,
            position: position,
            resins_count: data.length
          });
        }
      }
      setLoading(false);
    };

    fetchResins();
  }, [recommendedResins, articleTitle, position]);

  const handleClick = () => {
    // Track CTA click
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'cta_click', {
        event_category: 'conversion',
        event_label: articleTitle,
        position: position,
        resins_count: resins.length
      });
    }

    // Navigate with pre-selected resins
    const resinIds = resins.map(r => r.id).join(',');
    navigate(`/?resins=${resinIds}`);
  };

  if (loading || resins.length === 0) return null;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h3 className="text-lg font-semibold text-foreground">
              🎯 Resinas mencionadas neste artigo
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {resins.map(resin => (
              <div 
                key={resin.id}
                className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg"
              >
                <span className="text-primary">💧</span>
                <span className="text-sm font-medium text-foreground">
                  {resin.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({resin.manufacturer})
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <span>✓</span>
            <span>Veja parâmetros completos para sua impressora</span>
          </div>

          <Button 
            onClick={handleClick}
            className="w-full sm:w-auto group"
            size="lg"
          >
            Ver Parâmetros Dessas Resinas
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

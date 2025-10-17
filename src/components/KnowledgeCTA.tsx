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
  resins?: Resin[]; // Pre-fetched resins para evitar 3 requests
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  image_url?: string;
  cta_1_url?: string;
}

export function KnowledgeCTA({ recommendedResins, articleTitle, position, resins: preFetchedResins }: KnowledgeCTAProps) {
  const [resins, setResins] = useState<Resin[]>(preFetchedResins || []);
  const [loading, setLoading] = useState(!preFetchedResins);
  const navigate = useNavigate();

  useEffect(() => {
    // Se já temos resinas pré-carregadas, não fazer fetch
    if (preFetchedResins && preFetchedResins.length > 0) {
      // Track CTA view apenas
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'cta_view', {
          event_category: 'conversion',
          event_label: articleTitle,
          position: position,
          resins_count: preFetchedResins.length
        });
      }
      return;
    }

    if (!recommendedResins || recommendedResins.length === 0) {
      setLoading(false);
      return;
    }

    const fetchResins = async () => {
      const { data } = await supabase
        .from('resins')
        .select('id, name, manufacturer, image_url, cta_1_url')
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
  }, [recommendedResins, articleTitle, position, preFetchedResins]);

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

    // Redirecionar para cta_1_url
    if (resins.length === 1 && resins[0].cta_1_url) {
      // Uma resina com CTA1 → redirect direto
      window.open(resins[0].cta_1_url, '_blank', 'noopener,noreferrer');
    } else if (resins.length > 1) {
      // Múltiplas resinas → pegar primeira com cta_1_url
      const firstResinWithCta = resins.find(r => r.cta_1_url);
      if (firstResinWithCta?.cta_1_url) {
        window.open(firstResinWithCta.cta_1_url, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback: se nenhuma tem CTA1, usar comportamento antigo
        const resinIds = resins.map(r => r.id).join(',');
        navigate(`/?resins=${resinIds}`);
      }
    } else {
      // Fallback: sem cta_1_url, usar filtro
      const resinIds = resins.map(r => r.id).join(',');
      navigate(`/?resins=${resinIds}`);
    }
  };

  // Skeleton durante loading
  if (loading) {
    return (
      <Card className="border-l-4 border-primary bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
              <div className="h-4 w-48 bg-muted-foreground/20 rounded" />
            </div>
            <div className="h-8 w-32 bg-muted-foreground/20 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (resins.length === 0) return null;

  return (
    <Card className="border-l-4 border-primary bg-muted/30">
      <CardContent className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Título + Resinas inline */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              🎯 Resinas:
            </span>
            <span className="text-sm text-foreground line-clamp-2">
              {resins.map(r => `${r.name} (${r.manufacturer})`).join(' • ')}
            </span>
          </div>
          
          {/* Botão compacto */}
          <Button 
            onClick={handleClick}
            size="sm"
            variant="default"
            className="shrink-0"
          >
            SAIBA MAIS
            <ArrowRight className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

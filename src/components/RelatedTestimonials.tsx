import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Youtube, Instagram, Play } from 'lucide-react';
import { getVideoThumbnail } from '@/utils/videoThumbnails';

interface Testimonial {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  extra_data: any;
}

interface RelatedTestimonialsProps {
  currentTestimonialId: string;
  limit?: number;
}

export const RelatedTestimonials = ({ 
  currentTestimonialId, 
  limit = 4 
}: RelatedTestimonialsProps) => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelatedTestimonials();
  }, [currentTestimonialId]);

  const fetchRelatedTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('system_a_catalog')
        .select('id, name, slug, description, extra_data')
        .eq('category', 'video_testimonial')
        .eq('active', true)
        .eq('approved', true)
        .neq('id', currentTestimonialId)
        .limit(limit);

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error('Erro ao carregar depoimentos relacionados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformBadge = (testimonial: Testimonial) => {
    const hasYoutube = !!testimonial.extra_data?.youtube_url;
    const hasInstagram = !!testimonial.extra_data?.instagram_url;

    if (hasYoutube && hasInstagram) {
      return (
        <div className="flex gap-1 absolute top-2 right-2">
          <Badge variant="destructive" className="flex items-center gap-1">
            <Youtube className="w-3 h-3" />
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Instagram className="w-3 h-3" />
          </Badge>
        </div>
      );
    }

    if (hasYoutube) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 absolute top-2 right-2">
          <Youtube className="w-3 h-3" />
        </Badge>
      );
    }

    if (hasInstagram) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 absolute top-2 right-2">
          <Instagram className="w-3 h-3" />
        </Badge>
      );
    }

    return null;
  };

  if (loading || testimonials.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Outros Depoimentos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testimonials.map((testimonial) => (
          <Link
            key={testimonial.id}
            to={`/depoimentos/${testimonial.slug}`}
            className="group relative block overflow-hidden rounded-lg border border-border hover:border-primary transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gradient-to-br from-blue-500 to-purple-600">
              <img
                src={getVideoThumbnail(testimonial.extra_data?.youtube_url)}
                alt={testimonial.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Badge de plataforma */}
              {getPlatformBadge(testimonial)}

              {/* Overlay no hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300" />
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-4">
              <h3 className="font-semibold mb-2 line-clamp-1">
                {testimonial.name}
              </h3>
              {testimonial.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {testimonial.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

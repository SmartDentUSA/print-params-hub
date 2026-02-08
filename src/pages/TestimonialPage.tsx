import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TestimonialSEOHead } from "@/components/TestimonialSEOHead";
import { GoogleReviewsWidget } from "@/components/GoogleReviewsWidget";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import { RelatedTestimonials } from "@/components/RelatedTestimonials";
import { MentionedProducts } from "@/components/MentionedProducts";
import { useLanguage } from "@/contexts/LanguageContext";

interface TestimonialData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  seo_title_override: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  extra_data: any;
}

const TestimonialPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [testimonial, setTestimonial] = useState<TestimonialData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchTestimonial = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from("system_a_catalog")
          .select("*")
          .eq("category", "video_testimonial")
          .eq("slug", slug)
          .eq("active", true)
          .eq("approved", true)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          toast.error(t('testimonial.not_found'));
          navigate("/");
          return;
        }

        setTestimonial(data);
      } catch (error) {
        console.error("Error fetching testimonial:", error);
        toast.error(t('testimonial.load_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonial();
  }, [slug, navigate, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!testimonial) return null;

  const extraData = testimonial.extra_data || {};
  const youtubeUrl = extraData.youtube_url;
  const instagramUrl = extraData.instagram_url;
  const location = extraData.location;
  const specialty = extraData.specialty;
  const profession = extraData.profession;

  return (
    <>
      <TestimonialSEOHead testimonial={testimonial} />

      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">{testimonial.name}</h1>
          
          {(profession || specialty || location) && (
            <div className="text-lg text-muted-foreground mb-6">
              {profession && <div>{profession}</div>}
              {specialty && <div>{specialty}</div>}
              {location && <div>{location}</div>}
            </div>
          )}

          {testimonial.description && (
            <p className="text-lg mb-8">{testimonial.description}</p>
          )}

          {youtubeUrl && (
            <Card className="mb-8">
              <CardContent className="p-0">
                <div className="aspect-video">
                  <iframe
                    width="100%"
                    height="100%"
                    src={youtubeUrl.replace("watch?v=", "embed/")}
                    title={testimonial.name}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {extraData.video_transcript && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4">{t('testimonial.transcription')}</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                    {extraData.video_transcript}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {instagramUrl && (
            <InstagramEmbed url={instagramUrl} />
          )}

          <MentionedProducts 
            productSlugs={['asiga-cure-pos-cura-uv-365385405-nm', 'pionext-uv-02-pos-cura-uv-365385405-nm']}
            resinSlugs={['resina-smart-print-bio-denture-translucida', 'resina-3d-smart-print-modelo-precision']}
          />

          <RelatedTestimonials currentTestimonialId={testimonial.id} limit={4} />
          <GoogleReviewsWidget />
        </main>
      </div>
    </>
  );
};

export default TestimonialPage;

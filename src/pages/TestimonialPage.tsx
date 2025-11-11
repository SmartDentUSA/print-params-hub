import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TestimonialSEOHead } from "@/components/TestimonialSEOHead";

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
          toast.error("Depoimento não encontrado");
          navigate("/");
          return;
        }

        setTestimonial(data);
      } catch (error) {
        console.error("Error fetching testimonial:", error);
        toast.error("Erro ao carregar depoimento");
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonial();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!testimonial) return null;

  const seoTitle = testimonial.seo_title_override || `${testimonial.name} | Smart Dent`;
  const metaDescription = testimonial.meta_description || testimonial.description || "";
  const ogImage = testimonial.og_image_url || testimonial.image_url || "/og-image.jpg";
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
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
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
                <h2 className="text-2xl font-bold mb-4">Transcrição do Depoimento</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                    {extraData.video_transcript}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-4">Produtos Mencionados</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a 
                  href="/produtos/scanner-blz-ino200" 
                  className="p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold mb-2">Scanner intraoral BLZ INO200</h3>
                  <p className="text-sm text-muted-foreground">
                    Scanner de alta precisão para captura digital
                  </p>
                </a>
                
                <a 
                  href="/resinas/bio-vitality" 
                  className="p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold mb-2">Resina Smart Dent Bio Vitality</h3>
                  <p className="text-sm text-muted-foreground">
                    Resina biocompatível para guias cirúrgicos
                  </p>
                </a>
                
                <a 
                  href="/impressoras/rayshape-edge-mini" 
                  className="p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold mb-2">Impressora RayShape Edge mini</h3>
                  <p className="text-sm text-muted-foreground">
                    Impressora 3D de alta resolução
                  </p>
                </a>
                
                <a 
                  href="/resinas/bite-splint-flex" 
                  className="p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold mb-2">Resina Bite Splint +Flex</h3>
                  <p className="text-sm text-muted-foreground">
                    Resina flexível para placas oclusais
                  </p>
                </a>
              </div>
            </CardContent>
          </Card>

          {instagramUrl && (
            <div className="text-center">
              <Button asChild>
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  Ver no Instagram
                </a>
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default TestimonialPage;

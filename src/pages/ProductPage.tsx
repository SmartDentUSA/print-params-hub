import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeFAQ } from "@/components/KnowledgeFAQ";

interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  promo_price: number | null;
  currency: string;
  seo_title_override: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  keywords: string[] | null;
  cta_1_label: string | null;
  cta_1_url: string | null;
  cta_1_description: string | null;
  cta_2_label: string | null;
  cta_2_url: string | null;
  cta_3_label: string | null;
  cta_3_url: string | null;
  extra_data: any;
}

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from("system_a_catalog")
          .select(`
            *,
            documents:resin_documents(
              id,
              document_name,
              document_description,
              file_url,
              file_name,
              file_size,
              updated_at
            )
          `)
          .eq("category", "product")
          .eq("slug", slug)
          .eq("active", true)
          .eq("approved", true)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          toast.error("Produto não encontrado");
          navigate("/");
          return;
        }

        setProduct(data);
      } catch (error) {
        console.error("Error fetching product:", error);
        toast.error("Erro ao carregar produto");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!product) return null;

  const seoTitle = product.seo_title_override || `${product.name} | Smart Dent`;
  const metaDescription = product.meta_description || product.description || "";
  const ogImage = product.og_image_url || product.image_url || "/og-image.jpg";
  const extraData = product.extra_data || {};
  const variations = extraData.variations || [];
  const benefits = extraData.benefits || [];
  const features = extraData.features || [];
  const faqs = extraData.faqs || [];

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={metaDescription} />
        {product.keywords && product.keywords.length > 0 && (
          <meta name="keywords" content={product.keywords.join(", ")} />
        )}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="product" />

        {/* 🆕 FAQ Schema para Rich Snippets */}
        {faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map((faq: any) => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            })}
          </script>
        )}

        {/* Meta tag ai:context para IA generativa */}
        <meta name="ai:context" content={`${product.name}, produto odontológico, ${product.description || ''}, ${product.keywords?.join(', ') || ''}`} />

        {/* 🆕 Schema JSON-LD para Documentos Técnicos */}
        {(product as any).documents && (product as any).documents.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": `Documentos Técnicos - ${product.name}`,
              "numberOfItems": (product as any).documents.length,
              "itemListElement": (product as any).documents.map((doc: any, idx: number) => ({
                "@type": "DigitalDocument",
                "position": idx + 1,
                "name": doc.document_name,
                "description": doc.document_description || `Documento técnico: ${doc.document_name}`,
                "encodingFormat": "application/pdf",
                "contentUrl": doc.file_url,
                "dateModified": new Date(doc.updated_at).toISOString(),
                "fileSize": doc.file_size ? `${doc.file_size} bytes` : undefined,
                "inLanguage": "pt-BR",
                "about": {
                  "@type": "Product",
                  "name": product.name,
                  "manufacturer": {
                    "@type": "Organization",
                    "name": product.name.split(' ')[0]
                  }
                }
              }))
            })}
          </script>
        )}
      </Helmet>

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

        <main className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full rounded-lg shadow-lg"
                />
              )}
            </div>
            
            <div>
              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
              {product.description && (
                <p className="text-lg text-muted-foreground mb-6">
                  {product.description}
                </p>
              )}

              {(product.price || product.promo_price) && (
                <div className="mb-6">
                  {product.promo_price && (
                    <div className="text-3xl font-bold text-primary mb-2">
                      R$ {product.promo_price.toFixed(2)}
                    </div>
                  )}
                  {product.price && (
                    <div className={product.promo_price ? "text-xl line-through text-muted-foreground" : "text-3xl font-bold"}>
                      R$ {product.price.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {product.cta_1_url && (
                  <Button asChild size="lg" className="w-full">
                    <a href={product.cta_1_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {product.cta_1_label || "Ver na Loja"}
                    </a>
                  </Button>
                )}
                {product.cta_2_url && (
                  <Button asChild variant="outline" size="lg" className="w-full">
                    <a href={product.cta_2_url} target="_blank" rel="noopener noreferrer">
                      {product.cta_2_label || "Saiba Mais"}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {benefits.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Benefícios</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {benefits.map((benefit: string, index: number) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {features.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Características</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {features.map((feature: string, index: number) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {variations.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Opções Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {variations.map((variation: any, index: number) => (
                    <div key={index} className="border-b pb-4 last:border-0">
                      <h3 className="font-semibold">{variation.name}</h3>
                      {variation.price && (
                        <p className="text-lg font-bold text-primary">
                          R$ {variation.price}
                        </p>
                      )}
                      {variation.description && (
                        <p className="text-sm text-muted-foreground">
                          {variation.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {faqs.length > 0 && <KnowledgeFAQ faqs={faqs} />}
        </main>
      </div>
    </>
  );
};

export default ProductPage;

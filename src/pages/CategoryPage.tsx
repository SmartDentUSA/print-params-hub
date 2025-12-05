import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title_override: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  extra_data: any;
}

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategory = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from("system_a_catalog")
          .select("*")
          .eq("category", "category_config")
          .eq("slug", slug)
          .eq("active", true)
          .eq("approved", true)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          toast.error("Categoria não encontrada");
          navigate("/");
          return;
        }

        setCategory(data);
      } catch (error) {
        console.error("Error fetching category:", error);
        toast.error("Erro ao carregar categoria");
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!category) return null;

  const seoTitle = category.seo_title_override || `${category.name} | Smart Dent`;
  const metaDescription = category.meta_description || category.description || "";
  const ogImage = category.og_image_url || "/og-image.jpg";
  const extraData = category.extra_data || {};

  const baseUrl = "https://parametros.smartdent.com.br";
  const canonicalUrl = `${baseUrl}/categorias/${slug}`;
  const keywords = [
    category.name,
    extraData.category,
    extraData.subcategory,
    "Smart Dent",
    "impressão 3D odontológica"
  ].filter(Boolean).join(", ");

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Categorias",
        "item": `${baseUrl}/categorias`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": category.name,
        "item": canonicalUrl
      }
    ]
  };

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{seoTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
        <meta name="author" content="Smart Dent" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* AI Meta Tags */}
        <meta name="ai-content-type" content="categorypage" />
        <meta name="ai-topic" content={keywords} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="PrinterParams Smart Dent" />
        <meta property="og:locale" content="pt_BR" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
        
        {/* Schema.org JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
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

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6">{category.name}</h1>
          
          {category.description && (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <p className="text-lg">{category.description}</p>
              </CardContent>
            </Card>
          )}

          {extraData.category && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-2">Categoria Principal</h2>
                <p>{extraData.category}</p>
              </CardContent>
            </Card>
          )}

          {extraData.subcategory && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-2">Subcategoria</h2>
                <p>{extraData.subcategory}</p>
              </CardContent>
            </Card>
          )}

          {extraData.target_audience && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-2">Público-Alvo</h2>
                <p>{extraData.target_audience}</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
};

export default CategoryPage;

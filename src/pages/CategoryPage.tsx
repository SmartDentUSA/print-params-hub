import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCompanyData } from "@/hooks/useCompanyData";
import { useLanguage } from "@/contexts/LanguageContext";
import { getOgLocale } from "@/utils/i18nPaths";

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

interface CategoryProduct {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
}

const extractProductSlug = (raw: string | null): string | null => {
  if (!raw) return null;
  if (raw.includes('http')) {
    try {
      return new URL(raw).pathname.split('/').pop() || raw;
    } catch {
      return raw;
    }
  }
  return raw;
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: companyData } = useCompanyData();
  const { t, language } = useLanguage();

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
          toast.error(t('category.not_found'));
          navigate("/");
          return;
        }

        setCategory(data);
      } catch (error) {
        console.error("Error fetching category:", error);
        toast.error(t('category.load_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [slug, navigate, t]);

  useEffect(() => {
    const productCategory = category?.extra_data?.category || category?.name;
    if (!productCategory) return;

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("system_a_catalog")
        .select("id, name, slug, image_url")
        .eq("category", "product")
        .eq("active", true)
        .eq("approved", true)
        .eq("visible_in_ui", true)
        .eq("product_category", productCategory)
        .order("name")
        .limit(50);

      if (error) {
        console.error("Error fetching category products:", error);
        return;
      }
      setProducts(data || []);
    };

    fetchProducts();
  }, [category]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!category) return null;

  const companyName = companyData?.name || "Smart Dent";
  const seoTitle = category.seo_title_override || `${category.name} | ${companyName}`;
  const metaDescription = category.meta_description || category.description || "";
  const ogImage = category.og_image_url || "/og-image.jpg";
  const extraData = category.extra_data || {};

  const baseUrl = "https://parametros.smartdent.com.br";
  const canonicalUrl = `${baseUrl}/categorias/${slug}`;
  const keywords = [category.name, extraData.category, extraData.subcategory, companyName].filter(Boolean).join(", ");

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": t('category.main_category'), "item": `${baseUrl}/categorias` },
      { "@type": "ListItem", "position": 3, "name": category.name, "item": canonicalUrl }
    ]
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": seoTitle,
    "description": metaDescription,
    "url": canonicalUrl,
    "isPartOf": { "@type": "WebSite", "name": "Smart Dent", "url": baseUrl },
  };

  // ItemList só é emitido quando há produtos reais listados na página —
  // schema.org e as diretrizes do Google esperam que refita o que é visível.
  const itemListSchema = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": category.name,
    "numberOfItems": products.length,
    "itemListElement": products.map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": p.name,
      "url": `${baseUrl}/produtos/${extractProductSlug(p.slug)}`,
    })),
  } : null;

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
        <meta name="author" content={companyName} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="ai-content-type" content="categorypage" />
        <meta name="ai-topic" content={keywords} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="Smart Dent | Fluxo Digital" />
        <meta property="og:locale" content={getOgLocale(language)} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(collectionPageSchema)}</script>
        {itemListSchema && (
          <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
        )}
      </Helmet>

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
                <h2 className="font-semibold mb-2">{t('category.main_category')}</h2>
                <p>{extraData.category}</p>
              </CardContent>
            </Card>
          )}

          {extraData.subcategory && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-2">{t('category.subcategory')}</h2>
                <p>{extraData.subcategory}</p>
              </CardContent>
            </Card>
          )}

          {extraData.target_audience && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-2">{t('category.target_audience')}</h2>
                <p>{extraData.target_audience}</p>
              </CardContent>
            </Card>
          )}

          {products.length > 0 && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-4">{category.name}</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products.map((p) => (
                    <li key={p.id}>
                      <a
                        href={`/produtos/${extractProductSlug(p.slug)}`}
                        className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
                      >
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover" loading="lazy" />
                        )}
                        <span>{p.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
};

export default CategoryPage;

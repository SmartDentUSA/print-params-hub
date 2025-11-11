import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

interface Product {
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  shop_url: string;
}

interface MentionedProductsProps {
  productSlugs?: string[];
  resinSlugs?: string[];
}

export const MentionedProducts = ({ 
  productSlugs = [], 
  resinSlugs = [] 
}: MentionedProductsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [productSlugs, resinSlugs]);

  const fetchProducts = async () => {
    try {
      const productsData: Product[] = [];

      // Buscar produtos do catálogo
      if (productSlugs.length > 0) {
        const { data: catalogProducts } = await supabase
          .from("system_a_catalog")
          .select("name, slug, description, image_url, cta_1_url")
          .in("slug", productSlugs)
          .eq("active", true)
          .eq("approved", true);

        catalogProducts?.forEach((p) => {
          if (p.cta_1_url) {
            productsData.push({
              name: p.name,
              slug: p.slug,
              description: p.description,
              image_url: p.image_url,
              shop_url: p.cta_1_url,
            });
          }
        });
      }

      // Buscar resinas
      if (resinSlugs.length > 0) {
        const { data: resins } = await supabase
          .from("resins")
          .select("name, slug, description, image_url, system_a_product_url")
          .in("slug", resinSlugs)
          .eq("active", true);

        resins?.forEach((r) => {
          if (r.system_a_product_url) {
            productsData.push({
              name: r.name,
              slug: r.slug,
              description: r.description,
              image_url: r.image_url,
              shop_url: r.system_a_product_url,
            });
          }
        });
      }

      setProducts(productsData);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold mb-4">Produtos Mencionados</h2>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-4 border rounded-lg p-4">
                <Skeleton className="w-32 h-32 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Produtos Mencionados</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {products.map((product) => (
            <a
              key={product.slug}
              href={product.shop_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-4 border rounded-lg overflow-hidden hover:border-primary transition-colors group"
            >
              {/* Imagem (esquerda) */}
              <div className="w-32 h-32 flex-shrink-0 bg-muted">
                <img
                  src={product.image_url || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* Conteúdo (direita) */}
              <div className="flex-1 py-3 pr-4">
                <div className="flex items-start gap-2 mb-2">
                  <h3 className="font-semibold text-lg line-clamp-2 flex-1">
                    {product.name}
                  </h3>
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {product.description || "Ver detalhes na loja"}
                </p>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

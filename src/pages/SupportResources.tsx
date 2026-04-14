import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ShoppingCart, FileText, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCard {
  id: string;
  name: string;
  image_url: string | null;
  cta_1_url: string | null;
  product_category: string;
  fds_url?: string | null;
  ifu_url?: string | null;
}

export default function SupportResources() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch products with their documents
      const { data: catalogData } = await supabase
        .from("system_a_catalog")
        .select("id, name, image_url, cta_1_url, product_category")
        .eq("active", true)
        .eq("approved", true)
        .not("product_category", "is", null)
        .order("name");

      if (!catalogData) {
        setLoading(false);
        return;
      }

      // Fetch documents for all products
      const productIds = catalogData.map((p) => p.id);
      const { data: docsData } = await supabase
        .from("catalog_documents")
        .select("product_id, document_category, file_url")
        .eq("active", true)
        .in("product_id", productIds);

      // Build doc map
      const docMap = new Map<string, { fds_url?: string; ifu_url?: string }>();
      docsData?.forEach((doc) => {
        const entry = docMap.get(doc.product_id) || {};
        const cat = (doc.document_category || "").toLowerCase();
        if (cat.includes("fds") || cat.includes("safety") || cat.includes("segurança")) {
          entry.fds_url = doc.file_url;
        } else if (cat.includes("ifu") || cat.includes("instruction") || cat.includes("instrução") || cat.includes("uso")) {
          entry.ifu_url = doc.file_url;
        } else {
          // Default: first doc as IFU
          if (!entry.ifu_url) entry.ifu_url = doc.file_url;
        }
        docMap.set(doc.product_id, entry);
      });

      const enriched: ProductCard[] = catalogData.map((p) => ({
        ...p,
        product_category: p.product_category!,
        fds_url: docMap.get(p.id)?.fds_url || null,
        ifu_url: docMap.get(p.id)?.ifu_url || null,
      }));

      setProducts(enriched);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ProductCard[]>();
    products.forEach((p) => {
      const list = map.get(p.product_category) || [];
      list.push(p);
      map.set(p.product_category, list);
    });
    // Sort categories alphabetically
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header showAdminButton={true} />

      <main className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("knowledge.category_g") || "Catálogo de Produtos"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("support_resources.subtitle") || "Documentos técnicos, fichas de segurança e informações de uso dos nossos produtos"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <section key={category} className="mb-12">
              <h2 className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">
                {category}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map((product) => (
                  <div
                    key={product.id}
                    className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-muted flex items-center justify-center p-4">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-3 flex-1">
                        {product.name}
                      </h3>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        {product.cta_1_url && (
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 px-2"
                            asChild
                          >
                            <a href={product.cta_1_url} target="_blank" rel="noopener noreferrer">
                              <ShoppingCart className="w-3 h-3 mr-1" />
                              Loja
                            </a>
                          </Button>
                        )}
                        {product.fds_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            asChild
                          >
                            <a href={product.fds_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="w-3 h-3 mr-1" />
                              FDS
                            </a>
                          </Button>
                        )}
                        {product.ifu_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            asChild
                          >
                            <a href={product.ifu_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="w-3 h-3 mr-1" />
                              IFU
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="border-t border-border bg-gradient-surface mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>{t("footer.copyright") || "© 2024 Smart Dent. Desenvolvido para a comunidade de impressão 3D."}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

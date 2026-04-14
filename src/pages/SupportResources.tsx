import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ShoppingCart, FileText, BookOpen, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DocInfo {
  name: string;
  url: string;
  category?: string;
}

interface PresentationInfo {
  label: string;
  price: number;
  grams_per_print: number;
  prints_per_bottle: number;
  cost_per_print: number;
}

interface UnifiedProduct {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  category: string;
  shop_url: string | null;
  documents: DocInfo[];
  presentations: PresentationInfo[];
  source: "catalog" | "resin";
}

export default function SupportResources() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [catalogRes, resinsRes] = await Promise.all([
        supabase
          .from("system_a_catalog")
          .select("id, name, image_url, description, product_category, cta_1_url")
          .eq("active", true)
          .eq("approved", true)
          .not("product_category", "is", null)
          .order("name"),
        supabase
          .from("resins")
          .select("id, name, image_url, description, slug, cta_1_url, cta_1_label")
          .eq("active", true)
          .order("name"),
      ]);

      const catalogItems = catalogRes.data || [];
      const resinItems = resinsRes.data || [];

      // Build a set of resin names (normalized) to deduplicate
      const resinNamesNorm = new Set(
        resinItems.map((r) => r.name.toLowerCase().replace(/\s+/g, " ").trim())
      );

      // Filter catalog: exclude items that match a resin name AND are in RESINAS 3D category
      const filteredCatalog = catalogItems.filter((p) => {
        if (p.product_category === "RESINAS 3D") {
          const norm = p.name.toLowerCase().replace(/\s+/g, " ").trim();
          return !resinNamesNorm.has(norm);
        }
        return true;
      });

      // Fetch docs for catalog products
      const catalogIds = filteredCatalog.map((p) => p.id);
      const catalogDocsPromise = catalogIds.length
        ? supabase
            .from("catalog_documents")
            .select("product_id, document_name, document_category, file_url")
            .eq("active", true)
            .in("product_id", catalogIds)
        : Promise.resolve({ data: [] as any[] });

      // Fetch docs + presentations for resins
      const resinIds = resinItems.map((r) => r.id);
      const [catalogDocsRes, resinDocsRes, resinPresRes] = await Promise.all([
        catalogDocsPromise,
        resinIds.length
          ? supabase
              .from("resin_documents")
              .select("resin_id, document_name, document_category, file_url")
              .eq("active", true)
              .in("resin_id", resinIds)
          : Promise.resolve({ data: [] as any[] }),
        resinIds.length
          ? supabase
              .from("resin_presentations")
              .select("resin_id, label, price, grams_per_print, prints_per_bottle, cost_per_print")
              .in("resin_id", resinIds)
              .order("sort_order")
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Build doc maps
      const catalogDocMap = new Map<string, DocInfo[]>();
      (catalogDocsRes.data || []).forEach((d: any) => {
        const list = catalogDocMap.get(d.product_id) || [];
        list.push({ name: d.document_name, url: d.file_url, category: d.document_category });
        catalogDocMap.set(d.product_id, list);
      });

      const resinDocMap = new Map<string, DocInfo[]>();
      (resinDocsRes.data || []).forEach((d: any) => {
        const list = resinDocMap.get(d.resin_id) || [];
        list.push({ name: d.document_name, url: d.file_url, category: d.document_category });
        resinDocMap.set(d.resin_id, list);
      });

      const resinPresMap = new Map<string, PresentationInfo[]>();
      (resinPresRes.data || []).forEach((p: any) => {
        const list = resinPresMap.get(p.resin_id) || [];
        list.push({
          label: p.label || "",
          price: Number(p.price) || 0,
          grams_per_print: Number(p.grams_per_print) || 0,
          prints_per_bottle: Number(p.prints_per_bottle) || 0,
          cost_per_print: Number(p.cost_per_print) || 0,
        });
        resinPresMap.set(p.resin_id, list);
      });

      // Unify
      const unified: UnifiedProduct[] = [
        ...filteredCatalog.map((p) => ({
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          description: p.description || null,
          category: p.product_category!,
          shop_url: p.cta_1_url || null,
          documents: catalogDocMap.get(p.id) || [],
          presentations: [],
          source: "catalog" as const,
        })),
        ...resinItems.map((r) => ({
          id: r.id,
          name: r.name,
          image_url: r.image_url,
          description: r.description || null,
          category: "RESINAS 3D",
          shop_url: r.cta_1_url || null,
          documents: resinDocMap.get(r.id) || [],
          presentations: resinPresMap.get(r.id) || [],
          source: "resin" as const,
        })),
      ];

      setProducts(unified);
      setLoading(false);
    }
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header showAdminButton={true} />

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("knowledge.category_g") || "Catálogo de Produtos"}
          </h1>
          <p className="text-lg text-muted-foreground">
            Documentos técnicos, fichas de segurança e informações dos nossos produtos
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 space-y-1 bg-card border border-border rounded-xl p-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                  Conteúdo
                </h2>
                {categories.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate text-left">
                      <Package className="w-4 h-4 shrink-0" />
                      {cat}
                    </span>
                    <span
                      className={`text-xs ml-2 ${
                        selectedCategory === cat ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Content area */}
            <div className="lg:col-span-3">
              {!selectedCategory ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Selecionar conteúdo
                  </h2>
                  <p className="text-muted-foreground max-w-md">
                    Escolha uma categoria na barra lateral para visualizar os produtos disponíveis
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-primary" />
                    {selectedCategory}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({filteredProducts.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                      >
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

                        <div className="p-3 flex flex-col flex-1">
                          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2 flex-1">
                            {product.name}
                          </h3>

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {product.shop_url && (
                              <Button size="sm" variant="default" className="text-xs h-7 px-2" asChild>
                                <a href={product.shop_url} target="_blank" rel="noopener noreferrer">
                                  <ShoppingCart className="w-3 h-3 mr-1" />
                                  Loja
                                </a>
                              </Button>
                            )}
                            {product.documents.some((d) =>
                              d.name?.toLowerCase().includes("fds")
                            ) && (
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2" asChild>
                                <a
                                  href={product.documents.find((d) => d.name?.toLowerCase().includes("fds"))!.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  FDS
                                </a>
                              </Button>
                            )}
                            {product.documents.some((d) =>
                              d.name?.toLowerCase().includes("ifu")
                            ) && (
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2" asChild>
                                <a
                                  href={product.documents.find((d) => d.name?.toLowerCase().includes("ifu"))!.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  IFU
                                </a>
                              </Button>
                            )}
                          </div>

                          <Accordion type="single" collapsible className="w-full">
                            {product.description && (
                              <AccordionItem value="desc" className="border-b-0">
                                <AccordionTrigger className="py-1.5 text-xs hover:no-underline">
                                  Descrição
                                </AccordionTrigger>
                                <AccordionContent>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {stripHtml(product.description).substring(0, 300)}
                                    {stripHtml(product.description).length > 300 ? "…" : ""}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            )}

                            {product.documents.length > 0 && (
                              <AccordionItem value="docs" className="border-b-0">
                                <AccordionTrigger className="py-1.5 text-xs hover:no-underline">
                                  Documentos ({product.documents.length})
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-1">
                                    {product.documents.map((doc, i) => (
                                      <a
                                        key={i}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                                      >
                                        <FileText className="w-3 h-3 shrink-0" />
                                        {doc.name}
                                      </a>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )}

                            {product.presentations.length > 0 && (
                              <AccordionItem value="skus" className="border-b-0">
                                <AccordionTrigger className="py-1.5 text-xs hover:no-underline">
                                  Apresentações ({product.presentations.length})
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-1.5">
                                    {product.presentations.map((pres, i) => (
                                      <div key={i} className="text-xs text-muted-foreground border border-border rounded p-1.5">
                                        {pres.label && (
                                          <p className="font-medium text-foreground">{pres.label}</p>
                                        )}
                                        {pres.price > 0 && <p>R$ {pres.price.toFixed(2)}</p>}
                                        {pres.grams_per_print > 0 && <p>{pres.grams_per_print}g/impressão</p>}
                                        {pres.prints_per_bottle > 0 && (
                                          <p>{pres.prints_per_bottle} impressões/frasco</p>
                                        )}
                                        {pres.cost_per_print > 0 && (
                                          <p>R$ {pres.cost_per_print.toFixed(2)}/impressão</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                          </Accordion>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Database, Sparkles, Brain, CheckCircle, AlertCircle, FileJson, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 15; // Products per batch to avoid body size limits

interface ImportStats {
  products?: number;
  company_info?: number;
  category_config?: number;
  video_testimonial?: number;
  google_review?: number;
  kol?: number;
  total?: number;
  errors?: number;
}

interface EnrichStats {
  apostila_products?: number;
  resins_db?: number;
  catalog_enriched?: number;
  results?: {
    matched: number;
    updated: number;
    skipped: number;
    errors: number;
    matches: Array<{ resin: string; product: string; fields_updated: string[] }>;
  };
}

interface EmbedStats {
  indexed?: number;
  errors?: number;
  total_chunks?: number;
  skipped?: number;
}

type StepStatus = "idle" | "running" | "done" | "error";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: StepStatus;
  stats?: ImportStats | EnrichStats | EmbedStats | null;
  error?: string;
  progress?: number;
}

export function AdminApostilaImporter() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [showMatches, setShowMatches] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    {
      id: "import",
      label: "Importar Catálogo",
      description: "Importa produtos, empresa, depoimentos e reviews para system_a_catalog",
      icon: Database,
      status: "idle",
    },
    {
      id: "enrich",
      label: "Enriquecer Resinas",
      description: "Cruza produtos com resinas do banco e atualiza description, ai_context, keywords",
      icon: Sparkles,
      status: "idle",
    },
    {
      id: "embed",
      label: "Indexar para Dra. L.I.A.",
      description: "Gera embeddings vetoriais de produtos e resinas para busca semântica",
      icon: Brain,
      status: "idle",
    },
  ]);

  const updateStep = (id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(2) + " MB");
    setParsedData(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setParsedData(json);
        toast({ title: "JSON carregado com sucesso!", description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` });
      } catch {
        toast({ title: "Erro ao parsear JSON", description: "Verifique se o arquivo é um JSON válido.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  // ── Step 1: Import catalog in batches ──────────────────────────
  const runImport = async () => {
    if (!parsedData) return;
    updateStep("import", { status: "running", stats: null, error: undefined, progress: 0 });

    try {
      const rawData = parsedData.data || parsedData;

      // Strip large video arrays from company before sending (not needed for catalog, just bloats payload)
      const rawCompany = rawData.company || rawData.company_profile || null;
      const companyStripped = rawCompany ? {
        ...rawCompany,
        company_videos: undefined,
        instagram_videos: undefined,
      } : null;

      // For large files, send non-product sections first, then products in batches
      const products: any[] = rawData.products || [];
      const nonProductPayload = {
        data: {
          company: companyStripped,
          categories: rawData.categories || rawData.categories_config || null,
          testimonials: rawData.testimonials || rawData.video_testimonials || null,
          reviews: rawData.reviews || rawData.google_reviews || null,
          kols: rawData.kols || null,
          products: [], // empty — will batch below
        },
      };

      let totalStats: ImportStats = {};

      // Send non-product data first
      if (nonProductPayload.data.company || nonProductPayload.data.categories || nonProductPayload.data.testimonials) {
        const { data, error } = await supabase.functions.invoke("import-system-a-json", {
          body: nonProductPayload,
        });
        if (error) throw error;
        totalStats = { ...data?.stats };
      }

      // Send products in batches
      const batches = Math.ceil(products.length / BATCH_SIZE);
      let productsDone = 0;

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("import-system-a-json", {
          body: { data: { products: batch } },
        });
        if (error) throw error;
        productsDone += batch.length;
        const pct = Math.round((productsDone / products.length) * 100);
        updateStep("import", { progress: pct });
        console.log(`Import batch ${Math.floor(i / BATCH_SIZE) + 1}/${batches}: ${productsDone}/${products.length}`);
        if (data?.stats?.products) {
          totalStats.products = (totalStats.products || 0) + (data.stats.products || 0);
        }
      }

      totalStats.total = (totalStats.products || 0) + (totalStats.company_info || 0) +
        (totalStats.category_config || 0) + (totalStats.video_testimonial || 0) +
        (totalStats.google_review || 0) + (totalStats.kol || 0);

      updateStep("import", { status: "done", stats: totalStats, progress: 100 });
      toast({ title: "Catálogo importado!", description: `${totalStats.total} itens importados com sucesso.` });
    } catch (e: any) {
      updateStep("import", { status: "error", error: e.message });
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    }
  };

  // ── Step 2: Enrich resins in batches ───────────────────────────
  const runEnrich = async () => {
    if (!parsedData) return;
    updateStep("enrich", { status: "running", stats: null, error: undefined, progress: 0 });

    try {
      const rawData = parsedData.data || parsedData;
      const products: any[] = rawData.products || [];

      let aggregated: EnrichStats = {
        results: { matched: 0, updated: 0, skipped: 0, errors: 0, matches: [] },
        catalog_enriched: 0,
        apostila_products: products.length,
      };

      // Send in batches
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("enrich-resins-from-apostila", {
          body: { products: batch },
        });
        if (error) throw error;

        if (data?.results) {
          aggregated.results!.matched += data.results.matched || 0;
          aggregated.results!.updated += data.results.updated || 0;
          aggregated.results!.skipped += data.results.skipped || 0;
          aggregated.results!.errors += data.results.errors || 0;
          aggregated.results!.matches.push(...(data.results.matches || []));
        }
        aggregated.catalog_enriched = (aggregated.catalog_enriched || 0) + (data?.catalog_enriched || 0);

        const pct = Math.round(((i + batch.length) / products.length) * 100);
        updateStep("enrich", { progress: pct });
      }

      updateStep("enrich", { status: "done", stats: aggregated, progress: 100 });
      toast({
        title: "Resinas enriquecidas!",
        description: `${aggregated.results?.updated} resinas atualizadas, ${aggregated.catalog_enriched} produtos do catálogo enriquecidos.`,
      });
    } catch (e: any) {
      updateStep("enrich", { status: "error", error: e.message });
      toast({ title: "Erro no enriquecimento", description: e.message, variant: "destructive" });
    }
  };

  // ── Step 3: Index embeddings (incremental for products) ────────
  const runEmbed = async () => {
    updateStep("embed", { status: "running", stats: null, error: undefined, progress: 50 });

    try {
      const { data, error } = await supabase.functions.invoke("index-embeddings", {
        body: null,
        headers: { "x-query": "?mode=incremental&sources=products,resins" },
      });

      // index-embeddings is a GET-style function — call via fetch directly
      const projectId = "okeogjgqijbfkudfjadz";
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/index-embeddings?mode=incremental`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk",
          },
          body: JSON.stringify({}),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      const result = await resp.json();
      updateStep("embed", { status: "done", stats: result, progress: 100 });
      toast({ title: "Embeddings indexados!", description: `${result.indexed} chunks indexados para a Dra. L.I.A.` });
    } catch (e: any) {
      updateStep("embed", { status: "error", error: e.message });
      toast({ title: "Erro na indexação", description: e.message, variant: "destructive" });
    }
  };

  const productCount = parsedData?.data?.products?.length || parsedData?.products?.length || 0;
  const enrichStats = steps.find((s) => s.id === "enrich")?.stats as EnrichStats | undefined;

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="w-5 h-5 text-primary" />
          Importar Apostila JSON
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
            Base de Conhecimento
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Importe o JSON exportado do Sistema A para enriquecer o catálogo, resinas e a base vetorial da Dra. L.I.A.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          {parsedData ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="text-sm text-muted-foreground">{fileSize} • {productCount} produtos detectados</p>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">JSON válido ✓</Badge>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-foreground">Clique para selecionar o arquivo JSON</p>
              <p className="text-sm text-muted-foreground">apostila-YYYY-MM-DD.json (qualquer tamanho)</p>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDisabled = !parsedData && step.id !== "embed";
            const isRunning = step.status === "running";
            const isDone = step.status === "done";
            const isError = step.status === "error";

            return (
              <div key={step.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isDone ? "bg-green-500/10" : isError ? "bg-destructive/10" : "bg-primary/10"}`}>
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : isError ? (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <Icon className={`w-5 h-5 text-primary ${isRunning ? "animate-pulse" : ""}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {idx + 1}. {step.label}
                      </span>
                      {isDone && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Concluído</Badge>}
                      {isRunning && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs animate-pulse">Executando...</Badge>}
                      {isError && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Erro</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

                    {isRunning && step.progress !== undefined && (
                      <Progress value={step.progress} className="mt-2 h-1.5" />
                    )}

                    {isError && step.error && (
                      <p className="text-xs text-destructive mt-1 font-mono">{step.error}</p>
                    )}

                    {/* Stats for import */}
                    {isDone && step.id === "import" && step.stats && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(step.stats as ImportStats).products !== undefined && (
                          <Badge variant="secondary" className="text-xs">{(step.stats as ImportStats).products} produtos</Badge>
                        )}
                        {(step.stats as ImportStats).video_testimonial !== undefined && (
                          <Badge variant="secondary" className="text-xs">{(step.stats as ImportStats).video_testimonial} depoimentos</Badge>
                        )}
                        {(step.stats as ImportStats).google_review !== undefined && (
                          <Badge variant="secondary" className="text-xs">{(step.stats as ImportStats).google_review} reviews</Badge>
                        )}
                        {(step.stats as ImportStats).total !== undefined && (
                          <Badge variant="outline" className="text-xs font-bold">Total: {(step.stats as ImportStats).total}</Badge>
                        )}
                      </div>
                    )}

                    {/* Stats for enrich */}
                    {isDone && step.id === "enrich" && enrichStats?.results && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs">{enrichStats.results.matched} matches encontrados</Badge>
                          <Badge variant="secondary" className="text-xs">{enrichStats.results.updated} resinas atualizadas</Badge>
                          <Badge variant="secondary" className="text-xs">{enrichStats.catalog_enriched} produtos enriquecidos</Badge>
                          {enrichStats.results.skipped > 0 && (
                            <Badge variant="outline" className="text-xs">{enrichStats.results.skipped} sem alterações</Badge>
                          )}
                        </div>
                        {enrichStats.results.matches.length > 0 && (
                          <button
                            className="text-xs text-primary flex items-center gap-1"
                            onClick={() => setShowMatches((v) => !v)}
                          >
                            {showMatches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {showMatches ? "Ocultar" : "Ver"} matches ({enrichStats.results.matches.length})
                          </button>
                        )}
                        {showMatches && enrichStats.results.matches.length > 0 && (
                          <div className="bg-muted/30 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                            {enrichStats.results.matches.map((m, i) => (
                              <div key={i} className="text-xs flex items-start gap-1">
                                <CheckCircle className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                <span className="font-medium">{m.resin}</span>
                                <span className="text-muted-foreground">← {m.product}</span>
                                <span className="text-primary">({m.fields_updated.join(", ")})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats for embed */}
                    {isDone && step.id === "embed" && step.stats && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">{(step.stats as EmbedStats).indexed} chunks indexados</Badge>
                        {(step.stats as EmbedStats).skipped !== undefined && (
                          <Badge variant="outline" className="text-xs">{(step.stats as EmbedStats).skipped} já existiam</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isDone ? "outline" : "default"}
                    disabled={isRunning || (isDisabled && step.id !== "embed")}
                    onClick={() => {
                      if (step.id === "import") runImport();
                      else if (step.id === "enrich") runEnrich();
                      else runEmbed();
                    }}
                    className="shrink-0"
                  >
                    {isRunning ? "Executando..." : isDone ? "Re-executar" : "Executar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick guide */}
        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como usar:</p>
          <p>1. Selecione o arquivo <code className="bg-muted px-1 rounded">apostila-YYYY-MM-DD.json</code> exportado do Sistema A</p>
          <p>2. Execute os 3 passos em ordem para importar, enriquecer e indexar</p>
          <p>3. Após indexar, a Dra. L.I.A. já usará os novos dados automaticamente</p>
        </div>
      </CardContent>
    </Card>
  );
}

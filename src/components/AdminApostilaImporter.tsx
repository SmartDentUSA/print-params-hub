import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Database, Sparkles, Brain, CheckCircle, AlertCircle, FileJson,
  ChevronDown, ChevronUp, Plus, Trash2, RefreshCw, Zap, BookOpen, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 15;

// ── Apostila JSON types ───────────────────────────────────────────────────────
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

// ── Cérebro da L.I.A. types ──────────────────────────────────────────────────
const CATEGORIES = [
  { value: "sdr", label: "SDR" },
  { value: "comercial", label: "Comercial" },
  { value: "workflow", label: "Workflow" },
  { value: "suporte", label: "Suporte" },
  { value: "faq", label: "FAQ" },
  { value: "objecoes", label: "Objeções" },
  { value: "onboarding", label: "Onboarding" },
  { value: "geral", label: "Geral" },
];

interface KBEntry {
  title: string;
  category: string;
  source_label: string;
  content: string;
}

interface KBResult {
  title: string;
  saved: boolean;
  chunks_created: number;
  indexed: number;
  error?: string;
}

interface DiagCategory {
  category: string;
  count: number;
}

const META_GOAL = 200;

export function AdminApostilaImporter() {
  const { toast } = useToast();

  // ── Apostila JSON state ───────────────────────────────────────────────────
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

  // ── Cérebro da L.I.A. state ──────────────────────────────────────────────
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<KBEntry[]>([]);
  const [singleEntry, setSingleEntry] = useState<KBEntry>({ title: "", category: "sdr", source_label: "", content: "" });
  const [indexing, setIndexing] = useState(false);
  const [indexResults, setIndexResults] = useState<KBResult[]>([]);
  const [batchEntries, setBatchEntries] = useState<KBEntry[]>([]);
  const [batchFileName, setBatchFileName] = useState("");
  const [batchIndexing, setBatchIndexing] = useState(false);
  const [batchResults, setBatchResults] = useState<KBResult[]>([]);
  const [diagData, setDiagData] = useState<DiagCategory[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagLastSync, setDiagLastSync] = useState<string | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // ── Apostila helpers ──────────────────────────────────────────────────────
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

  const runImport = async () => {
    if (!parsedData) return;
    updateStep("import", { status: "running", stats: null, error: undefined, progress: 0 });
    try {
      const rawData = parsedData.data || parsedData;
      const rawCompany = rawData.company || rawData.company_profile || null;
      const companyStripped = rawCompany ? { ...rawCompany, company_videos: undefined, instagram_videos: undefined } : null;
      const products: any[] = rawData.products || [];
      const nonProductPayload = {
        data: {
          company: companyStripped,
          categories: rawData.categories || rawData.categories_config || null,
          testimonials: rawData.testimonials || rawData.video_testimonials || null,
          reviews: rawData.reviews || rawData.google_reviews || null,
          kols: rawData.kols || null,
          products: [],
        },
      };
      let totalStats: ImportStats = {};
      if (nonProductPayload.data.company || nonProductPayload.data.categories || nonProductPayload.data.testimonials) {
        const { data, error } = await supabase.functions.invoke("import-system-a-json", { body: nonProductPayload });
        if (error) throw error;
        totalStats = { ...data?.stats };
      }
      const batches = Math.ceil(products.length / BATCH_SIZE);
      let productsDone = 0;
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("import-system-a-json", { body: { data: { products: batch } } });
        if (error) throw error;
        productsDone += batch.length;
        updateStep("import", { progress: Math.round((productsDone / products.length) * 100) });
        if (data?.stats?.products) totalStats.products = (totalStats.products || 0) + (data.stats.products || 0);
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
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("enrich-resins-from-apostila", { body: { products: batch } });
        if (error) throw error;
        if (data?.results) {
          aggregated.results!.matched += data.results.matched || 0;
          aggregated.results!.updated += data.results.updated || 0;
          aggregated.results!.skipped += data.results.skipped || 0;
          aggregated.results!.errors += data.results.errors || 0;
          aggregated.results!.matches.push(...(data.results.matches || []));
        }
        aggregated.catalog_enriched = (aggregated.catalog_enriched || 0) + (data?.catalog_enriched || 0);
        updateStep("enrich", { progress: Math.round(((i + batch.length) / products.length) * 100) });
      }
      updateStep("enrich", { status: "done", stats: aggregated, progress: 100 });
      toast({ title: "Resinas enriquecidas!", description: `${aggregated.results?.updated} resinas atualizadas.` });
    } catch (e: any) {
      updateStep("enrich", { status: "error", error: e.message });
      toast({ title: "Erro no enriquecimento", description: e.message, variant: "destructive" });
    }
  };

  const runEmbed = async () => {
    updateStep("embed", { status: "running", stats: null, error: undefined, progress: 50 });
    try {
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

  // ── Cérebro helpers ───────────────────────────────────────────────────────
  const addToQueue = () => {
    if (!singleEntry.title.trim() || !singleEntry.content.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setQueue((prev) => [...prev, { ...singleEntry }]);
    setSingleEntry({ title: "", category: "sdr", source_label: "", content: "" });
  };

  const removeFromQueue = (idx: number) => setQueue((prev) => prev.filter((_, i) => i !== idx));

  const indexQueue = async () => {
    if (!queue.length) return;
    setIndexing(true);
    setIndexResults([]);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || "";
      const resp = await fetch(
        `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/ingest-knowledge-text`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk",
          },
          body: JSON.stringify({ entries: queue }),
        }
      );
      const result = await resp.json();
      setIndexResults(result.results || []);
      if (resp.ok) {
        setQueue([]);
        toast({ title: "Indexação concluída!", description: `${result.indexed} chunks indexados na L.I.A.` });
      } else {
        toast({ title: "Erro na indexação", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro na indexação", description: e.message, variant: "destructive" });
    } finally {
      setIndexing(false);
    }
  };

  const handleBatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const entries = Array.isArray(json) ? json : [];
        setBatchEntries(entries);
        toast({ title: `${entries.length} blocos detectados`, description: file.name });
      } catch {
        toast({ title: "JSON inválido", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const indexBatch = async () => {
    if (!batchEntries.length) return;
    setBatchIndexing(true);
    setBatchResults([]);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || "";
      const resp = await fetch(
        `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/ingest-knowledge-text`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk",
          },
          body: JSON.stringify({ entries: batchEntries }),
        }
      );
      const result = await resp.json();
      setBatchResults(result.results || []);
      if (resp.ok) {
        toast({ title: "Lote indexado!", description: `${result.indexed} chunks indexados.` });
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBatchIndexing(false);
    }
  };

  const loadDiag = async () => {
    setDiagLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_embeddings")
        .select("metadata")
        .eq("source_type", "company_kb");

      if (error) throw error;

      const catCount: Record<string, number> = {};
      for (const row of data || []) {
        const cat = (row.metadata as any)?.category || "geral";
        catCount[cat] = (catCount[cat] || 0) + 1;
      }

      const categories = Object.entries(catCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      setDiagData(categories);
      setDiagLastSync(new Date().toLocaleString("pt-BR"));
    } catch (e: any) {
      toast({ title: "Erro ao carregar diagnóstico", description: e.message, variant: "destructive" });
    } finally {
      setDiagLoading(false);
    }
  };

  const totalDiagChunks = diagData.reduce((s, d) => s + d.count, 0);
  const productCount = parsedData?.data?.products?.length || parsedData?.products?.length || 0;
  const enrichStats = steps.find((s) => s.id === "enrich")?.stats as EnrichStats | undefined;

  // ── Batch breakdown by category ───────────────────────────────────────────
  const batchBreakdown = batchEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Alimentador de Cérebro da L.I.A.
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
            Base de Conhecimento
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Alimente a base vetorial da Dra. L.I.A. com conhecimento humano: apostilas, scripts, dados de leads e experiências comerciais.
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="apostila">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="apostila" className="flex-1 gap-2">
              <FileJson className="w-4 h-4" />
              Apostila JSON
            </TabsTrigger>
            <TabsTrigger value="cerebro" className="flex-1 gap-2">
              <Brain className="w-4 h-4" />
              Cérebro da L.I.A.
            </TabsTrigger>
          </TabsList>

          {/* ── ABA 1: Apostila JSON ──────────────────────────────────────── */}
          <TabsContent value="apostila" className="space-y-6">
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
                          <span className="font-medium text-sm">{idx + 1}. {step.label}</span>
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

                        {isDone && step.id === "import" && step.stats && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(step.stats as ImportStats).products !== undefined && (
                              <Badge variant="secondary" className="text-xs">{(step.stats as ImportStats).products} produtos</Badge>
                            )}
                            {(step.stats as ImportStats).video_testimonial !== undefined && (
                              <Badge variant="secondary" className="text-xs">{(step.stats as ImportStats).video_testimonial} depoimentos</Badge>
                            )}
                            {(step.stats as ImportStats).total !== undefined && (
                              <Badge variant="outline" className="text-xs font-bold">Total: {(step.stats as ImportStats).total}</Badge>
                            )}
                          </div>
                        )}

                        {isDone && step.id === "enrich" && enrichStats?.results && (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-xs">{enrichStats.results.matched} matches encontrados</Badge>
                              <Badge variant="secondary" className="text-xs">{enrichStats.results.updated} resinas atualizadas</Badge>
                              <Badge variant="secondary" className="text-xs">{enrichStats.catalog_enriched} produtos enriquecidos</Badge>
                            </div>
                            {enrichStats.results.matches.length > 0 && (
                              <button className="text-xs text-primary flex items-center gap-1" onClick={() => setShowMatches((v) => !v)}>
                                {showMatches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {showMatches ? "Ocultar" : "Ver"} matches ({enrichStats.results.matches.length})
                              </button>
                            )}
                            {showMatches && (
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

            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como usar:</p>
              <p>1. Selecione o arquivo <code className="bg-muted px-1 rounded">apostila-YYYY-MM-DD.json</code> exportado do Sistema A</p>
              <p>2. Execute os 3 passos em ordem para importar, enriquecer e indexar</p>
              <p>3. Após indexar, a Dra. L.I.A. já usará os novos dados automaticamente</p>
            </div>
          </TabsContent>

          {/* ── ABA 2: Cérebro da L.I.A. ─────────────────────────────────── */}
          <TabsContent value="cerebro" className="space-y-6">

            {/* Guia de formato */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                onClick={() => setShowFormatGuide((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Guia de formato JSON
                </span>
                {showFormatGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showFormatGuide && (
                <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                  <p className="text-xs text-muted-foreground">Use este formato para importar blocos em lote via JSON:</p>
                  <pre className="text-xs bg-muted rounded p-3 overflow-x-auto text-foreground">
{`[
  {
    "title": "Perfil ICP — Compradores BLZ",
    "category": "sdr",
    "source_label": "Formulário de Leads 2025 (262 respostas)",
    "content": "91,3% dos compradores são clínicos gerais..."
  },
  {
    "title": "ROI do Combo Medit i600 — Payback",
    "category": "comercial",
    "source_label": "Comparativo Financeiro Combo i600 v2",
    "content": "Lucro garantido inicial de R$64.820..."
  },
  {
    "title": "Tempo de produção de placas por fluxo",
    "category": "workflow",
    "source_label": "Comparativo Fluxos Chair Side Print v1",
    "content": "Fluxo fragmentado: 131min. Combo 4.0: 101min..."
  },
  {
    "title": "Como tratar objeção de preço",
    "category": "objecoes",
    "source_label": "Script SDR v3",
    "content": "Quando o lead diz que está caro, mostrar a conta..."
  }
]`}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <Badge key={c.value} variant="outline" className="text-xs">{c.value}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção A: Bloco único */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                A — Inserção de Bloco Único
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título *</Label>
                  <Input
                    placeholder="Ex: Perfil ICP — Comprador BLZ"
                    value={singleEntry.title}
                    onChange={(e) => setSingleEntry((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={singleEntry.category}
                    onChange={(e) => setSingleEntry((p) => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Fonte (origem do documento)</Label>
                <Input
                  placeholder="Ex: PDF Chair Side Print 4.0"
                  value={singleEntry.source_label}
                  onChange={(e) => setSingleEntry((p) => ({ ...p, source_label: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Conteúdo * <span className="text-muted-foreground">({singleEntry.content.length} chars — split automático em chunks de 900)</span>
                </Label>
                <Textarea
                  placeholder="Cole o texto em linguagem natural. Textos longos são divididos automaticamente com overlap de 150 chars..."
                  className="min-h-[120px]"
                  value={singleEntry.content}
                  onChange={(e) => setSingleEntry((p) => ({ ...p, content: e.target.value }))}
                />
              </div>

              <Button size="sm" variant="outline" onClick={addToQueue} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar à fila
              </Button>

              {/* Queue */}
              {queue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{queue.length} bloco(s) na fila:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {queue.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="secondary" className="text-xs shrink-0">{item.category}</Badge>
                          <span className="text-xs truncate font-medium">{item.title}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{item.content.length} chars</span>
                        </div>
                        <button onClick={() => removeFromQueue(i)} className="text-muted-foreground hover:text-destructive ml-2 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={indexQueue}
                    disabled={indexing}
                    className="w-full gap-2"
                  >
                    <Zap className={`w-4 h-4 ${indexing ? "animate-pulse" : ""}`} />
                    {indexing ? "Indexando na L.I.A...." : `Indexar ${queue.length} bloco(s) na L.I.A.`}
                  </Button>
                </div>
              )}

              {/* Index results */}
              {indexResults.length > 0 && (
                <div className="space-y-1.5">
                  {indexResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs rounded px-3 py-2 ${r.saved ? "bg-green-500/10" : "bg-destructive/10"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {r.saved ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        <span className="truncate">{r.title}</span>
                      </div>
                      {r.saved ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs shrink-0">
                          {r.indexed} chunks
                        </Badge>
                      ) : (
                        <span className="text-destructive text-xs shrink-0">{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção B: JSON em lote */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <FileJson className="w-4 h-4 text-primary" />
                B — Importação via JSON em Lote
              </h3>

              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => jsonFileInputRef.current?.click()}
              >
                <input ref={jsonFileInputRef} type="file" accept=".json" className="hidden" onChange={handleBatchFile} />
                <FileJson className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                {batchEntries.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">{batchFileName}</p>
                    <p className="text-xs text-muted-foreground">{batchEntries.length} blocos detectados</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Clique para selecionar arquivo .json com array de blocos</p>
                )}
              </div>

              {batchEntries.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(batchBreakdown).map(([cat, count]) => (
                      <Badge key={cat} variant="secondary" className="text-xs">{cat}: {count}</Badge>
                    ))}
                  </div>

                  <Button onClick={indexBatch} disabled={batchIndexing} className="w-full gap-2">
                    <Zap className={`w-4 h-4 ${batchIndexing ? "animate-pulse" : ""}`} />
                    {batchIndexing ? "Indexando lote..." : `Indexar todos (${batchEntries.length} blocos)`}
                  </Button>

                  {batchResults.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        {batchResults.filter((r) => r.saved).length}/{batchResults.length} indexados com sucesso —{" "}
                        {batchResults.reduce((s, r) => s + r.indexed, 0)} chunks gerados
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {batchResults.filter((r) => !r.saved).map((r, i) => (
                          <div key={i} className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {r.title}: {r.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seção C: Diagnóstico */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  C — Diagnóstico do Cérebro
                </h3>
                <Button size="sm" variant="outline" onClick={loadDiag} disabled={diagLoading} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? "animate-spin" : ""}`} />
                  {diagLoading ? "Carregando..." : "Atualizar"}
                </Button>
              </div>

              {diagData.length === 0 && !diagLoading && (
                <p className="text-xs text-muted-foreground">Clique em "Atualizar" para ver o status do company_kb.</p>
              )}

              {diagData.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{totalDiagChunks} chunks indexados</span>
                      <span className="text-muted-foreground">meta: {META_GOAL}</span>
                    </div>
                    <Progress value={Math.min((totalDiagChunks / META_GOAL) * 100, 100)} className="h-2" />
                    <p className="text-xs text-muted-foreground">{Math.round((totalDiagChunks / META_GOAL) * 100)}% da meta de {META_GOAL} chunks</p>
                  </div>

                  <div className="space-y-1.5">
                    {diagData.map((d) => {
                      const pct = totalDiagChunks > 0 ? (d.count / totalDiagChunks) * 100 : 0;
                      return (
                        <div key={d.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Badge variant="outline" className="text-xs w-20 justify-center">{d.category}</Badge>
                            <Progress value={pct} className="flex-1 h-1.5" />
                          </div>
                          <Badge variant="secondary" className="text-xs ml-2 shrink-0">{d.count}</Badge>
                        </div>
                      );
                    })}
                  </div>

                  {diagLastSync && (
                    <p className="text-xs text-muted-foreground">Última atualização: {diagLastSync}</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

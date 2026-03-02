import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  MessageSquare,
  ThumbsUp,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Activity,
  Download,
  ChevronDown,
  ChevronUp,
  Database,
  Zap,
  FileText,
  Video,
  FlaskConical,
  Settings2,
  XCircle,
  Sparkles,
  ChevronRight,
  Brain,
  Building2,
  ShoppingBag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminApostilaImporter } from "@/components/AdminApostilaImporter";


interface DailyData {
  day: string;
  total: number;
  positive: number;
  negative: number;
}

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  status: string;
  created_at: string;
  lang: string;
}

interface QualityInteraction {
  id: string;
  created_at: string;
  user_message: string;
  agent_response: string | null;
  judge_score: number | null;
  judge_verdict: string | null;
  judge_reason: string | null;
  judge_score_ds: number | null;
  judge_verdict_ds: string | null;
  judge_reason_ds: string | null;
  feedback: string | null;
  human_reviewed: boolean | null;
  judge_evaluated_at: string | null;
}

interface Stats {
  totalInteractions: number;
  satisfactionRate: number;
  positiveCount: number;
  negativeCount: number;
  noneCount: number;
  unansweredCount: number;
  pendingGapsCount: number;
}

interface QualityStats {
  evaluatedCount: number;
  hallucinationCount: number;
  hallucinationRate: number;
  avgScore: number;
  reviewedCount: number;
  scoreDistribution: { range: string; count: number; color: string }[];
}

interface RAGStats {
  totalChunks: number;
  bySourceType: { source_type: string; count: number }[];
  lastIndexedAt: string | null;
  totalArticles: number;
  indexedArticles: number;
}

interface IndexingResult {
  success: boolean;
  indexed: number;
  errors: number;
  skipped: number;
  total_chunks: number;
  mode: string;
  error?: string;
}

interface GapDraft {
  id: string;
  draft_title: string;
  draft_excerpt: string;
  draft_faq: { q: string; a: string }[] | null;
  draft_keywords: string[] | null;
  draft_title_ds: string | null;
  draft_excerpt_ds: string | null;
  draft_faq_ds: { q: string; a: string }[] | null;
  ai_model_used: string | null;
  gap_ids: string[];
  cluster_questions: string[];
  status: 'draft' | 'approved' | 'rejected';
  published_content_id: string | null;
  created_at: string;
}


const VERDICT_CONFIG: Record<string, { label: string; className: string }> = {
  hallucination: { label: "Alucinação", className: "bg-destructive/20 text-destructive border-destructive/30" },
  off_topic: { label: "Fora do Tema", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400" },
  incomplete: { label: "Incompleta", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400" },
  ok: { label: "OK", className: "bg-chart-2/20 text-chart-2 border-chart-2/30" },
};

const SCORE_COLOR = (score: number | null) => {
  if (score === null) return "text-muted-foreground";
  if (score <= 1) return "text-destructive font-bold";
  if (score <= 2) return "text-orange-600 font-bold";
  if (score <= 3) return "text-yellow-600 font-semibold";
  return "text-chart-2 font-semibold";
};

export function AdminDraLIAStats() {
  const [stats, setStats] = useState<Stats>({
    totalInteractions: 0,
    satisfactionRate: 0,
    positiveCount: 0,
    negativeCount: 0,
    noneCount: 0,
    unansweredCount: 0,
    pendingGapsCount: 0,
  });
  const [qualityStats, setQualityStats] = useState<QualityStats>({
    evaluatedCount: 0,
    hallucinationCount: 0,
    hallucinationRate: 0,
    avgScore: 0,
    reviewedCount: 0,
    scoreDistribution: [],
  });
  const [ragStats, setRagStats] = useState<RAGStats>({
    totalChunks: 0,
    bySourceType: [],
    lastIndexedAt: null,
    totalArticles: 0,
    indexedArticles: 0,
  });
  const [indexingResult, setIndexingResult] = useState<IndexingResult | null>(null);
  const [indexingLoading, setIndexingLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [qualityItems, setQualityItems] = useState<QualityInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingJsonl, setExportingJsonl] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [drafts, setDrafts] = useState<GapDraft[]>([]);
  const [editedDrafts, setEditedDrafts] = useState<Record<string, Partial<GapDraft>>>({});
  const [healLoading, setHealLoading] = useState(false);
  const [healStep, setHealStep] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [autoHealCount, setAutoHealCount] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all interactions + quality data in parallel
      const [intResult, gapResult, qualityResult] = await Promise.all([
        supabase
          .from("agent_interactions")
          .select("created_at, feedback, unanswered")
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("agent_knowledge_gaps")
          .select("id, question, frequency, status, created_at, lang")
          .order("frequency", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("agent_interactions")
          .select("id, created_at, user_message, agent_response, judge_score, judge_verdict, judge_reason, judge_score_ds, judge_verdict_ds, judge_reason_ds, feedback, human_reviewed, judge_evaluated_at")
          .or("judge_score.lte.2,feedback.eq.negative")
          .not("agent_response", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (intResult.error) throw intResult.error;
      if (gapResult.error) throw gapResult.error;

      const interactions = intResult.data ?? [];

      // Compute main KPIs
      const total = interactions.length;
      const positive = interactions.filter((i) => i.feedback === "positive").length;
      const negative = interactions.filter((i) => i.feedback === "negative").length;
      const none = interactions.filter((i) => i.feedback === "none" || !i.feedback).length;
      const unanswered = interactions.filter((i) => i.unanswered === true).length;
      const withFeedback = positive + negative;
      const satisfactionRate = withFeedback > 0 ? Math.round((positive / withFeedback) * 100) : 0;

      // Group by day
      const dayMap: Record<string, { total: number; positive: number; negative: number }> = {};
      interactions.forEach((i) => {
        const day = i.created_at?.slice(0, 10) ?? "";
        if (!dayMap[day]) dayMap[day] = { total: 0, positive: 0, negative: 0 };
        dayMap[day].total += 1;
        if (i.feedback === "positive") dayMap[day].positive += 1;
        if (i.feedback === "negative") dayMap[day].negative += 1;
      });

      const daily = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day: day.slice(5), total: v.total, positive: v.positive, negative: v.negative }));

      const gaps = gapResult.data ?? [];
      const pendingGaps = gaps.filter((g) => g.status === "pending").length;

      setStats({ totalInteractions: total, satisfactionRate, positiveCount: positive, negativeCount: negative, noneCount: none, unansweredCount: unanswered, pendingGapsCount: pendingGaps });
      setDailyData(daily);
      setKnowledgeGaps(gaps as KnowledgeGap[]);

      // Quality stats — fetch separately without filter for aggregate
      const { data: allEvaluated } = await supabase
        .from("agent_interactions")
        .select("judge_score, judge_verdict, human_reviewed")
        .not("judge_evaluated_at", "is", null);

      const evaluated = allEvaluated ?? [];
      const hallucinationCount = evaluated.filter((e) => e.judge_score === 0).length;
      const hallucinationRate = evaluated.length > 0 ? Math.round((hallucinationCount / evaluated.length) * 100) : 0;
      const scores = evaluated.map((e) => e.judge_score ?? 0);
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
      const reviewedCount = evaluated.filter((e) => e.human_reviewed).length;

      const scoreDistribution = [
        { range: "0–1", count: evaluated.filter((e) => (e.judge_score ?? 0) <= 1).length, color: "hsl(var(--destructive))" },
        { range: "2–3", count: evaluated.filter((e) => (e.judge_score ?? 0) >= 2 && (e.judge_score ?? 0) <= 3).length, color: "hsl(var(--chart-3))" },
        { range: "4–5", count: evaluated.filter((e) => (e.judge_score ?? 0) >= 4).length, color: "hsl(var(--chart-2))" },
      ];

      setQualityStats({ evaluatedCount: evaluated.length, hallucinationCount, hallucinationRate, avgScore, reviewedCount, scoreDistribution });
      setQualityItems((qualityResult.data ?? []) as QualityInteraction[]);
    } catch (err) {
      console.error("Error fetching Dra. L.I.A. stats:", err);
      toast({ title: "Erro ao carregar estatísticas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchRAGStats = useCallback(async () => {
    try {
      const [rpcResult, artResult] = await Promise.all([
        supabase.rpc("get_rag_stats" as never),
        supabase.from("knowledge_contents").select("id", { count: "exact" }).eq("active", true),
      ]);

      const rows = (rpcResult.data ?? []) as Array<{ source_type: string; chunk_count: number; last_indexed_at: string | null }>;
      const totalChunks = rows.reduce((sum, r) => sum + Number(r.chunk_count), 0);
      const bySourceType = rows.map(r => ({
        source_type: r.source_type,
        count: Number(r.chunk_count),
      }));
      const lastIndexedAt = rows.length > 0
        ? rows.reduce((max, r) =>
            r.last_indexed_at && r.last_indexed_at > max ? r.last_indexed_at : max,
            rows[0].last_indexed_at ?? ""
          )
        : null;

      const articleEntry = rows.find(r => r.source_type === "article");

      setRagStats({
        totalChunks,
        bySourceType,
        lastIndexedAt,
        totalArticles: artResult.count ?? 0,
        indexedArticles: articleEntry ? Number(articleEntry.chunk_count) : 0,
      });
    } catch (err) {
      console.error("Error fetching RAG stats:", err);
    }
  }, []);

  const handleIndexing = async (mode: "full" | "incremental") => {
    setIndexingLoading(true);
    setIndexingResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const start = Date.now();
      const response = await fetch(`${supabaseUrl}/functions/v1/index-embeddings?mode=${mode}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const json = await response.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (!response.ok) {
        setIndexingResult({ success: false, indexed: 0, errors: 0, skipped: 0, total_chunks: 0, mode, error: json.error || `HTTP ${response.status}` });
        toast({ title: `Erro na indexação: ${json.error}`, variant: "destructive" });
      } else {
        setIndexingResult({ ...json, success: true });
        toast({ title: `✓ Indexação concluída em ${elapsed}s — ${json.indexed} chunks indexados` });
        fetchRAGStats();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setIndexingResult({ success: false, indexed: 0, errors: 0, skipped: 0, total_chunks: 0, mode: mode, error: msg });
      toast({ title: `Erro: ${msg}`, variant: "destructive" });
    } finally {
      setIndexingLoading(false);
    }
  };

  const [stagingLoading, setStagingLoading] = useState<string | null>(null);

  const handleIndexingStage = async (stage: string) => {
    setStagingLoading(stage);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const start = Date.now();
      const response = await fetch(`${supabaseUrl}/functions/v1/index-embeddings?mode=full&stage=${stage}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const json = await response.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (!response.ok) {
        toast({ title: `Erro na reindexação: ${json.error}`, variant: "destructive" });
      } else {
        toast({ title: `✓ ${stage} reindexado em ${elapsed}s — ${json.indexed} chunks` });
        fetchRAGStats();
      }
    } catch (err) {
      toast({ title: `Erro: ${err instanceof Error ? err.message : "Erro"}`, variant: "destructive" });
    } finally {
      setStagingLoading(null);
    }
  };

  const fetchDrafts = useCallback(async () => {
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from("knowledge_gap_drafts" as never)
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("agent_embeddings" as never)
        .select("id", { count: "exact", head: true })
        .eq("metadata->>origin" as never, "auto-heal"),
    ]);
    if (!error && data) setDrafts(data as unknown as GapDraft[]);
    setAutoHealCount(count ?? 0);
  }, []);

  const updateDraftField = (draftId: string, field: keyof GapDraft, value: unknown) => {
    setEditedDrafts((prev) => ({
      ...prev,
      [draftId]: { ...prev[draftId], [field]: value },
    }));
  };

  const handleGenerate = async () => {
    setHealLoading(true);
    setHealStep("Buscando lacunas pendentes...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      setHealStep("Gerando embeddings e agrupando lacunas...");
      const response = await fetch(`${supabaseUrl}/functions/v1/heal-knowledge-gaps?action=generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

      setHealStep(`✓ ${result.drafts_created} rascunhos criados de ${result.gaps_analyzed} lacunas analisadas`);
      toast({ title: `Auto-Heal concluído: ${result.drafts_created} rascunhos criados` });
      await fetchDrafts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: `Erro: ${msg}`, variant: "destructive" });
      setHealStep(null);
    } finally {
      setHealLoading(false);
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    setApprovingId(draftId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const draft = drafts.find((d) => d.id === draftId);
      if (!draft) throw new Error("Rascunho não encontrado");

      const edited = editedDrafts[draftId] ?? {};
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/heal-knowledge-gaps?action=approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft_id: draftId,
          title: edited.draft_title ?? draft.draft_title,
          excerpt: edited.draft_excerpt ?? draft.draft_excerpt,
          faqs: edited.draft_faq ?? draft.draft_faq,
          keywords: edited.draft_keywords ?? draft.draft_keywords,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

      toast({
        title: "✓ Conhecimento indexado na L.I.A.",
        description: "O FAQ foi absorvido pela memória semântica da Dra. L.I.A.",
      });
      await fetchDrafts();
    } catch (err) {
      toast({ title: `Erro: ${err instanceof Error ? err.message : "Erro"}`, variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReindexDraft = async (draftId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/heal-knowledge-gaps?action=reindex`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draft_id: draftId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

      toast({
        title: "✓ Re-indexado na L.I.A.",
        description: "O FAQ foi absorvido pela memória semântica.",
      });
      await fetchDrafts();
    } catch (err) {
      toast({ title: `Erro ao re-indexar: ${err instanceof Error ? err.message : "Erro"}`, variant: "destructive" });
    }
  };

  const handleRejectDraft = async (draftId: string) => {
    setRejectingId(draftId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/heal-knowledge-gaps?action=reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draft_id: draftId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      toast({ title: "Rascunho descartado" });
      await fetchDrafts();
    } catch (err) {
      toast({ title: `Erro: ${err instanceof Error ? err.message : "Erro"}`, variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRAGStats();
    fetchDrafts();
  }, [fetchData, fetchRAGStats, fetchDrafts]);

  const handleResolve = async (gapId: string) => {
    setResolvingId(gapId);
    try {
      const { error } = await supabase
        .from("agent_knowledge_gaps")
        .update({ status: "resolved" })
        .eq("id", gapId);
      if (error) throw error;
      setKnowledgeGaps((prev) => prev.map((g) => (g.id === gapId ? { ...g, status: "resolved" } : g)));
      setStats((prev) => ({ ...prev, pendingGapsCount: Math.max(0, prev.pendingGapsCount - 1) }));
      toast({ title: "Lacuna marcada como resolvida ✓" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  const handleMarkOk = async (id: string) => {
    setMarkingId(id);
    try {
      const { error } = await supabase
        .from("agent_interactions")
        .update({ human_reviewed: true })
        .eq("id", id);
      if (error) throw error;
      setQualityItems((prev) => prev.map((q) => (q.id === id ? { ...q, human_reviewed: true } : q)));
      toast({ title: "Interação marcada como OK ✓" });
    } catch {
      toast({ title: "Erro ao atualizar interação", variant: "destructive" });
    } finally {
      setMarkingId(null);
    }
  };

  const handleExportJsonl = async () => {
    setExportingJsonl(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/dra-lia-export`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        if (response.status === 404) {
          toast({
            title: "Nenhuma interação qualificada",
            description: "Para exportar, marque interações como revisadas (human_reviewed = true) com judge_score ≥ 4 na lista abaixo.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const timestamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lia-dataset-${timestamp}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      const count = response.headers.get("X-Record-Count") ?? "?";
      toast({ title: `Dataset exportado com sucesso (${count} interações)` });
    } catch (err) {
      toast({ title: `Erro ao exportar: ${err instanceof Error ? err.message : "Erro"}`, variant: "destructive" });
    } finally {
      setExportingJsonl(false);
    }
  };

  const radialData = [{ name: "👍 Positivo", value: stats.satisfactionRate, fill: "hsl(var(--chart-2))" }];

  const kpis = [
    { label: "Interações (30 dias)", value: stats.totalInteractions, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
    { label: "Taxa de Satisfação", value: `${stats.satisfactionRate}%`, icon: ThumbsUp, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Sem Resposta", value: stats.unansweredCount, icon: HelpCircle, color: "text-chart-3", bg: "bg-chart-3/10" },
    { label: "Lacunas Pendentes", value: stats.pendingGapsCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  const qualityKpis = [
    {
      label: "Taxa de Alucinação",
      value: `${qualityStats.hallucinationRate}%`,
      sub: `${qualityStats.hallucinationCount} casos (score=0)`,
      icon: AlertTriangle,
      color: qualityStats.hallucinationRate > 10 ? "text-destructive" : "text-chart-2",
      bg: qualityStats.hallucinationRate > 10 ? "bg-destructive/10" : "bg-chart-2/10",
    },
    {
      label: "Score Médio do Juiz",
      value: qualityStats.evaluatedCount > 0 ? qualityStats.avgScore.toFixed(1) : "–",
      sub: `de 0 a 5`,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Avaliadas pelo Juiz",
      value: qualityStats.evaluatedCount,
      sub: "com judge_evaluated_at",
      icon: ShieldCheck,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
    },
    {
      label: "Revisadas pelo Time",
      value: qualityStats.reviewedCount,
      sub: "human_reviewed = true",
      icon: CheckCircle2,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
  ];

  const pagedItems = qualityItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(qualityItems.length / PAGE_SIZE);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🤖 Dra. L.I.A. — Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">🤖 Dra. L.I.A. — Estatísticas</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">Visão Geral</TabsTrigger>
          <TabsTrigger value="quality" className="flex-1 sm:flex-none gap-2">
            <ShieldCheck className="w-4 h-4" />
            Qualidade
            {qualityStats.hallucinationCount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 h-4 ml-1">
                {qualityStats.hallucinationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rag" className="flex-1 sm:flex-none gap-2">
            <Database className="w-4 h-4" />
            Indexação RAG
            {ragStats.totalChunks === 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 h-4 ml-1">!</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="autoheal" className="flex-1 sm:flex-none gap-1">
            <Sparkles className="w-4 h-4" />
            Auto-Heal
            {drafts.filter(d => d.status === 'draft').length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 h-4 ml-1">
                {drafts.filter(d => d.status === 'draft').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alimentador" className="flex-1 sm:flex-none gap-1">
            <Brain className="w-4 h-4" />
            Alimentador
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Visão Geral ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Interações por Dia (últimos 30 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                    Nenhuma interação registrada ainda
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(value, name) => [value, name === "total" ? "Total" : name === "positive" ? "👍 Positivos" : "👎 Negativos"]}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="total" />
                      <Bar dataKey="positive" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="positive" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Satisfação 👍 / 👎</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.positiveCount + stats.negativeCount === 0 ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center">
                    Nenhum feedback registrado ainda
                  </div>
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={160}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={14} data={radialData} startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{stats.satisfactionRate}%</span>
                      <span className="text-xs text-muted-foreground">positivo</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 text-center text-xs gap-1">
                      <div>
                        <div className="font-semibold text-chart-2">{stats.positiveCount}</div>
                        <div className="text-muted-foreground">👍</div>
                      </div>
                      <div>
                        <div className="font-semibold text-destructive">{stats.negativeCount}</div>
                        <div className="text-muted-foreground">👎</div>
                      </div>
                      <div>
                        <div className="font-semibold text-muted-foreground">{stats.noneCount}</div>
                        <div className="text-muted-foreground">sem</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Knowledge gaps table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top 10 Perguntas Sem Resposta</CardTitle>
            </CardHeader>
            <CardContent>
              {knowledgeGaps.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                  Nenhuma lacuna de conhecimento registrada
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledgeGaps.map((gap) => (
                    <div key={gap.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight line-clamp-2">{gap.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{new Date(gap.created_at).toLocaleDateString("pt-BR")}</span>
                          {gap.lang && <span className="text-xs text-muted-foreground uppercase">{gap.lang}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{gap.frequency}×</Badge>
                        <Badge
                          className={`text-xs ${gap.status === "resolved" ? "bg-chart-2/20 text-chart-2 border-chart-2/30" : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400"}`}
                          variant="outline"
                        >
                          {gap.status === "resolved" ? "resolvido" : "pendente"}
                        </Badge>
                        {gap.status !== "resolved" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" disabled={resolvingId === gap.id} onClick={() => handleResolve(gap.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Qualidade ──────────────────────────────────────────────── */}
        <TabsContent value="quality" className="space-y-6 mt-6">
          {/* Quality KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {qualityKpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="text-xs text-muted-foreground/70">{kpi.sub}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Score distribution mini chart */}
          {qualityStats.evaluatedCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribuição de Scores do Juiz</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={qualityStats.scoreDistribution} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, "Interações"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {qualityStats.scoreDistribution.map((entry, index) => (
                        <rect key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive inline-block" /> 0–1: Crítico</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-chart-3 inline-block" /> 2–3: Atenção</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-chart-2 inline-block" /> 4–5: OK</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleExportJsonl} disabled={exportingJsonl} className="gap-2">
              <Download className="w-4 h-4" />
              {exportingJsonl ? "Exportando..." : "Exportar Dataset JSONL"}
            </Button>
          </div>

          {/* Review list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Interações para Revisão
                <span className="ml-2 text-muted-foreground font-normal">(score ≤ 2 ou feedback negativo)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qualityItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-2">
                  <ShieldCheck className="w-8 h-8 text-chart-2" />
                  <span>Nenhuma interação problemática detectada ainda.</span>
                  <span className="text-xs">Configure o Webhook para ativar o Judge automático.</span>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedItems.map((item) => {
                      const verdict = item.judge_verdict ? VERDICT_CONFIG[item.judge_verdict] : null;
                      const isExpanded = expandedId === item.id;
                      const response = item.agent_response ?? "";
                      const truncated = response.length > 200 ? response.slice(0, 200) + "…" : response;

                      return (
                        <div
                          key={item.id}
                          className={`rounded-lg border p-3 transition-colors ${item.human_reviewed ? "bg-chart-2/5 border-chart-2/30" : "bg-muted/30 hover:bg-muted/50"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{item.user_message}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                                </span>
                                {item.judge_score !== null && (
                                  <Badge variant="outline" className={`text-xs ${SCORE_COLOR(item.judge_score)}`}>
                                    🔵 Gemini: {item.judge_score}/5
                                  </Badge>
                                )}
                                {item.judge_score_ds !== null && (
                                  <Badge variant="outline" className={`text-xs ${SCORE_COLOR(item.judge_score_ds)}`}>
                                    🟢 DS: {item.judge_score_ds}/5
                                  </Badge>
                                )}
                                {verdict && (
                                  <Badge variant="outline" className={`text-xs ${verdict.className}`}>
                                    {verdict.label}
                                  </Badge>
                                )}
                                {item.feedback === "negative" && (
                                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                                    👎 Negativo
                                  </Badge>
                                )}
                                {item.human_reviewed && (
                                  <Badge variant="outline" className="text-xs bg-chart-2/20 text-chart-2 border-chart-2/30">
                                    ✓ Revisado
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!item.human_reviewed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs gap-1"
                                  disabled={markingId === item.id}
                                  onClick={() => handleMarkOk(item.id)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Marcar como OK
                                </Button>
                              )}
                            </div>
                          </div>
                          {response && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {isExpanded ? response : truncated}
                              </p>
                              {response.length > 200 && (
                                <button
                                  className="text-xs text-primary mt-1 flex items-center gap-0.5 hover:underline"
                                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                >
                                  {isExpanded ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver mais</>}
                                </button>
                              )}
                            </div>
                          )}
                          {isExpanded && (item.judge_reason || item.judge_reason_ds) && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {item.judge_reason && (
                                <div className="p-2 rounded border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">🔵 Gemini</p>
                                  <p className="text-xs text-muted-foreground">{item.judge_reason}</p>
                                </div>
                              )}
                              {item.judge_reason_ds && (
                                <div className="p-2 rounded border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">🟢 DeepSeek</p>
                                  <p className="text-xs text-muted-foreground">{item.judge_reason_ds}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <span className="text-xs text-muted-foreground">
                        Página {currentPage + 1} de {totalPages} ({qualityItems.length} itens)
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                          Anterior
                        </Button>
                        <Button size="sm" variant="outline" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Webhook setup instructions */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                ⚡ Configuração do Webhook (ação manual necessária)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>Para ativar o Judge automático, configure o Webhook no Supabase Dashboard:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Acesse <strong>Database → Webhooks → New Webhook</strong></li>
                <li>Tabela: <code className="bg-muted px-1 rounded">agent_interactions</code> | Evento: <strong>UPDATE</strong></li>
                <li>URL: <code className="bg-muted px-1 rounded break-all">https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/evaluate-interaction</code></li>
              </ol>
              <p className="text-xs text-muted-foreground/70">
                O Judge avaliará cada resposta da L.I.A. automaticamente em background, sem impacto no tempo de resposta.
              </p>
            </CardContent>
          </Card>

          {/* Visão dual: Judge (qualidade de resposta) + Gaps (cobertura de conhecimento) */}
          <Card className="border-chart-3/30 bg-chart-3/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-chart-3" />
                  <div>
                    <p className="text-sm font-medium">Lacunas de Conhecimento Pendentes</p>
                    <p className="text-xs text-muted-foreground">
                      Perguntas que a L.I.A. não soube responder — complemento ao Score do Juiz
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-chart-3">{stats.pendingGapsCount}</p>
                  <p className="text-xs text-muted-foreground">ver em Visão Geral</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Indexação RAG ───────────────────────────────────────────── */}
        <TabsContent value="rag" className="space-y-6 mt-6">
          {/* Alert: RAG inativo */}
          {ragStats.totalChunks === 0 && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
              <AlertTitle className="text-destructive font-semibold">RAG Vetorial Inativo — 0 chunks indexados</AlertTitle>
              <AlertDescription className="text-destructive/80 space-y-2 mt-1">
                <p>A Dra. L.I.A. está operando <strong>sem busca semântica</strong>. Perguntas coloquiais e sinônimos não encontrarão conteúdo relevante, aumentando a taxa de alucinação estimada para ~34%.</p>
                <p className="font-medium">Para ativar:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Acesse <strong>Supabase Dashboard → Settings → Edge Functions → Secrets</strong></li>
                  <li>Adicione o secret <code className="bg-destructive/20 px-1 rounded font-mono text-xs">GOOGLE_AI_KEY</code></li>
                  <li>Obtenha sua chave em <strong>aistudio.google.com/app/apikey</strong></li>
                  <li>Clique em "Indexação Completa" abaixo</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}

          {/* Status KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{ragStats.totalChunks.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">Chunks Indexados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-chart-2/10">
                    <FileText className="w-5 h-5 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {ragStats.totalArticles > 0
                        ? `${Math.round((ragStats.indexedArticles / ragStats.totalArticles) * 100)}%`
                        : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">Cobertura Artigos</p>
                    <p className="text-xs text-muted-foreground/70">{ragStats.indexedArticles} / {ragStats.totalArticles}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-chart-3/10">
                    <Activity className="w-5 h-5 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {ragStats.lastIndexedAt
                        ? new Date(ragStats.lastIndexedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                        : "Nunca"}
                    </p>
                    <p className="text-xs text-muted-foreground">Última Indexação</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${ragStats.totalChunks > 0 ? "bg-chart-2/10" : "bg-destructive/10"}`}>
                    <Zap className={`w-5 h-5 ${ragStats.totalChunks > 0 ? "text-chart-2" : "text-destructive"}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${ragStats.totalChunks > 0 ? "text-chart-2" : "text-destructive"}`}>
                      {ragStats.totalChunks > 0 ? "✓ Ativo" : "✗ Inativo"}
                    </p>
                    <p className="text-xs text-muted-foreground">Status RAG</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribuição por tipo */}
          {ragStats.bySourceType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribuição por Tipo de Fonte</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { key: "article", label: "Artigos", icon: FileText, color: "bg-primary" },
                    { key: "video", label: "Vídeos", icon: Video, color: "bg-chart-3" },
                    { key: "resin", label: "Resinas", icon: FlaskConical, color: "bg-chart-2" },
                    { key: "parameter", label: "Parâmetros", icon: Settings2, color: "bg-chart-4" },
                    { key: "company_kb", label: "Empresa & Parcerias", icon: Building2, color: "bg-violet-500" },
                    { key: "catalog_product", label: "Produtos Catálogo", icon: ShoppingBag, color: "bg-amber-500" },
                  ].map(({ key, label, icon: Icon, color }) => {
                    const entry = ragStats.bySourceType.find((s) => s.source_type === key);
                    const count = entry?.count ?? 0;
                    const pct = ragStats.totalChunks > 0 ? Math.round((count / ragStats.totalChunks) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                        <Progress value={pct} className="flex-1 h-2" />
                        <span className="text-sm font-medium w-20 text-right shrink-0">{count.toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground">({pct}%)</span></span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações de indexação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ações de Indexação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A <strong>Indexação Completa</strong> apaga todos os embeddings e re-indexa tudo (artigos, vídeos, resinas, parâmetros, empresa &amp; parcerias, produtos do catálogo). A <strong>Incremental</strong> só indexa conteúdo novo ou modificado.
              </p>

              {/* Reindexação Seletiva por Categoria */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reindexar por Categoria</p>
                <p className="text-xs text-muted-foreground">Apaga e recria apenas os chunks da fonte selecionada — sem afetar as demais.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { stage: "articles", label: "Artigos", icon: FileText, key: "article" },
                    { stage: "videos", label: "Vídeos", icon: Video, key: "video" },
                    { stage: "resins", label: "Resinas", icon: FlaskConical, key: "resin" },
                    { stage: "parameters", label: "Parâmetros", icon: Settings2, key: "parameter" },
                    { stage: "company_kb", label: "Empresa & Parcerias", icon: Building2, key: "company_kb" },
                    { stage: "catalog_products", label: "Produtos Catálogo", icon: ShoppingBag, key: "catalog_product" },
                  ].map(({ stage, label, icon: Icon, key }) => {
                    const count = ragStats.bySourceType.find(s => s.source_type === key)?.count ?? 0;
                    const isLoading = stagingLoading === stage;
                    return (
                      <div key={stage} className="flex flex-col gap-1 rounded-md border border-border bg-card p-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium truncate">{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{count.toLocaleString("pt-BR")} chunks</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 mt-1"
                          disabled={!!stagingLoading || indexingLoading}
                          onClick={() => handleIndexingStage(stage)}
                        >
                          {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {isLoading ? "..." : "Reindexar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleIndexing("full")}
                  disabled={indexingLoading}
                  variant="default"
                  className="gap-2"
                >
                  {indexingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {indexingLoading ? "Indexando..." : "Indexação Completa"}
                </Button>
                <Button
                  onClick={() => handleIndexing("incremental")}
                  disabled={indexingLoading}
                  variant="outline"
                  className="gap-2"
                >
                  {indexingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Indexação Incremental
                </Button>
                <Button
                  onClick={fetchRAGStats}
                  disabled={indexingLoading}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar Status
                </Button>
              </div>

              {indexingLoading && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-muted-foreground">Indexando chunks — aguarde, pode levar alguns minutos...</p>
                  <Progress value={undefined} className="h-2 animate-pulse" />
                </div>
              )}

              {/* Resultado da última indexação */}
              {indexingResult && !indexingLoading && (
                <div className={`rounded-lg border p-4 mt-2 ${indexingResult.success ? "border-chart-2/30 bg-chart-2/10" : "border-destructive/30 bg-destructive/10"}`}>
                  {indexingResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-chart-2" />
                        <span className="text-sm font-medium text-chart-2">Indexação concluída com sucesso</span>
                        <Badge variant="outline" className="text-xs">{indexingResult.mode}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center text-sm">
                        <div>
                          <p className="font-bold text-lg">{indexingResult.indexed}</p>
                          <p className="text-xs text-muted-foreground">Indexados</p>
                        </div>
                        <div>
                          <p className="font-bold text-lg">{indexingResult.skipped}</p>
                          <p className="text-xs text-muted-foreground">Ignorados</p>
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${indexingResult.errors > 0 ? "text-destructive" : ""}`}>{indexingResult.errors}</p>
                          <p className="text-xs text-muted-foreground">Erros</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Falha na indexação</p>
                        <p className="text-xs text-muted-foreground mt-1">{indexingResult.error}</p>
                        {indexingResult.error?.includes("GOOGLE_AI_KEY") && (
                          <p className="text-xs text-muted-foreground mt-2">
                            👉 Configure <code className="bg-muted px-1 rounded">GOOGLE_AI_KEY</code> em{" "}
                            <a href="https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/settings/functions" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              Supabase → Settings → Edge Functions → Secrets
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instruções para GOOGLE_AI_KEY */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                🔑 Configurar GOOGLE_AI_KEY
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>A indexação usa a API de Embeddings do Google Gemini (<code className="bg-muted px-1 rounded">text-embedding-004</code>). Siga os passos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com/app/apikey</a> e crie uma chave</li>
                <li>No Supabase: <strong>Settings → Edge Functions → Secrets</strong></li>
                <li>Adicione o secret com nome exato: <code className="bg-muted px-1 rounded font-mono">GOOGLE_AI_KEY</code></li>
                <li>Clique em "Indexação Completa" acima para indexar os ~300 artigos</li>
              </ol>
              <p className="text-xs text-muted-foreground/70">
                A API do Google Gemini tem cota gratuita generosa — 1.500 req/minuto para embeddings no plano gratuito.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Auto-Heal ─────────────────────────────────────────────── */}
        <TabsContent value="autoheal" className="space-y-6 mt-6">
          {/* Painel de Ação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5 text-primary" />
                Curadoria de Memória da L.I.A.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Analisa as <strong>{stats.pendingGapsCount}</strong> lacunas pendentes, agrupa semanticamente e gera rascunhos de FAQ para revisão e indexação direta na memória semântica da Dra. L.I.A.
                  </p>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={healLoading || stats.pendingGapsCount === 0}
                  className="gap-2 shrink-0"
                >
                  {healLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Analisar Lacunas e Gerar Rascunhos
                </Button>
              </div>

              {autoHealCount > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-chart-2/5 border border-chart-2/20">
                  <Database className="w-4 h-4 text-chart-2 shrink-0" />
                  <p className="text-xs text-chart-2 font-medium">
                    A L.I.A. já absorveu <strong>{autoHealCount}</strong> tópico(s) técnico(s) via Auto-Heal
                  </p>
                </div>
              )}

              {healStep && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  {healLoading && <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />}
                  {!healLoading && <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />}
                  <p className="text-sm text-foreground">{healStep}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rascunhos Pendentes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Rascunhos Pendentes ({drafts.filter(d => d.status === 'draft').length})
            </h3>

            {drafts.filter(d => d.status === 'draft').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Sparkles className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum rascunho pendente.</p>
                  <p className="text-xs text-muted-foreground/70">Clique em "Analisar Lacunas e Gerar Rascunhos" para começar.</p>
                </CardContent>
              </Card>
            ) : (
              drafts.filter(d => d.status === 'draft').map((draft) => {
                const edited = editedDrafts[draft.id] ?? {};
                const currentFaqs = (edited.draft_faq ?? draft.draft_faq) as { q: string; a: string }[] | null ?? [];
                const hasDualModel = draft.ai_model_used === 'dual' && draft.draft_faq_ds;
                const dsFaqs = (draft.draft_faq_ds ?? []) as { q: string; a: string }[];
                return (
                  <Card key={draft.id} className="border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs text-primary border-primary/30">Rascunho IA</Badge>
                            {draft.ai_model_used === 'dual' && (
                              <Badge variant="outline" className="text-xs border-chart-2/30 text-chart-2">🔵 Gemini + 🟢 DeepSeek</Badge>
                            )}
                            {draft.ai_model_used === 'gemini' && (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:text-blue-400">🔵 Gemini</Badge>
                            )}
                            {draft.ai_model_used === 'deepseek' && (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-600 dark:text-green-400">🟢 DeepSeek</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{new Date(draft.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <Input
                            value={edited.draft_title ?? draft.draft_title}
                            onChange={(e) => updateDraftField(draft.id, 'draft_title', e.target.value)}
                            className="font-semibold text-base border-0 border-b rounded-none px-0 h-auto focus-visible:ring-0 focus-visible:border-primary"
                            placeholder="Título do artigo"
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Perguntas originais do cluster */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronRight className="w-3 h-3" />
                          {draft.cluster_questions.length} pergunta(s) original(is) do cluster
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="mt-2 space-y-1 pl-5">
                            {draft.cluster_questions.map((q, i) => (
                              <li key={i} className="text-xs text-muted-foreground list-disc">{q}</li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Dual Model Comparison or Single Model View */}
                      {hasDualModel ? (
                        <Tabs defaultValue="gemini" className="w-full">
                          <TabsList className="w-full grid grid-cols-2">
                            <TabsTrigger value="gemini" className="text-xs gap-1">🔵 Gemini (Principal)</TabsTrigger>
                            <TabsTrigger value="deepseek" className="text-xs gap-1">🟢 DeepSeek</TabsTrigger>
                          </TabsList>

                          {/* Gemini Tab */}
                          <TabsContent value="gemini" className="space-y-3 mt-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Resumo / Excerpt</label>
                              <Textarea
                                value={edited.draft_excerpt ?? draft.draft_excerpt}
                                onChange={(e) => updateDraftField(draft.id, 'draft_excerpt', e.target.value)}
                                className="min-h-[60px] text-sm"
                                placeholder="Resumo do artigo..."
                              />
                            </div>
                            {currentFaqs.length > 0 && (
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Pares de Pergunta & Resposta</label>
                                <Accordion type="multiple" className="w-full">
                                  {currentFaqs.map((faq, idx) => (
                                    <AccordionItem key={idx} value={`faq-gemini-${draft.id}-${idx}`}>
                                      <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                        <span className="text-left truncate pr-2">{faq.q || `Pergunta ${idx + 1}`}</span>
                                      </AccordionTrigger>
                                      <AccordionContent className="space-y-2 pb-3">
                                        <Input
                                          value={faq.q}
                                          onChange={(e) => {
                                            const updated = currentFaqs.map((f, i) => i === idx ? { ...f, q: e.target.value } : f);
                                            updateDraftField(draft.id, 'draft_faq', updated);
                                          }}
                                          placeholder="Pergunta..."
                                          className="text-sm"
                                        />
                                        <Textarea
                                          value={faq.a}
                                          onChange={(e) => {
                                            const updated = currentFaqs.map((f, i) => i === idx ? { ...f, a: e.target.value } : f);
                                            updateDraftField(draft.id, 'draft_faq', updated);
                                          }}
                                          placeholder="Resposta técnica..."
                                          className="min-h-[80px] text-sm"
                                        />
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              </div>
                            )}
                          </TabsContent>

                          {/* DeepSeek Tab */}
                          <TabsContent value="deepseek" className="space-y-3 mt-3">
                            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-3 space-y-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Título (DeepSeek)</label>
                                <p className="text-sm font-medium">{draft.draft_title_ds || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Resumo (DeepSeek)</label>
                                <p className="text-sm text-muted-foreground">{draft.draft_excerpt_ds || '—'}</p>
                              </div>
                              {dsFaqs.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">FAQs (DeepSeek) — somente leitura</label>
                                  <Accordion type="multiple" className="w-full">
                                    {dsFaqs.map((faq, idx) => (
                                      <AccordionItem key={idx} value={`faq-ds-${draft.id}-${idx}`}>
                                        <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                          <span className="text-left truncate pr-2">{faq.q || `Pergunta ${idx + 1}`}</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-3">
                                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{faq.a}</p>
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                  </Accordion>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground/70 italic">
                                💡 Para usar a versão DeepSeek, copie manualmente o conteúdo para a aba Gemini (editável) antes de indexar.
                              </p>
                            </div>
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <>
                          {/* Single model view (original) */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Resumo / Excerpt</label>
                            <Textarea
                              value={edited.draft_excerpt ?? draft.draft_excerpt}
                              onChange={(e) => updateDraftField(draft.id, 'draft_excerpt', e.target.value)}
                              className="min-h-[60px] text-sm"
                              placeholder="Resumo do artigo..."
                            />
                          </div>
                          {currentFaqs.length > 0 && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Pares de Pergunta & Resposta</label>
                              <Accordion type="multiple" className="w-full">
                                {currentFaqs.map((faq, idx) => (
                                  <AccordionItem key={idx} value={`faq-${draft.id}-${idx}`}>
                                    <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                      <span className="text-left truncate pr-2">{faq.q || `Pergunta ${idx + 1}`}</span>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2 pb-3">
                                      <Input
                                        value={faq.q}
                                        onChange={(e) => {
                                          const updated = currentFaqs.map((f, i) => i === idx ? { ...f, q: e.target.value } : f);
                                          updateDraftField(draft.id, 'draft_faq', updated);
                                        }}
                                        placeholder="Pergunta..."
                                        className="text-sm"
                                      />
                                      <Textarea
                                        value={faq.a}
                                        onChange={(e) => {
                                          const updated = currentFaqs.map((f, i) => i === idx ? { ...f, a: e.target.value } : f);
                                          updateDraftField(draft.id, 'draft_faq', updated);
                                        }}
                                        placeholder="Resposta técnica..."
                                        className="min-h-[80px] text-sm"
                                      />
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </div>
                          )}
                        </>
                      )}

                       {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleApproveDraft(draft.id)}
                          disabled={approvingId === draft.id || rejectingId === draft.id}
                          className="gap-2"
                        >
                          {approvingId === draft.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Indexar na L.I.A.
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleRejectDraft(draft.id)}
                          disabled={approvingId === draft.id || rejectingId === draft.id}
                          className="gap-2 text-muted-foreground hover:text-destructive"
                        >
                          {rejectingId === draft.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Descartar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Histórico */}
          {drafts.filter(d => d.status === 'approved' || d.status === 'rejected').length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {drafts.filter(d => d.status === 'approved' || d.status === 'rejected').map((draft) => (
                    <div key={draft.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{draft.draft_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(draft.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={draft.status === 'approved'
                            ? "text-chart-2 border-chart-2/30"
                            : "text-muted-foreground border-muted-foreground/30"
                          }
                        >
                          {draft.status === 'approved' ? '✓ Memória L.I.A.' : '✗ Descartado'}
                        </Badge>
                        {draft.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleReindexDraft(draft.id)}
                          >
                            <Brain className="w-3 h-3" />
                            Re-indexar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB: Alimentador ───────────────────────────────────────────── */}
        <TabsContent value="alimentador" className="mt-6">
          <AdminApostilaImporter />
        </TabsContent>
      </Tabs>
    </div>
  );
}

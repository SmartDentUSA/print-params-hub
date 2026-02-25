import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, FileText, AlertTriangle, TrendingUp, Clock, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number | null;
  status: string | null;
  lang: string | null;
  resolution_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  tema: string | null;
  rota: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  solicitado: "bg-amber-100 text-amber-800 border-amber-300",
  low_confidence: "bg-muted text-muted-foreground border-border",
  resolved: "bg-blue-100 text-blue-800 border-blue-300",
  publicado: "bg-green-100 text-green-800 border-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  solicitado: "Solicitado",
  low_confidence: "Baixa confiança",
  resolved: "Resolvido",
  publicado: "Publicado",
};

function extractTema(question: string): string {
  // Extract first meaningful words as topic
  const cleaned = question
    .replace(/^(como|what|how|qual|quais|por que|why|onde|where|quando|when|o que|que)\s+/i, "")
    .replace(/[?!.]/g, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 5);
  return words.join(" ");
}

function FreqBadge({ freq }: { freq: number }) {
  const cls = freq > 5
    ? "bg-red-100 text-red-800 border-red-300"
    : freq >= 3
    ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-green-100 text-green-800 border-green-300";
  return <Badge variant="outline" className={cls}>{freq}x</Badge>;
}

// ── Content Generation Modal (simplified, text-free mode) ──
function ContentGeneratorModal({
  open,
  onOpenChange,
  gap,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gap: KnowledgeGap | null;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [generatedFAQs, setGeneratedFAQs] = useState<Array<{ question: string; answer: string }> | null>(null);

  useEffect(() => {
    if (gap && open) {
      const t = gap.tema || extractTema(gap.question);
      setTitle(t);
      setExcerpt(`Conteúdo gerado a partir de pendência detectada pela Dra. LIA: "${gap.question}"`);
      setGeneratedHTML(null);
      setGeneratedFAQs(null);
    }
  }, [gap, open]);

  const handleGenerate = async () => {
    if (!title.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-orchestrate-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            excerpt: excerpt.trim(),
            activeSources: {
              rawText: true,
              pdfTranscription: false,
              videoTranscription: false,
              relatedPdfs: false,
            },
            sources: {
              rawText: `Pendência detectada pela assistente virtual Dra. LIA:\n\nPergunta original: "${gap?.question}"\nFrequência de solicitações: ${gap?.frequency || 1}\nIdioma: ${gap?.lang || "pt-BR"}\nRota de origem: ${gap?.rota || "não identificada"}\n\nGere um artigo completo e detalhado sobre este tema para a base de conhecimento.`,
              pdfTranscription: null,
              videoTranscription: null,
              relatedPdfs: [],
            },
            selectedResinIds: [],
            selectedProductIds: [],
            aiPrompt: "",
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data?.html) throw new Error("Nenhum HTML gerado");

      setGeneratedHTML(data.html);
      if (data.faqs && Array.isArray(data.faqs)) setGeneratedFAQs(data.faqs);
      toast.success("Conteúdo gerado! Revise e salve.");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedHTML || !gap) return;
    setIsSaving(true);
    try {
      const slug = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .substring(0, 80);

      // Get next order_index
      const { data: maxOrder } = await supabase
        .from("knowledge_contents")
        .select("order_index")
        .order("order_index", { ascending: false })
        .limit(1);

      const nextOrder = ((maxOrder?.[0]?.order_index || 0) + 1);

      const { data: newContent, error } = await supabase
        .from("knowledge_contents")
        .insert({
          title: title.trim(),
          slug,
          excerpt: excerpt.trim(),
          content_html: generatedHTML,
          category_id: "fc493982-ad8c-417f-9579-82786a97925a", // C - Ciência e tecnologia
          order_index: nextOrder,
          active: true,
          faqs: generatedFAQs || [],
        })
        .select("id")
        .single();

      if (error) throw error;

      // Update gap status to "publicado"
      await supabase
        .from("agent_knowledge_gaps")
        .update({
          status: "publicado",
          resolution_note: `Artigo publicado: ${newContent.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gap.id);

      toast.success(`Publicação "${title}" criada!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!gap) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Conteúdo — Pendência LIA
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            {/* Context */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="font-medium mb-1">📋 Pendência original:</p>
              <p className="text-muted-foreground">{gap.question}</p>
              {gap.rota && (
                <p className="text-xs text-muted-foreground mt-1">Rota: {gap.rota}</p>
              )}
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <Label>Título do artigo</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Resumo</Label>
                <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
              </div>
            </div>

            {!generatedHTML ? (
              <Button onClick={handleGenerate} disabled={isGenerating || !title.trim()} className="w-full">
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando conteúdo...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Gerar Conteúdo com IA</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-4 bg-card">
                  <p className="text-sm font-medium mb-2">✅ Conteúdo gerado ({generatedHTML.length.toLocaleString()} chars)</p>
                  {generatedFAQs && (
                    <Badge variant="secondary">{generatedFAQs.length} FAQs</Badge>
                  )}
                  <div
                    className="mt-3 prose prose-sm max-h-60 overflow-auto text-foreground"
                    dangerouslySetInnerHTML={{ __html: generatedHTML.substring(0, 2000) + "..." }}
                  />
                </div>

                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Salvar Publicação</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──
export function SmartOpsContentProduction() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"frequency" | "date">("frequency");
  const [selectedGap, setSelectedGap] = useState<KnowledgeGap | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchGaps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_knowledge_gaps")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      // Cast to include new columns (may not be in generated types yet)
      setGaps(data as unknown as KnowledgeGap[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGaps(); }, []);

  const filtered = useMemo(() => {
    let result = [...gaps];
    if (statusFilter !== "all") {
      result = result.filter((g) => g.status === statusFilter);
    }
    result.sort((a, b) => {
      if (sortBy === "frequency") return (b.frequency || 0) - (a.frequency || 0);
      return new Date(b.updated_at || "").getTime() - new Date(a.updated_at || "").getTime();
    });
    return result;
  }, [gaps, statusFilter, sortBy]);

  // Summary stats
  const openCount = gaps.filter((g) => g.status !== "resolved" && g.status !== "publicado").length;
  const recentCount = gaps.filter((g) => {
    if (!g.created_at) return false;
    return isAfter(new Date(g.created_at), subDays(new Date(), 7));
  }).length;

  // Top 3 themes by frequency
  const topThemes = useMemo(() => {
    const themeMap = new Map<string, number>();
    gaps.forEach((g) => {
      const t = g.tema || extractTema(g.question);
      themeMap.set(t, (themeMap.get(t) || 0) + (g.frequency || 1));
    });
    return [...themeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [gaps]);

  const handleOpenGenerator = (gap: KnowledgeGap) => {
    setSelectedGap(gap);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Pendências Abertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Novas (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{recentCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Top Temas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {topThemes.map(([theme, count], i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="truncate max-w-[180px]">{theme}</span>
                  <Badge variant="secondary" className="ml-2">{count}x</Badge>
                </div>
              ))}
              {topThemes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="low_confidence">Baixa confiança</SelectItem>
            <SelectItem value="solicitado">Solicitado</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "frequency" | "date")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="frequency">Mais solicitados</SelectItem>
            <SelectItem value="date">Mais recentes</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="outline">{filtered.length} registros</Badge>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Data Atualiz.</TableHead>
                <TableHead className="w-[160px]">Tema</TableHead>
                <TableHead className="w-[100px]">Rota</TableHead>
                <TableHead>Pendência</TableHead>
                <TableHead className="w-[90px] text-center">Solicit.</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[130px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((gap) => (
                <TableRow key={gap.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {gap.updated_at ? format(new Date(gap.updated_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium truncate max-w-[160px]">
                    {gap.tema || extractTema(gap.question)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {gap.rota || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[300px]">
                    <span className="line-clamp-2">{gap.question}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <FreqBadge freq={gap.frequency || 1} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[gap.status || "pending"] || STATUS_COLORS.pending}
                    >
                      {STATUS_LABELS[gap.status || "pending"] || gap.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {gap.status !== "publicado" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenGenerator(gap)}
                        className="gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        Gerar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma pendência encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Content Generator Modal */}
      <ContentGeneratorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        gap={selectedGap}
        onSuccess={fetchGaps}
      />
    </div>
  );
}

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Sparkles, FileText, AlertTriangle, TrendingUp, Star, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContentRequest {
  id: string;
  tema: string;
  pendencia_original: string;
  tipo_conteudo: string | null;
  prioridade: number | null;
  frequency: number | null;
  status: string | null;
  source_sessions: string[] | null;
  source_leads: string[] | null;
  produto_relacionado: string | null;
  resolution_note: string | null;
  published_content_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-amber-100 text-amber-800 border-amber-300",
  em_producao: "bg-blue-100 text-blue-800 border-blue-300",
  publicado: "bg-green-100 text-green-800 border-green-300",
  descartado: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  em_producao: "Em produção",
  publicado: "Publicado",
  descartado: "Descartado",
};

const TIPO_COLORS: Record<string, string> = {
  artigo: "bg-primary/10 text-primary border-primary/30",
  comparativo: "bg-purple-100 text-purple-800 border-purple-300",
  tutorial: "bg-cyan-100 text-cyan-800 border-cyan-300",
  faq: "bg-orange-100 text-orange-800 border-orange-300",
  ficha_tecnica: "bg-emerald-100 text-emerald-800 border-emerald-300",
  video: "bg-pink-100 text-pink-800 border-pink-300",
};

const TIPO_LABELS: Record<string, string> = {
  artigo: "Artigo",
  comparativo: "Comparativo",
  tutorial: "Tutorial",
  faq: "FAQ",
  ficha_tecnica: "Ficha Técnica",
  video: "Vídeo",
};

function PriorityStars({ priority }: { priority: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= priority ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function FreqBadge({ freq }: { freq: number }) {
  const cls = freq > 5
    ? "bg-red-100 text-red-800 border-red-300"
    : freq >= 3
    ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-green-100 text-green-800 border-green-300";
  return <Badge variant="outline" className={cls}>{freq}x</Badge>;
}

// ── Content Generation Modal ──
function ContentGeneratorModal({
  open, onOpenChange, request, onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ContentRequest | null;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [generatedFAQs, setGeneratedFAQs] = useState<Array<{ question: string; answer: string }> | null>(null);

  useEffect(() => {
    if (request && open) {
      setTitle(request.tema);
      setExcerpt(`Conteúdo gerado a partir de pendência real da Dra. LIA: "${request.pendencia_original}"`);
      setGeneratedHTML(null);
      setGeneratedFAQs(null);
    }
  }, [request, open]);

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
            activeSources: { rawText: true, pdfTranscription: false, videoTranscription: false, relatedPdfs: false },
            sources: {
              rawText: `Pendência detectada pela assistente virtual Dra. LIA:\n\nPendência original: "${request?.pendencia_original}"\nTema classificado: "${request?.tema}"\nTipo sugerido: ${request?.tipo_conteudo || "artigo"}\nProduto relacionado: ${request?.produto_relacionado || "não especificado"}\nFrequência de solicitações: ${request?.frequency || 1}\nLeads que pediram: ${request?.source_leads?.length || 0}\n\nGere um ${request?.tipo_conteudo || "artigo"} completo e detalhado sobre este tema para a base de conhecimento.`,
              pdfTranscription: null, videoTranscription: null, relatedPdfs: [],
            },
            selectedResinIds: [], selectedProductIds: [], aiPrompt: "",
          }),
        }
      );

      if (!response.ok) throw new Error(`Erro HTTP ${response.status}: ${await response.text()}`);
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
    if (!generatedHTML || !request) return;
    setIsSaving(true);
    try {
      const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").substring(0, 80);

      const { data: maxOrder } = await supabase
        .from("knowledge_contents").select("order_index")
        .order("order_index", { ascending: false }).limit(1);

      const nextOrder = ((maxOrder?.[0]?.order_index || 0) + 1);

      const { data: newContent, error } = await supabase
        .from("knowledge_contents")
        .insert({
          title: title.trim(), slug, excerpt: excerpt.trim(),
          content_html: generatedHTML,
          category_id: "fc493982-ad8c-417f-9579-82786a97925a",
          order_index: nextOrder, active: true, faqs: generatedFAQs || [],
        })
        .select("id").single();

      if (error) throw error;

      await supabase
        .from("content_requests")
        .update({
          status: "publicado",
          resolution_note: `Artigo publicado: ${newContent.id}`,
          published_content_id: newContent.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      toast.success(`Publicação "${title}" criada!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Conteúdo — Pendência Real
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="font-medium mb-1">📋 Pendência original (do resumo da LIA):</p>
              <p className="text-muted-foreground">{request.pendencia_original}</p>
              {request.produto_relacionado && (
                <p className="text-xs text-muted-foreground mt-1">Produto: {request.produto_relacionado}</p>
              )}
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className={TIPO_COLORS[request.tipo_conteudo || "artigo"]}>
                  {TIPO_LABELS[request.tipo_conteudo || "artigo"]}
                </Badge>
                <Badge variant="secondary">{request.source_leads?.length || 0} leads pediram</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div><Label>Título do artigo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Resumo</Label><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} /></div>
            </div>

            {!generatedHTML ? (
              <Button onClick={handleGenerate} disabled={isGenerating || !title.trim()} className="w-full">
                {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando conteúdo...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Conteúdo com IA</>}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-4 bg-card">
                  <p className="text-sm font-medium mb-2">✅ Conteúdo gerado ({generatedHTML.length.toLocaleString()} chars)</p>
                  {generatedFAQs && <Badge variant="secondary">{generatedFAQs.length} FAQs</Badge>}
                  <div className="mt-3 prose prose-sm max-h-60 overflow-auto text-foreground"
                    dangerouslySetInnerHTML={{ __html: generatedHTML.substring(0, 2000) + "..." }} />
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><FileText className="w-4 h-4 mr-2" /> Salvar Publicação</>}
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
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "frequency" | "date">("priority");
  const [selectedRequest, setSelectedRequest] = useState<ContentRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_requests")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setRequests(data as unknown as ContentRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = useMemo(() => {
    let result = [...requests];
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    result.sort((a, b) => {
      if (sortBy === "priority") return (b.prioridade || 0) - (a.prioridade || 0);
      if (sortBy === "frequency") return (b.frequency || 0) - (a.frequency || 0);
      return new Date(b.updated_at || "").getTime() - new Date(a.updated_at || "").getTime();
    });
    return result;
  }, [requests, statusFilter, sortBy]);

  const openCount = requests.filter((r) => r.status === "solicitado" || r.status === "em_producao").length;
  const highPriorityCount = requests.filter((r) => (r.prioridade || 0) >= 4 && r.status !== "publicado" && r.status !== "descartado").length;

  const topThemes = useMemo(() => {
    return [...requests]
      .filter((r) => r.status !== "publicado" && r.status !== "descartado")
      .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
      .slice(0, 3);
  }, [requests]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Pedidos Abertos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{openCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star className="w-4 h-4" /> Alta Prioridade (≥4)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{highPriorityCount}</p>
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
                {topThemes.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <span className="truncate max-w-[180px]">{r.tema}</span>
                    <Badge variant="secondary" className="ml-2">{r.frequency || 1}x</Badge>
                  </div>
                ))}
                {topThemes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty state info */}
        {!loading && requests.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Nenhum pedido de conteúdo ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Os pedidos são extraídos automaticamente dos resumos das conversas da Dra. LIA (campo PENDÊNCIAS).
                Conforme os leads conversam e a LIA identifica lacunas, os pedidos aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {requests.length > 0 && (
          <div className="flex gap-3 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="em_producao">Em produção</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "priority" | "frequency" | "date")}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Maior prioridade</SelectItem>
                <SelectItem value="frequency">Mais solicitados</SelectItem>
                <SelectItem value="date">Mais recentes</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline">{filtered.length} registros</Badge>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length > 0 && (
          <div className="border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[180px]">Tema</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Pendência</TableHead>
                  <TableHead className="w-[70px] text-center">Leads</TableHead>
                  <TableHead className="w-[70px] text-center">Freq.</TableHead>
                  <TableHead className="w-[100px] text-center">Prioridade</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {req.updated_at ? format(new Date(req.updated_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[180px]">
                      {req.tema}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TIPO_COLORS[req.tipo_conteudo || "artigo"] || TIPO_COLORS.artigo}>
                        {TIPO_LABELS[req.tipo_conteudo || "artigo"] || req.tipo_conteudo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[250px]">
                      <span className="line-clamp-2">{req.pendencia_original}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="gap-1">
                            <Users className="w-3 h-3" />
                            {req.source_leads?.length || 0}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {req.source_leads?.length ? req.source_leads.join(", ") : "Nenhum lead"}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      <FreqBadge freq={req.frequency || 1} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PriorityStars priority={req.prioridade || 1} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[req.status || "solicitado"] || STATUS_COLORS.solicitado}>
                        {STATUS_LABELS[req.status || "solicitado"] || req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {req.status !== "publicado" && req.status !== "descartado" && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedRequest(req); setModalOpen(true); }} className="gap-1">
                          <BookOpen className="w-3 h-3" /> Gerar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ContentGeneratorModal
          open={modalOpen} onOpenChange={setModalOpen}
          request={selectedRequest} onSuccess={fetchRequests}
        />
      </div>
    </TooltipProvider>
  );
}

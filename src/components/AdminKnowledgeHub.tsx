import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, Trophy, FileText, Trash2, Plus, Upload, ExternalLink } from "lucide-react";

// ────────────────────────────────────────────────────────────────────
// FAQ COMERCIAL
// ────────────────────────────────────────────────────────────────────
interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[] | null;
  product_refs: string[] | null;
  priority: number;
  active: boolean;
  view_count: number;
}

function FaqsTab() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "", tags: "", product_refs: "", priority: 0 });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commercial_faqs")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast({ title: "Erro ao carregar FAQs", description: error.message, variant: "destructive" });
    setRows((data as FaqRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast({ title: "Preencha pergunta e resposta", variant: "destructive" }); return;
    }
    const payload = {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      category: draft.category.trim() || null,
      tags: draft.tags.split(",").map((s) => s.trim()).filter(Boolean),
      product_refs: draft.product_refs.split(",").map((s) => s.trim()).filter(Boolean),
      priority: Number(draft.priority) || 0,
    };
    const { error } = await supabase.from("commercial_faqs").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "FAQ adicionada" });
    setDraft({ question: "", answer: "", category: "", tags: "", product_refs: "", priority: 0 });
    load();
  };

  const toggleActive = async (row: FaqRow) => {
    const { error } = await supabase.from("commercial_faqs").update({ active: !row.active }).eq("id", row.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta FAQ?")) return;
    const { error } = await supabase.from("commercial_faqs").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Nova FAQ</CardTitle>
          <CardDescription>Perguntas que clientes fazem antes/durante a compra. O Copilot consulta isso quando responde dúvidas comerciais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Pergunta</Label>
              <Input value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} placeholder="Ex: Qual a garantia do scanner Aoralscan 3?" />
            </div>
            <div className="md:col-span-2">
              <Label>Resposta</Label>
              <Textarea value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} rows={4} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="ex: garantia, instalação, treinamento" />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tags (vírgula)</Label>
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="garantia, suporte" />
            </div>
            <div>
              <Label>Produtos relacionados (SKUs, vírgula)</Label>
              <Input value={draft.product_refs} onChange={(e) => setDraft({ ...draft, product_refs: e.target.value })} placeholder="AOR3, IMP3D-W11" />
            </div>
          </div>
          <Button onClick={save}>Adicionar FAQ</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQs cadastradas ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma FAQ cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {r.category && <Badge variant="secondary">{r.category}</Badge>}
                        {r.priority > 0 && <Badge variant="outline">prio {r.priority}</Badge>}
                        <Badge variant="outline">{r.view_count} views</Badge>
                        {(r.tags || []).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                      <p className="font-semibold text-sm">{r.question}</p>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.answer}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FICHAS TÉCNICAS
// ────────────────────────────────────────────────────────────────────
interface ProductRow {
  product_id: string;
  name: string;
  category: string | null;
  datasheet_url: string | null;
  spec_sheet_url: string | null;
  manual_url: string | null;
  datasheet_summary: string | null;
}

function DatasheetsTab() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("products_catalog")
      .select("product_id,name,category,datasheet_url,spec_sheet_url,manual_url,datasheet_summary")
      .order("name")
      .limit(200);
    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setRows((data as ProductRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async (productId: string, field: "datasheet_url" | "spec_sheet_url" | "manual_url", file: File) => {
    setUploading(productId + field);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${productId}/${field}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-datasheets").upload(path, file, { upsert: true });
    if (upErr) { toast({ title: "Erro upload", description: upErr.message, variant: "destructive" }); setUploading(null); return; }
    const { data: pub } = supabase.storage.from("product-datasheets").getPublicUrl(path);
    const { error: updErr } = await supabase.from("products_catalog").update({ [field]: pub.publicUrl }).eq("product_id", productId);
    if (updErr) { toast({ title: "Erro update", description: updErr.message, variant: "destructive" }); }
    else { toast({ title: "Upload concluído" }); load(); }
    setUploading(null);
  };

  const updateUrl = async (productId: string, field: "datasheet_url" | "spec_sheet_url" | "manual_url", value: string) => {
    const { error } = await supabase.from("products_catalog").update({ [field]: value || null }).eq("product_id", productId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Buscar produto…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button onClick={load}>Buscar</Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.product_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription>{p.category} · {p.product_id}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {p.datasheet_url && <Badge>ficha</Badge>}
                    {p.spec_sheet_url && <Badge>spec</Badge>}
                    {p.manual_url && <Badge>manual</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["datasheet_url", "spec_sheet_url", "manual_url"] as const).map((field) => (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      {field === "datasheet_url" ? "Ficha técnica" : field === "spec_sheet_url" ? "Especificações" : "Manual"}
                    </Label>
                    <Input
                      value={p[field] || ""}
                      placeholder="URL ou faça upload abaixo"
                      onBlur={(e) => e.target.value !== (p[field] || "") && updateUrl(p.product_id, field, e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="application/pdf"
                        disabled={uploading === p.product_id + field}
                        onChange={(e) => e.target.files?.[0] && upload(p.product_id, field, e.target.files[0])}
                        className="text-xs"
                      />
                      {p[field] && (
                        <a href={p[field]!} target="_blank" rel="noopener noreferrer" className="text-primary">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// CASOS DE SUCESSO
// ────────────────────────────────────────────────────────────────────
interface StoryRow {
  id: string;
  slug: string;
  client_name: string;
  segment: string | null;
  challenge: string | null;
  solution: string | null;
  testimonial: string | null;
  products_used: string[] | null;
  published: boolean;
}

function SuccessStoriesTab() {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({
    client_name: "", slug: "", segment: "clinica", city: "", state: "",
    challenge: "", solution: "", testimonial: "", products_used: "", roi_meses: "", economia_mensal_brl: "",
  });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("success_stories").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setRows((data as StoryRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft.client_name.trim() || !draft.slug.trim()) {
      toast({ title: "Cliente e slug obrigatórios", variant: "destructive" }); return;
    }
    const results: Record<string, number> = {};
    if (draft.roi_meses) results.roi_meses = Number(draft.roi_meses);
    if (draft.economia_mensal_brl) results.economia_mensal_brl = Number(draft.economia_mensal_brl);
    const payload = {
      client_name: draft.client_name.trim(),
      slug: draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      segment: draft.segment || null,
      city: draft.city.trim() || null,
      state: draft.state.trim() || null,
      challenge: draft.challenge.trim() || null,
      solution: draft.solution.trim() || null,
      testimonial: draft.testimonial.trim() || null,
      products_used: draft.products_used.split(",").map((s) => s.trim()).filter(Boolean),
      results,
    };
    const { error } = await supabase.from("success_stories").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Caso adicionado" });
    setDraft({ client_name: "", slug: "", segment: "clinica", city: "", state: "", challenge: "", solution: "", testimonial: "", products_used: "", roi_meses: "", economia_mensal_brl: "" });
    load();
  };

  const togglePublish = async (row: StoryRow) => {
    const { error } = await supabase.from("success_stories")
      .update({ published: !row.published, published_at: !row.published ? new Date().toISOString() : null })
      .eq("id", row.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este caso?")) return;
    await supabase.from("success_stories").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Novo caso de sucesso</CardTitle>
          <CardDescription>O Copilot usa esses casos para social proof em vendas e a página /casos-de-sucesso renderiza os publicados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Input value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="clinica-x-sao-paulo" />
            </div>
            <div>
              <Label>Segmento</Label>
              <select className="w-full h-10 px-3 rounded-md border border-border bg-background"
                value={draft.segment} onChange={(e) => setDraft({ ...draft, segment: e.target.value })}>
                <option value="clinica">Clínica</option>
                <option value="laboratorio">Laboratório</option>
                <option value="dentista_solo">Dentista solo</option>
                <option value="rede">Rede</option>
                <option value="protetico">Protético</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cidade</Label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
              <div><Label>UF</Label><Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} maxLength={2} /></div>
            </div>
            <div className="md:col-span-2"><Label>Desafio</Label><Textarea value={draft.challenge} onChange={(e) => setDraft({ ...draft, challenge: e.target.value })} rows={2} /></div>
            <div className="md:col-span-2"><Label>Solução</Label><Textarea value={draft.solution} onChange={(e) => setDraft({ ...draft, solution: e.target.value })} rows={2} /></div>
            <div className="md:col-span-2"><Label>Depoimento (opcional)</Label><Textarea value={draft.testimonial} onChange={(e) => setDraft({ ...draft, testimonial: e.target.value })} rows={2} /></div>
            <div><Label>Produtos usados (vírgula)</Label><Input value={draft.products_used} onChange={(e) => setDraft({ ...draft, products_used: e.target.value })} placeholder="Aoralscan 3, Anycubic M3" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>ROI (meses)</Label><Input type="number" value={draft.roi_meses} onChange={(e) => setDraft({ ...draft, roi_meses: e.target.value })} /></div>
              <div><Label>Economia/mês (R$)</Label><Input type="number" value={draft.economia_mensal_brl} onChange={(e) => setDraft({ ...draft, economia_mensal_brl: e.target.value })} /></div>
            </div>
          </div>
          <Button onClick={save}>Adicionar caso</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Casos cadastrados ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso ainda.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {r.segment && <Badge variant="secondary">{r.segment}</Badge>}
                      {r.published && <Badge>publicado</Badge>}
                      {(r.products_used || []).map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                    </div>
                    <p className="font-semibold text-sm">{r.client_name}</p>
                    {r.challenge && <p className="text-xs text-muted-foreground mt-1"><strong>Desafio:</strong> {r.challenge}</p>}
                    {r.solution && <p className="text-xs text-muted-foreground"><strong>Solução:</strong> {r.solution}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={r.published} onCheckedChange={() => togglePublish(r)} />
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────
export function AdminKnowledgeHub() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Knowledge Hub</h2>
        <p className="text-sm text-muted-foreground">Alimente o Copilot com FAQs, fichas técnicas e casos de sucesso reais. Tudo aqui vira contexto que o agente consulta antes de responder.</p>
      </div>
      <Tabs defaultValue="faqs">
        <TabsList>
          <TabsTrigger value="faqs"><HelpCircle className="w-4 h-4 mr-2" /> FAQs Comerciais</TabsTrigger>
          <TabsTrigger value="datasheets"><FileText className="w-4 h-4 mr-2" /> Fichas Técnicas</TabsTrigger>
          <TabsTrigger value="stories"><Trophy className="w-4 h-4 mr-2" /> Casos de Sucesso</TabsTrigger>
        </TabsList>
        <TabsContent value="faqs" className="mt-4"><FaqsTab /></TabsContent>
        <TabsContent value="datasheets" className="mt-4"><DatasheetsTab /></TabsContent>
        <TabsContent value="stories" className="mt-4"><SuccessStoriesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminKnowledgeHub;
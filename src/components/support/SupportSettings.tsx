import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";

type Table = "support_ticket_categories" | "support_ticket_types" | "support_diagnostic_checklists" | "support_quick_replies";
type Field = { key: string; label: string; type: "text" | "textarea" | "number" | "bool" | "select"; options?: { value: string; label: string }[]; required?: boolean };
type Row = Record<string, any>;

const STAGES = ["Captura digital", "CAD / Planejamento", "Impressão 3D", "Pós-processamento", "Finalização", "Instalação / Entrega", "Pós-venda"];
const stageOpts = [{ value: "", label: "—" }, ...STAGES.map((s, i) => ({ value: String(i + 1), label: `${i + 1}. ${s}` }))];

function useRows(table: Table, order: string) {
  return useQuery({
    queryKey: ["support-settings", table],
    queryFn: async () => {
      const { data, error } = await (supabase.from(table) as any).select("*").order(order);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function Section({ table, title, fields, rows, summary, order }: { table: Table; title: string; fields: Field[]; rows: Row[]; summary: (r: Row) => React.ReactNode; order: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!edit) return;
    const missing = fields.find((f) => f.required && !String(edit[f.key] ?? "").trim());
    if (missing) return toast({ title: `Preencha “${missing.label}”`, variant: "destructive" });
    const payload: Row = {};
    for (const f of fields) {
      let v = edit[f.key];
      if (f.type === "number" || (f.type === "select" && f.key === "workflow_stage")) v = v === "" || v == null ? null : Number(v);
      else if (f.type === "select" && v === "") v = null;
      else if (f.type === "text" || f.type === "textarea") v = v?.toString().trim() || (f.required ? v : null);
      payload[f.key] = v;
    }
    if (table === "support_diagnostic_checklists" && typeof payload.options === "string") {
      payload.options = (payload.options as string).split(",").map((s) => s.trim()).filter(Boolean);
    }
    setSaving(true);
    const q = supabase.from(table) as any;
    const { error } = edit.id ? await q.update(payload).eq("id", edit.id) : await q.insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: "Salvo" });
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["support-settings"] });
  };

  const toggle = async (r: Row) => {
    const { error } = await (supabase.from(table) as any).update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["support-settings", table] });
  };

  const remove = async (r: Row) => {
    if (!confirm("Excluir este item? Prefira desativar se já foi usado em chamados.")) return;
    const { error } = await (supabase.from(table) as any).delete().eq("id", r.id);
    if (error) return toast({ title: "Não foi possível excluir", description: "Item em uso — desative em vez de excluir.", variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["support-settings", table] });
  };

  const blank = () => {
    const r: Row = { is_active: true };
    fields.forEach((f) => (r[f.key] = f.type === "bool" ? false : f.key === "sort_order" ? rows.length + 1 : ""));
    if (table === "support_ticket_types") r.default_priority = "normal";
    if (table === "support_diagnostic_checklists") { r.answer_type = "text"; r.use_in_ai = true; }
    return r;
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">{title} <span className="text-sm text-muted-foreground">({rows.length})</span></h3>
        <Button size="sm" onClick={() => setEdit(blank())}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado ainda.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.is_active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">{summary(r)}</div>
              <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label="Ativo" />
              <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r, options: Array.isArray(r.options) ? r.options.join(", ") : r.options, workflow_stage: r.workflow_stage ?? "" })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Novo"} — {title}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  {f.type === "bool" ? (
                    <div className="flex items-center justify-between"><Label>{f.label}</Label><Switch checked={!!edit[f.key]} onCheckedChange={(v) => setEdit({ ...edit, [f.key]: v })} /></div>
                  ) : (
                    <>
                      <Label>{f.label}{f.required && " *"}</Label>
                      {f.type === "textarea" ? (
                        <Textarea rows={4} value={edit[f.key] ?? ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                      ) : f.type === "select" ? (
                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={edit[f.key] ?? ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>
                          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <Input type={f.type === "number" ? "number" : "text"} value={edit[f.key] ?? ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Cascata Categoria → Subcategoria → Produto (portfólio products_catalog) ----
type PortfolioItem = { category: string | null; subcategory: string | null; name: string | null };

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

function usePortfolio() {
  return useQuery({
    queryKey: ["support-settings", "portfolio"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products_catalog") as any).select("category, subcategory, name");
      if (error) throw error;
      return (data ?? []) as PortfolioItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Dedup case-insensitive, mantendo o rótulo mais comum/bem formatado. */
function distinctLabels(items: PortfolioItem[], pick: (p: PortfolioItem) => string | null): string[] {
  const map = new Map<string, string>();
  for (const p of items) {
    const raw = pick(p)?.trim();
    if (!raw) continue;
    const k = norm(raw);
    const prev = map.get(k);
    if (!prev || (prev === prev.toUpperCase() && raw !== raw.toUpperCase())) map.set(k, raw);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function CategorySection({ rows }: { rows: Row[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const portfolio = usePortfolio();
  const items = portfolio.data ?? [];
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const catName = (id?: string | null) => rows.find((c) => c.id === id)?.name;
  const parentOpts = rows.filter((c) => !c.parent_id);

  const prodCats = distinctLabels(items, (p) => p.category);
  const subcatsFor = (cat: string) => distinctLabels(items.filter((p) => norm(p.category) === norm(cat)), (p) => p.subcategory);
  const productsFor = (cat: string, sub: string) =>
    distinctLabels(items.filter((p) => norm(p.category) === norm(cat) && (!sub || norm(p.subcategory) === norm(sub))), (p) => p.name);

  const save = async () => {
    if (!edit) return;
    if (!String(edit.name ?? "").trim()) return toast({ title: "Preencha o nome", variant: "destructive" });
    const payload: Row = {
      name: edit.name.trim(),
      parent_id: edit.parent_id || null,
      product_category: edit.product_category || null,
      product_subcategory: edit.product_subcategory || null,
      product_name: edit.product_name || null,
      workflow_stage: edit.workflow_stage === "" || edit.workflow_stage == null ? null : Number(edit.workflow_stage),
      description: edit.description?.trim() || null,
      sort_order: edit.sort_order === "" || edit.sort_order == null ? null : Number(edit.sort_order),
    };
    setSaving(true);
    const q = supabase.from("support_ticket_categories") as any;
    const { error } = edit.id ? await q.update(payload).eq("id", edit.id) : await q.insert({ ...payload, is_active: true });
    setSaving(false);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: "Salvo" });
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["support-settings", "support_ticket_categories"] });
  };

  const toggle = async (r: Row) => {
    await (supabase.from("support_ticket_categories") as any).update({ is_active: !r.is_active }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["support-settings", "support_ticket_categories"] });
  };

  const remove = async (r: Row) => {
    if (!confirm("Excluir esta categoria? Prefira desativar se já foi usada em chamados.")) return;
    const { error } = await (supabase.from("support_ticket_categories") as any).delete().eq("id", r.id);
    if (error) return toast({ title: "Não foi possível excluir", description: "Item em uso — desative em vez de excluir.", variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["support-settings", "support_ticket_categories"] });
  };

  const sel = "h-10 w-full rounded-md border bg-background px-3 text-sm";

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Categorias e subcategorias <span className="text-sm text-muted-foreground">({rows.length})</span></h3>
        <Button size="sm" onClick={() => setEdit({ name: "", parent_id: "", product_category: "", product_subcategory: "", product_name: "", workflow_stage: "", description: "", sort_order: rows.length + 1 })}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.is_active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.parent_id ? <span className="text-muted-foreground">{catName(r.parent_id)} ↳ </span> : null}{r.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.workflow_stage && <Badge variant="secondary">Etapa {r.workflow_stage}: {STAGES[r.workflow_stage - 1]}</Badge>}
                  {r.product_category && <Badge variant="outline">{r.product_category}{r.product_subcategory ? ` / ${r.product_subcategory}` : ""}{r.product_name ? ` / ${r.product_name}` : ""}</Badge>}
                </div>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label="Ativo" />
              <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r, parent_id: r.parent_id ?? "", product_category: r.product_category ?? "", product_subcategory: r.product_subcategory ?? "", product_name: r.product_name ?? "", workflow_stage: r.workflow_stage ?? "" })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Nova"} — Categoria</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Categoria pai (deixe vazio para principal)</Label>
                <select className={sel} value={edit.parent_id ?? ""} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value })}>
                  <option value="">— Categoria principal —</option>
                  {parentOpts.filter((p) => p.id !== edit.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Vínculo com o portfólio de produtos</p>
                <div className="space-y-1">
                  <Label>Categoria de produto</Label>
                  <select className={sel} value={edit.product_category ?? ""} onChange={(e) => setEdit({ ...edit, product_category: e.target.value, product_subcategory: "", product_name: "" })}>
                    <option value="">— Nenhuma —</option>
                    {prodCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {edit.product_category && (
                  <div className="space-y-1">
                    <Label>Subcategoria de produto</Label>
                    <select className={sel} value={edit.product_subcategory ?? ""} onChange={(e) => setEdit({ ...edit, product_subcategory: e.target.value, product_name: "" })}>
                      <option value="">— Todas —</option>
                      {subcatsFor(edit.product_category).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {edit.product_category && (
                  <div className="space-y-1">
                    <Label>Produto do portfólio</Label>
                    <select className={sel} value={edit.product_name ?? ""} onChange={(e) => setEdit({ ...edit, product_name: e.target.value })}>
                      <option value="">— Todos os produtos —</option>
                      {productsFor(edit.product_category, edit.product_subcategory).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Etapa do fluxo digital (7 etapas)</Label>
                <select className={sel} value={edit.workflow_stage ?? ""} onChange={(e) => setEdit({ ...edit, workflow_stage: e.target.value })}>
                  {stageOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ordem</Label>
                <Input type="number" value={edit.sort_order ?? ""} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SupportSettings() {
  const cats = useRows("support_ticket_categories", "sort_order");
  const types = useRows("support_ticket_types", "sort_order");
  const checks = useRows("support_diagnostic_checklists", "sort_order");
  const replies = useRows("support_quick_replies", "title");

  const catRows = cats.data ?? [];
  const typeRows = types.data ?? [];
  const catName = (id?: string | null) => catRows.find((c) => c.id === id)?.name;
  const typeName = (id?: string | null) => typeRows.find((t) => t.id === id)?.name;
  const catOpts = [{ value: "", label: "— Nenhuma —" }, ...catRows.map((c) => ({ value: c.id, label: c.parent_id ? `  ↳ ${c.name}` : c.name }))];
  const parentOpts = [{ value: "", label: "— Categoria principal —" }, ...catRows.filter((c) => !c.parent_id).map((c) => ({ value: c.id, label: c.name }))];
  const typeOpts = [{ value: "", label: "— Todos —" }, ...typeRows.map((t) => ({ value: t.id, label: t.name }))];

  if (cats.error) return <p className="text-sm text-destructive">Não foi possível carregar as configurações: {(cats.error as Error).message}</p>;

  return (
    <Tabs defaultValue="cats">
      <TabsList>
        <TabsTrigger value="cats">Categorias</TabsTrigger>
        <TabsTrigger value="types">Tipos de chamado</TabsTrigger>
        <TabsTrigger value="checks">Perguntas de diagnóstico</TabsTrigger>
        <TabsTrigger value="replies">Respostas rápidas</TabsTrigger>
      </TabsList>

      <TabsContent value="cats" className="mt-4">
        <Section table="support_ticket_categories" title="Categorias e subcategorias" order="sort_order" rows={catRows}
          fields={[
            { key: "name", label: "Nome", type: "text", required: true },
            { key: "parent_id", label: "Categoria pai (deixe vazio para principal)", type: "select", options: parentOpts },
            { key: "product_category", label: "Categoria de produto", type: "text" },
            { key: "product_subcategory", label: "Subcategoria de produto", type: "text" },
            { key: "workflow_stage", label: "Etapa do fluxo digital (7 etapas)", type: "select", options: stageOpts },
            { key: "description", label: "Descrição", type: "textarea" },
            { key: "sort_order", label: "Ordem", type: "number" },
          ]}
          summary={(r) => (
            <div>
              <p className="font-medium">{r.parent_id ? <span className="text-muted-foreground">{catName(r.parent_id)} ↳ </span> : null}{r.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.workflow_stage && <Badge variant="secondary">Etapa {r.workflow_stage}: {STAGES[r.workflow_stage - 1]}</Badge>}
                {r.product_category && <Badge variant="outline">{r.product_category}{r.product_subcategory ? ` / ${r.product_subcategory}` : ""}</Badge>}
              </div>
            </div>
          )} />
      </TabsContent>

      <TabsContent value="types" className="mt-4">
        <Section table="support_ticket_types" title="Tipos de chamado" order="sort_order" rows={typeRows}
          fields={[
            { key: "name", label: "Nome", type: "text", required: true },
            { key: "category_id", label: "Categoria", type: "select", options: catOpts },
            { key: "default_priority", label: "Prioridade padrão", type: "select", options: [{ value: "baixa", label: "Baixa" }, { value: "normal", label: "Normal" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" }] },
            { key: "sla_first_response_minutes", label: "SLA 1ª resposta (minutos)", type: "number" },
            { key: "sla_resolution_hours", label: "SLA resolução (horas)", type: "number" },
            { key: "requires_serial", label: "Exige número de série", type: "bool" },
            { key: "ai_guidance", label: "Orientação para a IA (como diagnosticar/avaliar)", type: "textarea" },
            { key: "description", label: "Descrição", type: "textarea" },
            { key: "sort_order", label: "Ordem", type: "number" },
          ]}
          summary={(r) => (
            <div>
              <p className="font-medium">{r.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {catName(r.category_id) && <Badge variant="outline">{catName(r.category_id)}</Badge>}
                <Badge variant="secondary">Prioridade {r.default_priority}</Badge>
                {r.sla_first_response_minutes && <Badge variant="outline">1ª resp. {r.sla_first_response_minutes} min</Badge>}
                {r.sla_resolution_hours && <Badge variant="outline">Resolução {r.sla_resolution_hours} h</Badge>}
                {r.requires_serial && <Badge>Exige série</Badge>}
                {r.ai_guidance && <Badge variant="outline">Guia IA</Badge>}
              </div>
            </div>
          )} />
      </TabsContent>

      <TabsContent value="checks" className="mt-4">
        <Section table="support_diagnostic_checklists" title="Perguntas de diagnóstico inicial" order="sort_order" rows={checks.data ?? []}
          fields={[
            { key: "question", label: "Pergunta", type: "textarea", required: true },
            { key: "category_id", label: "Categoria", type: "select", options: catOpts },
            { key: "ticket_type_id", label: "Tipo de chamado", type: "select", options: typeOpts },
            { key: "answer_type", label: "Tipo de resposta", type: "select", options: [{ value: "text", label: "Texto livre" }, { value: "yes_no", label: "Sim / Não" }, { value: "choice", label: "Múltipla escolha" }, { value: "number", label: "Número" }, { value: "photo", label: "Foto / vídeo" }] },
            { key: "options", label: "Opções (separadas por vírgula, para múltipla escolha)", type: "text" },
            { key: "is_required", label: "Obrigatória", type: "bool" },
            { key: "use_in_ai", label: "A IA usa esta pergunta no diagnóstico", type: "bool" },
            { key: "sort_order", label: "Ordem", type: "number" },
          ]}
          summary={(r) => (
            <div>
              <p className="font-medium">{r.question}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {catName(r.category_id) && <Badge variant="outline">{catName(r.category_id)}</Badge>}
                {typeName(r.ticket_type_id) && <Badge variant="outline">{typeName(r.ticket_type_id)}</Badge>}
                {r.is_required && <Badge variant="secondary">Obrigatória</Badge>}
                {r.use_in_ai && <Badge>IA</Badge>}
              </div>
            </div>
          )} />
      </TabsContent>

      <TabsContent value="replies" className="mt-4">
        <Section table="support_quick_replies" title="Respostas rápidas" order="title" rows={replies.data ?? []}
          fields={[
            { key: "title", label: "Título", type: "text", required: true },
            { key: "shortcut", label: "Atalho (ex.: /boasvindas)", type: "text" },
            { key: "category", label: "Grupo (Boas-vindas, Retorno, Encerramento…)", type: "text" },
            { key: "body", label: "Mensagem", type: "textarea", required: true },
          ]}
          summary={(r) => (
            <div>
              <p className="font-medium">{r.title} {r.shortcut && <span className="font-mono text-xs text-muted-foreground">{r.shortcut}</span>}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
              {r.category && <Badge variant="outline" className="mt-1">{r.category}</Badge>}
            </div>
          )} />
      </TabsContent>
    </Tabs>
  );
}

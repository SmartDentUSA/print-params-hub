import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Users, RefreshCw, Copy } from "lucide-react";
import { AudienceDefinition, AudienceRule, DIST_RULES, FIELD_OPS, LEAD_RULES, RuleType, uid } from "./types";

const db = supabase as any;

interface Options {
  columns: { name: string; type: string }[];
  pipelines: { pipeline: string; stage: string }[];
  origins: string[];
  forms: string[];
  campaigns: string[];
}

function ListInput({ value, onChange, options, placeholder }: { value: string[]; onChange: (v: string[]) => void; options?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const listId = useMemo(() => `dl-${uid()}`, []);
  const add = (v: string) => { const t = v.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(""); };
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <Input list={listId} value={draft} placeholder={placeholder || "Digite e pressione Enter"} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} className="h-8 text-xs" />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => add(draft)}><Plus className="w-3 h-3" /></Button>
      </div>
      {options && <datalist id={listId}>{options.slice(0, 300).map((o) => <option key={o} value={o} />)}</datalist>}
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <Badge key={v} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => onChange(value.filter((x) => x !== v))}>{v} ✕</Badge>
        ))}
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange, options, courses }: { rule: AudienceRule; onChange: (r: AudienceRule) => void; options: Options | null; courses: any[] }) {
  const set = (p: Partial<AudienceRule>) => onChange({ ...rule, ...p });
  const pipelines = [...new Set((options?.pipelines || []).map((p) => p.pipeline))];
  const stages = [...new Set((options?.pipelines || []).filter((p) => !rule.pipeline || p.pipeline === rule.pipeline).map((p) => p.stage))];
  const dates = (
    <div className="grid grid-cols-2 gap-2">
      <div><Label className="text-[10px]">De</Label><Input type="date" className="h-8 text-xs" value={rule.from || ""} onChange={(e) => set({ from: e.target.value })} /></div>
      <div><Label className="text-[10px]">Até</Label><Input type="date" className="h-8 text-xs" value={rule.to || ""} onChange={(e) => set({ to: e.target.value })} /></div>
    </div>
  );
  const pipeStage = (
    <div className="grid grid-cols-2 gap-2">
      <div><Label className="text-[10px]">Funil</Label>
        <Input list="dl-pipes" className="h-8 text-xs" value={rule.pipeline || ""} onChange={(e) => set({ pipeline: e.target.value })} placeholder="Qualquer funil" />
        <datalist id="dl-pipes">{pipelines.map((p) => <option key={p} value={p} />)}</datalist></div>
      <div><Label className="text-[10px]">Etapa</Label>
        <Input list={`dl-st-${rule.id}`} className="h-8 text-xs" value={rule.stage || ""} onChange={(e) => set({ stage: e.target.value })} placeholder="Qualquer etapa" />
        <datalist id={`dl-st-${rule.id}`}>{stages.map((s) => <option key={s} value={s} />)}</datalist></div>
    </div>
  );
  switch (rule.type) {
    case "created_between": return dates;
    case "form": return <div className="space-y-2"><ListInput value={rule.values || []} onChange={(v) => set({ values: v })} options={options?.forms} placeholder="Nome do formulário" /><div className="text-[10px] text-muted-foreground">Período do envio (opcional)</div>{dates}</div>;
    case "campaign": return <ListInput value={rule.values || []} onChange={(v) => set({ values: v })} options={options?.campaigns} placeholder="Nome da campanha" />;
    case "origin": return <ListInput value={rule.values || []} onChange={(v) => set({ values: v })} options={options?.origins} placeholder="Origem" />;
    case "pipeline": return (
      <div className="space-y-2">{pipeStage}
        <Select value={rule.status || "any"} onValueChange={(v) => set({ status: v === "any" ? "" : v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="any">Qualquer situação</SelectItem><SelectItem value="aberta">Aberto</SelectItem><SelectItem value="ganha">Ganho</SelectItem><SelectItem value="perdida">Perdido</SelectItem></SelectContent>
        </Select></div>);
    case "stage_entered": return <div className="space-y-2">{pipeStage}{dates}</div>;
    case "training": return (
      <div className="grid grid-cols-2 gap-2">
        <Select value={rule.course_id || "any"} onValueChange={(v) => set({ course_id: v === "any" ? "" : v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent><SelectItem value="any">Qualquer curso</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="h-8 text-xs" placeholder="Situação (ex.: confirmado)" value={rule.status || ""} onChange={(e) => set({ status: e.target.value })} />
      </div>);
    case "equipment_won": return <div className="space-y-1"><div className="text-[10px] text-muted-foreground">Termos do equipamento (ex.: scanner, impressora, Medit, INO200, exocad)</div><ListInput value={rule.values || []} onChange={(v) => set({ values: v })} /></div>;
    case "resin_buyer": return <div className="space-y-1"><div className="text-[10px] text-muted-foreground">Vazio = qualquer resina. Ou liste resinas específicas.</div><ListInput value={rule.values || []} onChange={(v) => set({ values: v })} placeholder="Ex.: Vitality, Smart Print Bio" /></div>;
    case "field": return (
      <div className="grid grid-cols-3 gap-2">
        <Input list="dl-cols" className="h-8 text-xs" placeholder="Campo" value={rule.column || ""} onChange={(e) => set({ column: e.target.value })} />
        <datalist id="dl-cols">{(options?.columns || []).map((c) => <option key={c.name} value={c.name}>{c.type}</option>)}</datalist>
        <Select value={rule.op || "eq"} onValueChange={(v) => set({ op: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FIELD_OPS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
        {!["is_null", "not_null", "is_true", "is_false"].includes(rule.op || "eq") && <Input className="h-8 text-xs" placeholder="Valor" value={rule.value || ""} onChange={(e) => set({ value: e.target.value })} />}
      </div>);
    case "dist_country": case "dist_state": case "dist_tipo":
      return <ListInput value={rule.values || []} onChange={(v) => set({ values: v })} />;
    case "dist_active":
      return <Select value={rule.value || "true"} onValueChange={(v) => set({ value: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Ativos</SelectItem><SelectItem value="false">Inativos</SelectItem></SelectContent></Select>;
  }
  return null;
}

export function AudienceBuilder({ onSaved }: { onSaved?: () => void }) {
  const [audiences, setAudiences] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<"leads" | "distributors">("leads");
  const [def, setDef] = useState<AudienceDefinition>({ match: "all", rules: [] });
  const [options, setOptions] = useState<Options | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [count, setCount] = useState<any>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [counting, setCounting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await db.from("email_audiences").select("*").order("updated_at", { ascending: false });
    setAudiences(data || []);
  };
  useEffect(() => {
    load();
    db.rpc("fn_email_audience_options").then(({ data }: any) => setOptions(data));
    db.from("smartops_courses").select("id, title").order("title").then(({ data }: any) => setCourses(data || []));
  }, []);

  const fullDef = () => ({ ...def, source });

  const runCount = async () => {
    setCounting(true);
    const [c, p] = await Promise.all([
      db.rpc("fn_audience_count", { _def: fullDef() }),
      db.rpc("fn_audience_resolve", { _def: fullDef(), _limit: 20, _offset: 0 }),
    ]);
    setCounting(false);
    if (c.error) return toast.error(c.error.message);
    setCount(c.data); setPreview(p.data || []);
  };

  const reset = () => { setEditingId(null); setName(""); setDescription(""); setSource("leads"); setDef({ match: "all", rules: [] }); setCount(null); setPreview([]); };

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao público");
    setSaving(true);
    const row = { name, description, source, definition: def, last_count: count?.total ?? null, last_counted_at: count ? new Date().toISOString() : null };
    const res = editingId ? await db.from("email_audiences").update(row).eq("id", editingId) : await db.from("email_audiences").insert(row);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Público salvo");
    reset(); load(); onSaved?.();
  };

  const edit = (a: any, copy = false) => {
    setEditingId(copy ? null : a.id); setName(copy ? `${a.name} (cópia)` : a.name); setDescription(a.description || "");
    setSource(a.source || "leads"); setDef(a.definition || { match: "all", rules: [] }); setCount(null); setPreview([]);
  };

  const ruleCatalog = source === "distributors" ? DIST_RULES : LEAD_RULES;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> {editingId ? "Editar público" : "Novo público"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Compradores de resina SP" /></div>
            <div><Label className="text-xs">Quem recebe</Label>
              <Select value={source} onValueChange={(v: any) => { setSource(v); setDef({ match: "all", rules: [] }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="leads">Leads / clientes</SelectItem><SelectItem value="distributors">Distribuidores</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div><Label className="text-xs">Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>

          <div className="flex items-center gap-2 text-xs">
            Incluir quem atende
            <Select value={def.match} onValueChange={(v: any) => setDef({ ...def, match: v })}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">todas as regras</SelectItem><SelectItem value="any">qualquer regra</SelectItem></SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {def.rules.map((r, i) => (
              <div key={r.id} className="border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{ruleCatalog.find((x) => x.type === r.type)?.label}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setDef({ ...def, rules: def.rules.filter((_, j) => j !== i) })}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
                <RuleEditor rule={r} options={options} courses={courses} onChange={(nr) => setDef({ ...def, rules: def.rules.map((x, j) => (j === i ? nr : x)) })} />
              </div>
            ))}
            <Select value="" onValueChange={(t) => setDef({ ...def, rules: [...def.rules, { id: uid(), type: t as RuleType, values: [] }] })}>
              <SelectTrigger className="w-64"><SelectValue placeholder="+ Adicionar regra" /></SelectTrigger>
              <SelectContent>{ruleCatalog.map((r) => <SelectItem key={r.type} value={r.type}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button variant="outline" onClick={runCount} disabled={counting}><RefreshCw className={`w-4 h-4 mr-1 ${counting ? "animate-spin" : ""}`} /> Contar</Button>
            {count && <span className="text-sm"><strong>{Number(count.total).toLocaleString("pt-BR")}</strong> contatos · {Number(count.with_email).toLocaleString("pt-BR")} com e-mail · {Number(count.with_phone).toLocaleString("pt-BR")} com telefone</span>}
            <div className="ml-auto flex gap-2">
              {editingId && <Button variant="ghost" onClick={reset}>Cancelar</Button>}
              <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> Salvar público</Button>
            </div>
          </div>
          {preview.length > 0 && (
            <div className="text-xs border rounded-md divide-y max-h-60 overflow-auto">
              {preview.map((p) => <div key={p.contact_id} className="px-3 py-1.5 flex justify-between gap-2"><span className="truncate">{p.nome || "—"}</span><span className="text-muted-foreground truncate">{p.email || p.phone || "sem contato"}</span></div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Públicos salvos ({audiences.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
          {audiences.length === 0 && <div className="text-xs text-muted-foreground">Nenhum público ainda.</div>}
          {audiences.map((a) => (
            <div key={a.id} className="border rounded-md p-2 text-xs space-y-1">
              <div className="flex justify-between gap-2"><strong className="truncate">{a.name}</strong><Badge variant="secondary" className="text-[10px]">{a.source === "distributors" ? "Distribuidores" : "Leads"}</Badge></div>
              <div className="text-muted-foreground">{(a.definition?.rules || []).length} regra(s){a.last_count != null ? ` · ${a.last_count} contatos` : ""}</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => edit(a)}>Editar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => edit(a, true)}><Copy className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => { if (!confirm("Excluir público?")) return; const { error } = await db.from("email_audiences").delete().eq("id", a.id); if (error) toast.error(error.message); else load(); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

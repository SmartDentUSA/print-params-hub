import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ReactFlow, Background, Controls, Handle, Position, addEdge, applyEdgeChanges, applyNodeChanges, MarkerType,
  type Node, type Edge, type NodeProps, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Play, Pause, Mail, Clock, GitBranch, MessageCircle, MessageSquare, Flag, Trash2, Target, Repeat } from "lucide-react";
import { EmailNodeEditor } from "./EmailNodeEditor";
import { FlowNodeType, NODE_LABELS, TRIGGERS, WEEKDAYS, defaultNodeData, uid, EMAIL_TYPES } from "./types";

const db = supabase as any;

const ICONS: Record<FlowNodeType, any> = { origin: Target, email: Mail, wait: Clock, condition: GitBranch, whatsapp: MessageCircle, sms: MessageSquare, goto_flow: Repeat, end: Flag };

function summary(type: FlowNodeType, d: any, ctx: { audiences: any[]; flows: any[] }, flow: any): string {
  switch (type) {
    case "origin": return flow.origin_type === "trigger" ? `Gatilho: ${TRIGGERS.find((t) => t.v === flow.trigger_type)?.l || "—"}` : `Público: ${ctx.audiences.find((a) => a.id === flow.audience_id)?.name || "—"}`;
    case "email": return `${EMAIL_TYPES.find((t) => t.v === d.email_type)?.l || ""} · ${d.subject || "sem assunto"}`;
    case "wait": return d.mode === "until" ? `Até ${d.until ? new Date(d.until).toLocaleString("pt-BR") : "—"}` : `${d.amount} ${d.unit === "days" ? "dia(s)" : d.unit === "hours" ? "hora(s)" : "min"}`;
    case "condition": return `${d.check === "opened" ? "Abriu" : d.check === "clicked" ? "Clicou" : "Clicou no link"} · até ${d.timeout_hours}h`;
    case "whatsapp": return (d.message || "").slice(0, 50);
    case "sms": return (d.message || "").slice(0, 50);
    case "goto_flow": return ctx.flows.find((f) => f.id === d.flow_id)?.name || "escolha a régua";
    default: return "";
  }
}

function FlowNodeView({ data, selected }: NodeProps) {
  const d: any = data;
  const Icon = ICONS[d.kind as FlowNodeType] || Mail;
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm w-[220px] ${selected ? "ring-2 ring-primary" : ""}`}>
      {d.kind !== "origin" && <Handle type="target" position={Position.Top} />}
      <div className="px-3 py-2 flex items-center gap-2 border-b">
        <Icon className="w-4 h-4 text-primary" /><span className="text-xs font-semibold">{NODE_LABELS[d.kind as FlowNodeType]}</span>
        {d.count > 0 && <Badge className="ml-auto text-[10px]">{d.count}</Badge>}
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground line-clamp-2 min-h-[28px]">{d.summary}</div>
      {d.kind === "condition" ? (
        <>
          <Handle type="source" id="yes" position={Position.Bottom} style={{ left: "30%" }} />
          <Handle type="source" id="no" position={Position.Bottom} style={{ left: "70%" }} />
          <div className="flex justify-between px-6 pb-1 text-[10px] text-muted-foreground"><span>Sim</span><span>Não</span></div>
        </>
      ) : d.kind !== "end" && d.kind !== "goto_flow" ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  );
}
const nodeTypes = { step: FlowNodeView };

function TimingEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const t = value || { mode: "immediate" };
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">Envio</Label>
      <Select value={t.mode} onValueChange={(m) => onChange({ ...t, mode: m })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="immediate">Imediatamente</SelectItem><SelectItem value="delay">Depois de X minutos</SelectItem><SelectItem value="datetime">Em data/hora marcada</SelectItem></SelectContent>
      </Select>
      {t.mode === "delay" && <Input type="number" min={0} className="h-8 text-xs" value={t.minutes || 0} onChange={(e) => onChange({ ...t, minutes: +e.target.value })} />}
      {t.mode === "datetime" && <Input type="datetime-local" className="h-8 text-xs" value={t.at || ""} onChange={(e) => onChange({ ...t, at: e.target.value })} />}
      <div className="text-[10px] text-muted-foreground">Os envios saem nas rodadas das 08h, 12h e 17h.</div>
    </div>
  );
}

export function FlowEditor({ flowId, onBack }: { flowId: string | null; onBack: () => void }) {
  const [flow, setFlow] = useState<any>({ name: "Nova régua", description: "", origin_type: "audience", audience_id: null, trigger_type: null, trigger_config: {}, exit_rules: { deal_won: true, new_form: false, stage_change: false }, status: "draft", priority: 3, active_weekdays: [1, 2, 3, 4, 5] });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("email_audiences").select("id, name, last_count").order("name").then(({ data }: any) => setAudiences(data || []));
    db.from("email_flows").select("id, name").order("name").then(({ data }: any) => setFlows(data || []));
    db.from("team_members").select("id, nome_completo, photo_url, cargo, whatsapp_number, instagram_url, linkedin_url, facebook_url, youtube_url, evolution_instance_name, evolution_api_key").eq("ativo", true).order("nome_completo")
      .then(({ data }: any) => setMembers(data || []));
    db.from("smartops_courses").select("id, title").order("title").then(({ data }: any) => setCourses(data || []));
    if (!flowId) {
      const o = { id: "origin", type: "step", position: { x: 250, y: 20 }, data: { kind: "origin", cfg: {} } };
      setNodes([o]); return;
    }
    db.from("email_flows").select("*").eq("id", flowId).single().then(({ data }: any) => {
      if (!data) return;
      setFlow(data);
      setNodes((data.nodes || []).map((n: any) => ({ id: n.id, type: "step", position: n.position || { x: 0, y: 0 }, data: { kind: n.type, cfg: n.data || {} } })));
      setEdges((data.edges || []).map((e: any) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed }, label: e.sourceHandle === "no" ? "Não" : e.sourceHandle === "yes" ? "Sim" : undefined })));
    });
    db.from("email_flow_enrollments").select("current_node_id").eq("flow_id", flowId).eq("status", "active").limit(5000).then(({ data }: any) => {
      const c: Record<string, number> = {};
      (data || []).forEach((r: any) => { const k = r.current_node_id || "origin"; c[k] = (c[k] || 0) + 1; });
      setCounts(c);
    });
  }, [flowId]);

  const ctx = { audiences, flows };
  const viewNodes = useMemo(() => nodes.map((n: any) => ({ ...n, data: { ...n.data, count: counts[n.id] || 0, summary: summary(n.data.kind, n.data.cfg, ctx, flow) } })), [nodes, counts, audiences, flows, flow]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((ns) => applyNodeChanges(c, ns)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((es) => applyEdgeChanges(c, es)), []);
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({
    ...c, id: `e-${uid()}`, markerEnd: { type: MarkerType.ArrowClosed },
    label: c.sourceHandle === "no" ? "Não" : c.sourceHandle === "yes" ? "Sim" : undefined,
  }, es.filter((e) => !(e.source === c.source && (e.sourceHandle || null) === (c.sourceHandle || null))))), []);

  const addNode = (kind: FlowNodeType) => {
    const sel = nodes.find((n) => n.id === selectedId) || nodes[nodes.length - 1];
    const id = `${kind}-${uid()}`;
    const pos = sel ? { x: sel.position.x, y: sel.position.y + 140 } : { x: 250, y: 20 };
    setNodes((ns) => [...ns, { id, type: "step", position: pos, data: { kind, cfg: defaultNodeData(kind) } }]);
    if (sel && (sel.data as any).kind !== "condition" && (sel.data as any).kind !== "end" && (sel.data as any).kind !== "goto_flow" && !edges.some((e) => e.source === sel.id)) {
      setEdges((es) => [...es, { id: `e-${uid()}`, source: sel.id, target: id, markerEnd: { type: MarkerType.ArrowClosed } }]);
    }
    setSelectedId(id);
  };

  const selected: any = nodes.find((n) => n.id === selectedId);
  const updateCfg = (cfg: any) => setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, cfg } } : n)));
  const deleteSelected = () => {
    if (!selected || selected.data.kind === "origin") return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const save = async (status?: string) => {
    if (!flow.name?.trim()) return toast.error("Dê um nome à régua");
    if (flow.origin_type === "audience" && !flow.audience_id) return toast.error("Toda régua precisa de um público de origem");
    if (flow.origin_type === "trigger" && !flow.trigger_type) return toast.error("Escolha o gatilho de origem");
    const nextStatus = status || flow.status;
    if (nextStatus === "active") {
      const emails = nodes.filter((n: any) => n.data.kind === "email");
      if (emails.some((n: any) => !n.data.cfg.subject || !n.data.cfg.html)) return toast.error("Todo e-mail precisa de assunto e corpo");
      if (nodes.filter((n: any) => n.data.kind === "whatsapp").some((n: any) => !n.data.cfg.instance_member_id)) return toast.error("Escolha a instância de WhatsApp");
      if (!edges.some((e) => e.source === "origin")) return toast.error("Conecte a origem ao primeiro passo");
    }
    setSaving(true);
    const row = {
      name: flow.name, description: flow.description, origin_type: flow.origin_type, audience_id: flow.origin_type === "audience" ? flow.audience_id : null,
      trigger_type: flow.origin_type === "trigger" ? flow.trigger_type : null, trigger_config: flow.trigger_config || {},
      exit_rules: flow.exit_rules, priority: flow.priority, active_weekdays: flow.active_weekdays, status: nextStatus,
      activated_at: nextStatus === "active" && flow.status !== "active" ? new Date().toISOString() : flow.activated_at ?? null,
      nodes: nodes.map((n: any) => ({ id: n.id, type: n.data.kind, position: n.position, data: n.data.cfg })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
    };
    const res = flow.id ? await db.from("email_flows").update(row).eq("id", flow.id).select().single() : await db.from("email_flows").insert(row).select().single();
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    setFlow(res.data);
    if (nextStatus === "active" && row.origin_type === "audience") {
      const { data: n, error } = await db.rpc("fn_email_flow_enroll_audience", { _flow: res.data.id, _limit: 5000 });
      if (error) toast.error(`Régua ativa, mas a inscrição do público falhou: ${error.message}`);
      else toast.success(`Régua ativa · ${n ?? 0} contato(s) inscrito(s). Primeiros envios na próxima rodada (08h, 12h ou 17h).`);
    } else toast.success(nextStatus === "active" ? "Régua ativa" : "Régua salva");
  };

  const cfg = selected?.data?.cfg || {};
  const kind: FlowNodeType | undefined = selected?.data?.kind;
  const setF = (p: any) => setFlow((f: any) => ({ ...f, ...p }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Réguas</Button>
        <Input value={flow.name} onChange={(e) => setF({ name: e.target.value })} className="h-9 max-w-sm font-medium" />
        <Badge variant={flow.status === "active" ? "default" : "secondary"}>{flow.status === "active" ? "Ativa" : flow.status === "paused" ? "Pausada" : "Rascunho"}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save()} disabled={saving}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          {flow.status === "active"
            ? <Button variant="outline" size="sm" onClick={() => save("paused")} disabled={saving}><Pause className="w-4 h-4 mr-1" /> Pausar</Button>
            : <Button size="sm" onClick={() => save("active")} disabled={saving}><Play className="w-4 h-4 mr-1" /> Ativar régua</Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(["email", "wait", "condition", "whatsapp", "sms", "goto_flow", "end"] as FlowNodeType[]).map((k) => {
          const I = ICONS[k];
          return <Button key={k} size="sm" variant="outline" className="h-8 text-xs" onClick={() => addNode(k)}><I className="w-3.5 h-3.5 mr-1" /> {NODE_LABELS[k]}</Button>;
        })}
        <span className="text-[11px] text-muted-foreground self-center ml-2">Arraste das bolinhas para ligar os passos. Ligue o fim a qualquer passo para repetir.</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
        <div className="h-[70vh] border rounded-lg bg-muted/20">
          <ReactFlow nodes={viewNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)} fitView deleteKeyCode={null}>
            <Background /><Controls />
          </ReactFlow>
        </div>

        <Card className="h-[70vh] overflow-auto">
          <CardContent className="pt-4 space-y-3">
            {!selected && (
              <div className="space-y-3">
                <div className="text-sm font-semibold">Configurações da régua</div>
                <div><Label className="text-[11px]">Descrição</Label><Input className="h-8 text-xs" value={flow.description || ""} onChange={(e) => setF({ description: e.target.value })} /></div>
                <div><Label className="text-[11px]">Nível de prioridade</Label>
                  <Select value={String(flow.priority)} onValueChange={(v) => setF({ priority: +v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((p) => <SelectItem key={p} value={String(p)}>{p} {p === 1 ? "— mais alta" : p === 5 ? "— mais baixa" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="text-[10px] text-muted-foreground mt-1">Limite de 150 e-mails/dia: réguas de prioridade mais alta enviam primeiro; o restante fica para a próxima rodada.</div>
                </div>
                <div><Label className="text-[11px]">Dias em que a régua envia</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {WEEKDAYS.map((w) => {
                      const on = (flow.active_weekdays || []).includes(w.v);
                      return <Button key={w.v} size="sm" variant={on ? "default" : "outline"} className="h-7 px-2 text-xs"
                        onClick={() => setF({ active_weekdays: on ? flow.active_weekdays.filter((x: number) => x !== w.v) : [...(flow.active_weekdays || []), w.v] })}>{w.l}</Button>;
                    })}
                  </div></div>
                <div className="space-y-2 border-t pt-3">
                  <div className="text-xs font-medium">Sair da régua quando</div>
                  {[["deal_won", "o lead converter (negócio ganho)"], ["new_form", "fizer novo cadastro de formulário"], ["stage_change", "mudar de etapa no funil"]].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-xs"><Switch checked={!!flow.exit_rules?.[k]} onCheckedChange={(v) => setF({ exit_rules: { ...flow.exit_rules, [k]: v } })} /> {l}</label>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground border-t pt-3">Clique em um passo para editá-lo.</div>
              </div>
            )}

            {selected && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{NODE_LABELS[kind!]}</div>
                  {kind !== "origin" && <Button size="sm" variant="ghost" onClick={deleteSelected}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                </div>

                {kind === "origin" && (
                  <div className="space-y-2">
                    <Select value={flow.origin_type} onValueChange={(v) => setF({ origin_type: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="audience">Público salvo</SelectItem><SelectItem value="trigger">Gatilho do sistema</SelectItem></SelectContent>
                    </Select>
                    {flow.origin_type === "audience" ? (
                      <Select value={flow.audience_id || ""} onValueChange={(v) => setF({ audience_id: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha o público" /></SelectTrigger>
                        <SelectContent>{audiences.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.last_count != null ? ` (${a.last_count})` : ""}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <>
                        <Select value={flow.trigger_type || ""} onValueChange={(v) => setF({ trigger_type: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha o gatilho" /></SelectTrigger>
                          <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                        </Select>
                        {["certificate_generated", "course_enrolled"].includes(flow.trigger_type) && (
                          <Select value={flow.trigger_config?.course_id || "any"} onValueChange={(v) => setF({ trigger_config: { ...flow.trigger_config, course_id: v === "any" ? "" : v } })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="any">Qualquer curso</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                        {flow.trigger_type === "form_submitted" && <Input className="h-8 text-xs" placeholder="Nome do formulário (vazio = qualquer)" value={flow.trigger_config?.form_name || ""} onChange={(e) => setF({ trigger_config: { ...flow.trigger_config, form_name: e.target.value } })} />}
                        {["stage_changed", "deal_won"].includes(flow.trigger_type) && (
                          <div className="grid grid-cols-2 gap-2">
                            <Input className="h-8 text-xs" placeholder="Funil (vazio = qualquer)" value={flow.trigger_config?.pipeline || ""} onChange={(e) => setF({ trigger_config: { ...flow.trigger_config, pipeline: e.target.value } })} />
                            {flow.trigger_type === "stage_changed" && <Input className="h-8 text-xs" placeholder="Etapa (vazio = qualquer)" value={flow.trigger_config?.stage || ""} onChange={(e) => setF({ trigger_config: { ...flow.trigger_config, stage: e.target.value } })} />}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {kind === "email" && <><EmailNodeEditor data={cfg} onChange={updateCfg} members={members} isCertificateTrigger={flow.trigger_type === "certificate_generated"} /><TimingEditor value={cfg.timing} onChange={(t) => updateCfg({ ...cfg, timing: t })} /></>}

                {kind === "wait" && (
                  <div className="space-y-2">
                    <Select value={cfg.mode} onValueChange={(v) => updateCfg({ ...cfg, mode: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="duration">Esperar um tempo</SelectItem><SelectItem value="until">Esperar até data/hora</SelectItem></SelectContent>
                    </Select>
                    {cfg.mode === "until"
                      ? <Input type="datetime-local" className="h-8 text-xs" value={cfg.until || ""} onChange={(e) => updateCfg({ ...cfg, until: e.target.value })} />
                      : <div className="grid grid-cols-2 gap-2">
                          <Input type="number" min={0} className="h-8 text-xs" value={cfg.amount} onChange={(e) => updateCfg({ ...cfg, amount: +e.target.value })} />
                          <Select value={cfg.unit} onValueChange={(v) => updateCfg({ ...cfg, unit: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="minutes">minutos</SelectItem><SelectItem value="hours">horas</SelectItem><SelectItem value="days">dias</SelectItem></SelectContent>
                          </Select>
                        </div>}
                  </div>
                )}

                {kind === "condition" && (
                  <div className="space-y-2">
                    <Select value={cfg.check} onValueChange={(v) => updateCfg({ ...cfg, check: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="opened">Se o lead abriu o e-mail</SelectItem><SelectItem value="clicked">Se clicou no e-mail</SelectItem><SelectItem value="clicked_link">Se clicou em um link específico</SelectItem></SelectContent>
                    </Select>
                    <Select value={cfg.ref_node || "last"} onValueChange={(v) => updateCfg({ ...cfg, ref_node: v === "last" ? "" : v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="last">Último e-mail enviado</SelectItem>{nodes.filter((n: any) => n.data.kind === "email").map((n: any) => <SelectItem key={n.id} value={n.id}>{n.data.cfg.subject || n.id}</SelectItem>)}</SelectContent>
                    </Select>
                    {cfg.check === "clicked_link" && <Input className="h-8 text-xs" placeholder="Parte do link (ex.: /inscricao)" value={cfg.link_contains || ""} onChange={(e) => updateCfg({ ...cfg, link_contains: e.target.value })} />}
                    <div><Label className="text-[11px]">Aguardar até (horas) antes de seguir pelo "Não"</Label><Input type="number" min={1} className="h-8 text-xs" value={cfg.timeout_hours} onChange={(e) => updateCfg({ ...cfg, timeout_hours: +e.target.value })} /></div>
                  </div>
                )}

                {kind === "whatsapp" && (
                  <div className="space-y-2">
                    <Label className="text-[11px]">Instância de envio</Label>
                    <Select value={cfg.instance_member_id || ""} onValueChange={(v) => updateCfg({ ...cfg, instance_member_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha a instância" /></SelectTrigger>
                      <SelectContent>{members.filter((m) => m.evolution_instance_name).map((m) => <SelectItem key={m.id} value={m.id} disabled={!m.evolution_api_key}>{m.nome_completo} · {m.evolution_instance_name}{!m.evolution_api_key ? " (sem credencial)" : ""}</SelectItem>)}</SelectContent>
                    </Select>
                    <Label className="text-[11px]">Mensagem</Label>
                    <Textarea rows={6} value={cfg.message} onChange={(e) => updateCfg({ ...cfg, message: e.target.value })} />
                    <div className="text-[10px] text-muted-foreground">Variáveis: {"{{primeiro_nome}} {{nome}} {{curso}} {{vendedor_nome}}"}</div>
                    <TimingEditor value={cfg.timing} onChange={(t) => updateCfg({ ...cfg, timing: t })} />
                  </div>
                )}

                {kind === "sms" && (
                  <div className="space-y-2">
                    <Label className="text-[11px]">Mensagem SMS</Label>
                    <Textarea rows={4} maxLength={160} value={cfg.message} onChange={(e) => updateCfg({ ...cfg, message: e.target.value })} />
                    <div className={`text-[10px] ${(cfg.message || "").length > 150 ? "text-destructive" : "text-muted-foreground"}`}>{(cfg.message || "").length}/160 caracteres (sem acentos para não cortar)</div>
                    <TimingEditor value={cfg.timing} onChange={(t) => updateCfg({ ...cfg, timing: t })} />
                  </div>
                )}

                {kind === "goto_flow" && (
                  <div className="space-y-2">
                    <Label className="text-[11px]">Ao chegar aqui, colocar o contato na régua</Label>
                    <Select value={cfg.flow_id || ""} onValueChange={(v) => updateCfg({ ...cfg, flow_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha a régua" /></SelectTrigger>
                      <SelectContent>{flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}{f.id === flow.id ? " (esta mesma)" : ""}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="text-[10px] text-muted-foreground">Para continuar dentro desta régua, ligue o último passo a qualquer passo anterior.</div>
                  </div>
                )}
                {kind === "end" && <div className="text-xs text-muted-foreground">O contato sai da régua aqui.</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

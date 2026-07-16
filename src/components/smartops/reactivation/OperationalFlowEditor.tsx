import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import {
  useOperationalFlowsList,
  useSaveOperationalFlow,
  type OperationalFlow,
} from "@/hooks/reactivation/useOperationalFlows";

const NODE_PALETTE = [
  { type: "trigger", label: "Trigger", color: "hsl(280 70% 55%)" },
  { type: "guard", label: "Guard (Golden/Intent/Dedupe)", color: "hsl(0 70% 55%)" },
  { type: "enrich", label: "Enriquecer", color: "hsl(200 80% 50%)" },
  { type: "merge", label: "Smart Merge", color: "hsl(220 70% 55%)" },
  { type: "assign", label: "Atribuir vendedor", color: "hsl(160 65% 42%)" },
  { type: "crm_action", label: "Ação PipeRun", color: "hsl(142 70% 45%)" },
  { type: "wait", label: "Aguardar (D+n)", color: "hsl(var(--muted-foreground))" },
  { type: "condition", label: "Condição (if/else)", color: "hsl(43 96% 56%)" },
  { type: "notify", label: "Notificar (WA/SMS/Email)", color: "hsl(30 90% 55%)" },
  { type: "end", label: "Fim", color: "hsl(var(--destructive))" },
];

const ROLLOUT_MODES = [
  { value: "hardcoded", label: "Hardcoded (fallback)" },
  { value: "shadow", label: "Shadow (compara sem aplicar)" },
  { value: "canary", label: "Canary (parcial)" },
  { value: "live", label: "Live (usa este grafo)" },
];

function normalizeGraph(graph: any): { nodes: Node[]; edges: Edge[] } {
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const nodes: Node[] = rawNodes.map((n: any, i: number) => {
    const pal = NODE_PALETTE.find((p) => p.type === (n?.data?.nodeType ?? n?.type));
    return {
      id: String(n?.id ?? `n_${i}`),
      type: "default",
      position:
        n?.position && typeof n.position.x === "number" && typeof n.position.y === "number"
          ? n.position
          : { x: 100 + (i % 4) * 220, y: 100 + Math.floor(i / 4) * 140 },
      data: n?.data ?? {
        label: n?.label ?? n?.type ?? `Nó ${i + 1}`,
        nodeType: n?.type ?? "trigger",
        config: n?.config ?? {},
      },
      style: pal
        ? {
            border: `2px solid ${pal.color}`,
            borderRadius: 8,
            padding: 8,
            minWidth: 160,
            background: "hsl(var(--card))",
          }
        : undefined,
    };
  });
  const edges: Edge[] = rawEdges
    .filter((e: any) => e?.source && e?.target)
    .map((e: any, i: number) => ({
      id: String(e?.id ?? `e_${i}`),
      source: String(e.source),
      target: String(e.target),
      label: e?.label,
    }));
  return { nodes, edges };
}

export function OperationalFlowEditor() {
  const { data: flows, isLoading } = useOperationalFlowsList();
  const save = useSaveOperationalFlow();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rollout, setRollout] = useState("hardcoded");
  const [active, setActive] = useState(false);
  const [note, setNote] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const selected: OperationalFlow | undefined = useMemo(
    () => flows?.find((f) => f.id === selectedId),
    [flows, selectedId],
  );

  useEffect(() => {
    if (!selectedId && flows && flows.length) setSelectedId(flows[0].id);
  }, [flows, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const { nodes: n, edges: e } = normalizeGraph(selected.graph);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
    setRollout(selected.rollout_mode ?? "hardcoded");
    setActive(!!selected.active);
    setNote("");
  }, [selected, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const addNode = (type: string) => {
    const pal = NODE_PALETTE.find((p) => p.type === type)!;
    const node: Node = {
      id: crypto.randomUUID(),
      type: "default",
      position: { x: 200 + Math.random() * 300, y: 120 + Math.random() * 240 },
      data: { label: pal.label, nodeType: type, config: {} },
      style: {
        border: `2px solid ${pal.color}`,
        borderRadius: 8,
        padding: 8,
        minWidth: 160,
        background: "hsl(var(--card))",
      },
    };
    setNodes((nds) => [...nds, node]);
  };

  const updateSelectedNode = (patch: { label?: string; configText?: string }) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode.id) return n;
        const data: any = { ...(n.data ?? {}) };
        if (patch.label !== undefined) data.label = patch.label;
        if (patch.configText !== undefined) {
          try {
            data.config = patch.configText.trim() ? JSON.parse(patch.configText) : {};
            data._configError = undefined;
          } catch (e: any) {
            data._configText = patch.configText;
            data._configError = e.message;
          }
        }
        const next = { ...n, data };
        setSelectedNode(next);
        return next;
      }),
    );
  };

  const removeSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    const invalid = nodes.find((n: any) => n.data?._configError);
    if (invalid) {
      toast.error(`JSON inválido no nó "${(invalid.data as any)?.label}"`);
      return;
    }
    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: {
          label: (n.data as any)?.label,
          nodeType: (n.data as any)?.nodeType,
          config: (n.data as any)?.config ?? {},
        },
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    };
    try {
      const v = await save.mutateAsync({
        id: selected.id,
        currentVersion: selected.current_version,
        graph,
        rollout_mode: rollout,
        active,
        note: note || undefined,
      });
      toast.success(`Versão v${v} salva`);
      setNote("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  };

  const nodeConfigText = (() => {
    if (!selectedNode) return "";
    const d: any = selectedNode.data ?? {};
    if (d._configError && typeof d._configText === "string") return d._configText;
    try {
      return JSON.stringify(d.config ?? {}, null, 2);
    } catch {
      return "";
    }
  })();

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando fluxos…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Sidebar: flows + palette */}
      <div className="col-span-3 space-y-4">
        <Card>
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-2">
              Fluxos
            </p>
            {(flows ?? []).map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                className={`w-full text-left rounded-md px-2 py-2 text-sm transition-colors ${
                  f.id === selectedId ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Workflow className="w-3.5 h-3.5 opacity-70" />
                  <span className="font-medium truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 pl-5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1">
                    v{f.current_version}
                  </Badge>
                  <Badge
                    variant={f.rollout_mode === "live" ? "default" : "secondary"}
                    className="text-[10px] py-0 px-1"
                  >
                    {f.rollout_mode}
                  </Badge>
                  {f.active && (
                    <Badge className="text-[10px] py-0 px-1 bg-emerald-600 hover:bg-emerald-600">
                      ativo
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-2">
              Paleta de nós
            </p>
            {NODE_PALETTE.map((n) => (
              <Button
                key={n.type}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => addNode(n.type)}
                disabled={!selected}
              >
                <Plus className="w-3 h-3 mr-2" style={{ color: n.color }} />
                <span className="truncate">{n.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Canvas + inspector */}
      <div className="col-span-9 space-y-3">
        {selected ? (
          <>
            <Card>
              <CardContent className="p-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs">Fluxo</Label>
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">{selected.description}</div>
                </div>
                <div className="w-48">
                  <Label className="text-xs">Rollout</Label>
                  <Select value={rollout} onValueChange={setRollout}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLLOUT_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Ativo</Label>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs">Nota da versão</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: adicionado guard commercial-intent"
                    className="h-9"
                  />
                </div>
                <Button onClick={handleSave} disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar nova versão
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-md border border-border/60" style={{ height: 540 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => setSelectedNode(n)}
                onPaneClick={() => setSelectedNode(null)}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>

            {selectedNode && (
              <Card>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Nó selecionado
                      </p>
                      <p className="text-sm font-medium">
                        {(selectedNode.data as any)?.nodeType ?? "—"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeSelectedNode}>
                      <Trash2 className="w-4 h-4 mr-1" /> Remover
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Rótulo</Label>
                    <Input
                      value={(selectedNode.data as any)?.label ?? ""}
                      onChange={(e) => updateSelectedNode({ label: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Config (JSON)</Label>
                    <Textarea
                      value={nodeConfigText}
                      onChange={(e) => updateSelectedNode({ configText: e.target.value })}
                      rows={6}
                      className="font-mono text-xs"
                    />
                    {(selectedNode.data as any)?._configError && (
                      <p className="text-xs text-destructive mt-1">
                        JSON inválido: {(selectedNode.data as any)._configError}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Selecione um fluxo para editar.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
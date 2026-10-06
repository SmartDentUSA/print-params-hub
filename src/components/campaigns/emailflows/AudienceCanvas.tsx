import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Filter, Users, CheckCircle2 } from "lucide-react";
import { AudienceDefinition, DIST_RULES, LEAD_RULES } from "./types";

function AudienceNode({ data, selected }: NodeProps) {
  const Icon = data.kind === "source" ? Users : data.kind === "result" ? CheckCircle2 : Filter;
  return <div className={`w-[250px] border rounded-lg bg-card text-card-foreground shadow-sm ${selected ? "ring-2 ring-primary" : ""}`}>
    {data.kind !== "source" && <Handle type="target" position={Position.Top} />}
    <div className="flex items-center gap-2 px-3 py-2 border-b"><Icon className="w-4 h-4 text-primary" /><strong className="text-xs">{String(data.title)}</strong></div><div className="px-3 py-3 text-xs text-muted-foreground break-words">{String(data.summary)}</div>
    {data.kind !== "result" && <Handle type="source" position={Position.Bottom} />}
  </div>;
}
const nodeTypes = { audience: AudienceNode };

export function AudienceCanvas({ definition, source, selectedId, onSelect, positions, onPositionsChange, total }: { definition: AudienceDefinition; source: string; selectedId: string | null; onSelect: (id: string | null) => void; positions: Record<string, { x: number; y: number }>; onPositionsChange: (p: Record<string, { x: number; y: number }>) => void; total?: number }) {
  const { nodes, edges } = useMemo(() => {
    const catalog = source === "distributors" ? DIST_RULES : LEAD_RULES;
    const rules = definition.rules;
    const center = Math.max(0, (rules.length - 1) * 150);
    const nodes = [
      { id: "source", type: "audience", position: positions.source || { x: center, y: 0 }, data: { kind: "source", title: source === "distributors" ? "Distribuidores" : "Leads / clientes", summary: definition.match === "all" ? "Todas as condições (E)" : "Qualquer condição (OU)" } },
      ...rules.map((r, i) => ({ id: r.id, type: "audience", selected: selectedId === r.id, position: positions[r.id] || { x: i * 300, y: 160 }, data: { kind: "rule", title: catalog.find((c) => c.type === r.type)?.label || r.type, summary: [r.pipeline, r.stage, ...(r.values || []), r.column, r.value, r.from && `De ${r.from}`, r.to && `Até ${r.to}`].filter(Boolean).join(" · ") || "Selecionar critérios" } })),
      { id: "result", type: "audience", position: positions.result || { x: center, y: rules.length ? 340 : 180 }, data: { kind: "result", title: "Público resultante", summary: total == null ? "Contagem pendente" : `${total.toLocaleString("pt-BR")} contatos` } },
    ];
    const pairs = rules.length ? rules.flatMap((r) => [["source", r.id], [r.id, "result"]]) : [["source", "result"]];
    const edges = pairs.map(([s, t]) => ({ id: `${s}-${t}`, source: s, target: t, label: t === "result" ? (definition.match === "all" ? "E" : "OU") : undefined, markerEnd: { type: MarkerType.ArrowClosed } }));
    return { nodes, edges };
  }, [definition, source, positions, selectedId, total]);
  return <div className="h-[58vh] min-h-[420px] border rounded-lg bg-muted/20"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} onNodeClick={(_, n) => onSelect(definition.rules.some((r) => r.id === n.id) ? n.id : null)} onPaneClick={() => onSelect(null)} onNodeDragStop={(_, n) => onPositionsChange({ ...positions, [n.id]: n.position })} nodesConnectable={false} deleteKeyCode={null}><Background /><Controls /></ReactFlow></div>;
}
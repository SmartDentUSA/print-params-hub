import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ShowIf, ConditionRule } from "@/lib/formConditions";

// ───────────────────────── Types ─────────────────────────

interface FlowField {
  id: string;
  label: string;
  field_type: string;
  required: boolean | null;
  order_index: number;
  workflow_cell_target: string | null;
  options: any;
  conditions: any;
}

interface FieldOption {
  value: string;
  label?: string;
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 110;
const END_NODE_ID = "__end__";

// ───────────────────────── Helpers ─────────────────────────

const norm = (v: any) =>
  v === undefined || v === null ? "" : String(v).trim().toLowerCase();

function getOptions(field: FlowField): FieldOption[] {
  const raw = field.options;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((o: any) =>
      typeof o === "string"
        ? { value: o, label: o }
        : { value: String(o?.value ?? o?.label ?? ""), label: o?.label ?? String(o?.value ?? "") },
    );
  }
  // booleans default to Sim/Não
  if (field.field_type === "boolean") {
    return [{ value: "Sim", label: "Sim" }, { value: "Não", label: "Não" }];
  }
  return [];
}

function getShowIf(field: FlowField): ShowIf | null {
  return (field.conditions as { show_if?: ShowIf } | null)?.show_if ?? null;
}

/**
 * Decide if a field would be visible given a hypothetical answer to `parentField`.
 * Only considers rules that reference parentField; rules referencing OTHER parents
 * are assumed satisfied (best-effort visualization).
 */
function isVisibleForAnswer(field: FlowField, parentId: string, answer: string): boolean {
  const showIf = getShowIf(field);
  if (!showIf || !showIf.rules?.length) return true;

  const evalOne = (rule: ConditionRule): boolean => {
    if (rule.field_id !== parentId) return true; // assume other parents satisfied
    const a = norm(answer);
    const v = rule.value;
    switch (rule.op) {
      case "is_empty":
        return a === "";
      case "is_not_empty":
        return a !== "";
      case "equals":
        return a === norm(v);
      case "not_equals":
        return a !== norm(v);
      case "in": {
        const list = Array.isArray(v) ? v.map(norm) : [norm(v)];
        return list.includes(a);
      }
      case "not_in": {
        const list = Array.isArray(v) ? v.map(norm) : [norm(v)];
        return !list.includes(a);
      }
      default:
        return true;
    }
  };

  return showIf.logic === "OR" ? showIf.rules.some(evalOne) : showIf.rules.every(evalOne);
}

/**
 * Find the next field in order_index AFTER `from` that would be visible given
 * `parentId` was answered with `answer`.
 */
function findNextVisible(
  fields: FlowField[],
  from: FlowField,
  parentId: string,
  answer: string,
): FlowField | null {
  for (const f of fields) {
    if (f.order_index <= from.order_index) continue;
    if (f.id === from.id) continue;
    if (isVisibleForAnswer(f, parentId, answer)) return f;
  }
  return null;
}

/** Branches a parent field can take (one per option, or default + skip). */
interface Branch {
  answer: string; // "Sim", "Não", "Anycubic"... or "" for default
  label: string;  // edge label
}

function getBranches(field: FlowField): Branch[] {
  const opts = getOptions(field);
  if (opts.length > 0) {
    return opts.map((o) => ({ answer: o.value, label: o.label ?? o.value }));
  }
  // No options → single default branch (text/email/phone)
  return [{ answer: "", label: "" }];
}

// ───────────────────────── Build graph ─────────────────────────

function buildGraph(fields: FlowField[]): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...fields].sort((a, b) => a.order_index - b.order_index);
  const nodes: Node[] = sorted.map((f) => ({
    id: f.id,
    type: "fieldNode",
    position: { x: 0, y: 0 },
    data: { field: f },
  }));

  // Terminal node
  nodes.push({
    id: END_NODE_ID,
    type: "endNode",
    position: { x: 0, y: 0 },
    data: {},
  });

  const edges: Edge[] = [];
  let edgeSeq = 0;

  for (const parent of sorted) {
    const branches = getBranches(parent);

    for (const branch of branches) {
      // Find every later field whose show_if has at least one rule referencing
      // THIS parent that is satisfied by THIS answer.
      const activeChildren: FlowField[] = [];
      const allLaterDependents: FlowField[] = [];

      for (const candidate of sorted) {
        if (candidate.order_index <= parent.order_index) continue;
        const showIf = getShowIf(candidate);
        if (!showIf || !showIf.rules?.length) continue;
        const refsParent = showIf.rules.some((r) => r.field_id === parent.id);
        if (!refsParent) continue;
        allLaterDependents.push(candidate);
        if (isVisibleForAnswer(candidate, parent.id, branch.answer)) {
          activeChildren.push(candidate);
        }
      }

      // Also consider as "next" the first non-conditional field after parent
      // (the natural next step when nothing branches).
      if (activeChildren.length > 0) {
        // Active branch — solid green edges to each matched child
        for (const child of activeChildren) {
          edges.push({
            id: `e${edgeSeq++}`,
            source: parent.id,
            target: child.id,
            label: branch.label || undefined,
            animated: false,
            style: { stroke: "hsl(142 70% 40%)", strokeWidth: 2 },
            labelStyle: { fontSize: 11, fontWeight: 600, fill: "hsl(142 70% 30%)" },
            labelBgStyle: { fill: "hsl(142 70% 95%)" },
            labelBgPadding: [4, 2],
            labelBgBorderRadius: 4,
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(142 70% 40%)" },
          });
        }
      } else {
        // Skip branch — dashed gray edge to next visible field (or End)
        const next = findNextVisible(sorted, parent, parent.id, branch.answer);
        const targetId = next?.id ?? END_NODE_ID;
        const isSkip = allLaterDependents.length > 0; // there were dependents but none matched
        const labelText = branch.label
          ? isSkip
            ? `${branch.label} → pula`
            : branch.label
          : undefined;
        edges.push({
          id: `e${edgeSeq++}`,
          source: parent.id,
          target: targetId,
          label: labelText,
          animated: false,
          style: {
            stroke: isSkip ? "hsl(0 0% 60%)" : "hsl(220 10% 50%)",
            strokeWidth: 1.5,
            strokeDasharray: isSkip ? "6 4" : undefined,
          },
          labelStyle: { fontSize: 11, fill: "hsl(220 10% 35%)" },
          labelBgStyle: { fill: "hsl(0 0% 96%)" },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSkip ? "hsl(0 0% 60%)" : "hsl(220 10% 50%)",
          },
        });
      }
    }
  }

  return { nodes, edges };
}

// ───────────────────────── Dagre layout ─────────────────────────

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70, marginx: 20, marginy: 20 });

  for (const n of nodes) {
    g.setNode(n.id, {
      width: n.id === END_NODE_ID ? 180 : NODE_WIDTH,
      height: n.id === END_NODE_ID ? 60 : NODE_HEIGHT,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const w = n.id === END_NODE_ID ? 180 : NODE_WIDTH;
    const h = n.id === END_NODE_ID ? 60 : NODE_HEIGHT;
    return {
      ...n,
      position: { x: p.x - w / 2, y: p.y - h / 2 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

// ───────────────────────── Custom nodes ─────────────────────────

function FieldNode({ data }: NodeProps) {
  const field = (data as { field: FlowField }).field;
  const isMapping = !!field.workflow_cell_target;
  const opts = getOptions(field);

  return (
    <div
      className="rounded-md border-2 bg-background shadow-sm"
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        borderColor: isMapping ? "hsl(38 92% 50%)" : "hsl(142 70% 40%)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "transparent", border: 0 }} />
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">#{field.order_index}</span>
          <Badge
            className={`text-[9px] px-1 py-0 h-4 ${
              isMapping
                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                : "bg-green-100 text-green-800 hover:bg-green-100"
            }`}
          >
            {isMapping ? "🗺️ Map" : "📋 Qual"}
          </Badge>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {field.field_type}
          </Badge>
          {field.required && (
            <span className="text-[9px] text-red-600 font-semibold">*</span>
          )}
        </div>
        <div className="text-xs font-medium leading-tight">{field.label || "(sem label)"}</div>
        {opts.length > 0 && (
          <div className="text-[10px] text-muted-foreground truncate">
            {opts.slice(0, 3).map((o) => o.label).join(" · ")}
            {opts.length > 3 && ` +${opts.length - 3}`}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "transparent", border: 0 }} />
    </div>
  );
}

function EndNode() {
  return (
    <div
      className="rounded-full border-2 border-muted-foreground/30 bg-muted px-4 py-2 flex items-center gap-2 shadow-sm"
      style={{ width: 180, height: 60 }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "transparent", border: 0 }} />
      <CheckCircle2 className="w-4 h-4 text-green-600" />
      <span className="text-xs font-medium">Fim do formulário</span>
    </div>
  );
}

const nodeTypes = { fieldNode: FieldNode, endNode: EndNode };

// ───────────────────────── Component ─────────────────────────

export function SmartOpsFormFlowPreview({ formId }: { formId: string }) {
  const [fields, setFields] = useState<FlowField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("smartops_form_fields" as any)
        .select("id,label,field_type,required,order_index,workflow_cell_target,options,conditions")
        .eq("form_id", formId)
        .order("order_index");
      if (active && data) setFields(data as any);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [formId]);

  const { nodes, edges } = useMemo(() => {
    const built = buildGraph(fields);
    return { nodes: layout(built.nodes, built.edges), edges: built.edges };
  }, [fields]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando fluxo…</p>;
  if (!fields.length) return <p className="text-xs text-muted-foreground">Nenhum campo cadastrado ainda.</p>;

  const conditionalCount = fields.filter((f) => (getShowIf(f)?.rules?.length ?? 0) > 0).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{fields.length} perguntas</Badge>
        <Badge variant="secondary">{conditionalCount} condicionais</Badge>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-600" /> caminho ativo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-gray-400" /> pula
        </span>
      </div>

      <div className="rounded-md border bg-muted/10" style={{ height: 600 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-background" />
        </ReactFlow>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Cada resposta possível gera uma seta. Setas tracejadas indicam que a resposta pula uma pergunta condicional.
      </p>
    </div>
  );
}
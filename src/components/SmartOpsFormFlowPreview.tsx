import { useEffect, useMemo, useRef, useState } from "react";
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
const COL_W = 340;
const ROW_H = 150;
const X0 = 40;
const Y0 = 40;

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

  // ── Column assignment: each field belongs to the column of its "root main"
  // (the first ancestor without show_if). Mains themselves get sequential cols.
  const mains = sorted.filter((f) => !getShowIf(f) || !(getShowIf(f)?.rules?.length));
  const colOf = new Map<string, number>();
  mains.forEach((m, i) => colOf.set(m.id, i));
  const fieldById = new Map(sorted.map((f) => [f.id, f] as const));
  const rootMainOf = (f: FlowField): FlowField => {
    let cur: FlowField | undefined = f;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const si = getShowIf(cur);
      if (!si || !si.rules?.length) return cur;
      const parentId = si.rules[0]?.field_id;
      const parent = parentId ? fieldById.get(parentId) : undefined;
      if (!parent) return cur;
      cur = parent;
    }
    return f;
  };
  for (const f of sorted) {
    if (colOf.has(f.id)) continue;
    const root = rootMainOf(f);
    const c = colOf.get(root.id) ?? 0;
    colOf.set(f.id, c);
  }
  // End node sits one column past the last main
  const endCol = mains.length;
  colOf.set(END_NODE_ID, endCol);

  // ── Row assignment: mains at row 0; conditionals stacked top-down per column
  const rowOf = new Map<string, number>();
  for (const m of mains) rowOf.set(m.id, 0);
  const byCol = new Map<number, FlowField[]>();
  for (const f of sorted) {
    if (colOf.get(f.id) === undefined) continue;
    if (rowOf.has(f.id)) continue; // main
    const c = colOf.get(f.id)!;
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c)!.push(f);
  }
  for (const [, list] of byCol) {
    list.sort((a, b) => a.order_index - b.order_index);
    list.forEach((f, i) => rowOf.set(f.id, i + 1));
  }
  rowOf.set(END_NODE_ID, 0);

  const positionFor = (id: string) => ({
    x: X0 + (colOf.get(id) ?? 0) * COL_W,
    y: Y0 + (rowOf.get(id) ?? 0) * ROW_H,
  });

  const nodes: Node[] = sorted.map((f) => ({
    id: f.id,
    type: "fieldNode",
    position: positionFor(f.id),
    data: { field: f },
  }));
  nodes.push({
    id: END_NODE_ID,
    type: "endNode",
    position: positionFor(END_NODE_ID),
    data: {},
  });

  const edges: Edge[] = [];
  let edgeSeq = 0;

  const handlesFor = (sourceId: string, targetId: string) => {
    const sc = colOf.get(sourceId) ?? 0;
    const tc = colOf.get(targetId) ?? 0;
    if (sc === tc) {
      // same column → vertical (down)
      return { sourceHandle: "b", targetHandle: "t" };
    }
    // different column → horizontal (rightward)
    return { sourceHandle: "r", targetHandle: "l" };
  };

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
          const h = handlesFor(parent.id, child.id);
          edges.push({
            id: `e${edgeSeq++}`,
            source: parent.id,
            target: child.id,
            sourceHandle: h.sourceHandle,
            targetHandle: h.targetHandle,
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
        const h = handlesFor(parent.id, targetId);
        edges.push({
          id: `e${edgeSeq++}`,
          source: parent.id,
          target: targetId,
          sourceHandle: h.sourceHandle,
          targetHandle: h.targetHandle,
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
      <Handle id="l" type="target" position={Position.Left} style={{ background: "transparent", border: 0 }} />
      <Handle id="t" type="target" position={Position.Top} style={{ background: "transparent", border: 0 }} />
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
      <Handle id="r" type="source" position={Position.Right} style={{ background: "transparent", border: 0 }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ background: "transparent", border: 0 }} />
    </div>
  );
}

function EndNode() {
  return (
    <div
      className="rounded-full border-2 border-muted-foreground/30 bg-muted px-4 py-2 flex items-center gap-2 shadow-sm"
      style={{ width: 180, height: 60 }}
    >
      <Handle id="l" type="target" position={Position.Left} style={{ background: "transparent", border: 0 }} />
      <Handle id="t" type="target" position={Position.Top} style={{ background: "transparent", border: 0 }} />
      <CheckCircle2 className="w-4 h-4 text-green-600" />
      <span className="text-xs font-medium">Fim do formulário</span>
    </div>
  );
}

const nodeTypes = { fieldNode: FieldNode, endNode: EndNode };

// ───────────────────────── Component ─────────────────────────

export function SmartOpsFormFlowPreview({
  formId,
  height = 600,
}: {
  formId: string;
  height?: number | string;
}) {
  const [fields, setFields] = useState<FlowField[]>([]);
  const [loading, setLoading] = useState(true);
  const lastHashRef = useRef<string>("");

  useEffect(() => {
    let active = true;

    const fetchFields = async () => {
      const { data } = await supabase
        .from("smartops_form_fields" as any)
        .select("id,label,field_type,required,order_index,workflow_cell_target,options,conditions")
        .eq("form_id", formId)
        .order("order_index");
      if (!active || !data) return;
      const hash = JSON.stringify(data);
      if (hash !== lastHashRef.current) {
        lastHashRef.current = hash;
        setFields(data as any);
      }
      if (loading) setLoading(false);
    };

    fetchFields();

    // Polling — funciona em qualquer máquina/aba
    const pollId = window.setInterval(fetchFields, 2000);

    // BroadcastChannel — refresh instantâneo entre abas do mesmo navegador
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`smartops-form-${formId}`);
      bc.onmessage = () => fetchFields();
    } catch {
      // navegador sem suporte — polling cobre
    }

    // Supabase Realtime — caso a publicação esteja habilitada
    const channel = supabase
      .channel(`form-fields-${formId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "smartops_form_fields", filter: `form_id=eq.${formId}` },
        () => fetchFields(),
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(pollId);
      bc?.close();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const { nodes, edges } = useMemo(() => buildGraph(fields), [fields]);

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

      <div className="rounded-md border bg-muted/10 flex-1" style={{ height }}>
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
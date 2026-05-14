import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, CornerDownRight, Eye, AlertTriangle } from "lucide-react";
import type { ConditionRule, ShowIf } from "@/lib/formConditions";

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

const OP_LABELS: Record<string, string> = {
  equals: "=",
  not_equals: "≠",
  in: "∈",
  not_in: "∉",
  is_empty: "está vazio",
  is_not_empty: "está preenchido",
};

function ruleToString(rule: ConditionRule, fieldsById: Map<string, FlowField>): string {
  const parent = fieldsById.get(rule.field_id);
  const parentLabel = parent ? parent.label : "campo removido";
  const op = OP_LABELS[rule.op] ?? rule.op;
  if (rule.op === "is_empty" || rule.op === "is_not_empty") {
    return `${parentLabel} ${op}`;
  }
  const val = Array.isArray(rule.value) ? rule.value.join(" ou ") : String(rule.value ?? "");
  return `${parentLabel} ${op} "${val}"`;
}

interface TreeNode {
  field: FlowField;
  depth: number;
  why: string | null;
  logic: "AND" | "OR" | null;
  orphan?: boolean;
}

function buildTree(fields: FlowField[]): TreeNode[] {
  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const childrenByParent = new Map<string, FlowField[]>();
  const roots: FlowField[] = [];

  for (const f of fields) {
    const showIf = (f.conditions as { show_if?: ShowIf } | null)?.show_if;
    const rules = showIf?.rules ?? [];
    if (!rules.length) {
      roots.push(f);
      continue;
    }
    // Anchor under the first rule's parent (most common case)
    const firstParentId = rules[0]?.field_id;
    if (firstParentId && fieldsById.has(firstParentId)) {
      const arr = childrenByParent.get(firstParentId) ?? [];
      arr.push(f);
      childrenByParent.set(firstParentId, arr);
    } else {
      roots.push(f);
    }
  }

  const out: TreeNode[] = [];
  const visited = new Set<string>();

  const walk = (field: FlowField, depth: number, why: string | null, logic: "AND" | "OR" | null) => {
    if (visited.has(field.id)) return;
    visited.add(field.id);
    out.push({ field, depth, why, logic });
    const kids = (childrenByParent.get(field.id) ?? []).sort((a, b) => a.order_index - b.order_index);
    for (const k of kids) {
      const showIf = (k.conditions as { show_if?: ShowIf } | null)?.show_if;
      const rules = showIf?.rules ?? [];
      const why = rules.map((r) => ruleToString(r, fieldsById)).join(showIf?.logic === "OR" ? " OU " : " E ");
      walk(k, depth + 1, why, showIf?.logic ?? "AND");
    }
  };

  for (const r of roots.sort((a, b) => a.order_index - b.order_index)) {
    walk(r, 0, null, null);
  }

  // Orphans (cycles or rules pointing to non-existent parent that wasn't caught)
  for (const f of fields) {
    if (!visited.has(f.id)) {
      out.push({ field: f, depth: 0, why: "(referência inválida)", logic: null, orphan: true });
    }
  }

  return out;
}

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

  const tree = useMemo(() => buildTree(fields), [fields]);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Carregando árvore…</p>;
  }

  if (!fields.length) {
    return <p className="text-xs text-muted-foreground">Nenhum campo cadastrado ainda.</p>;
  }

  const conditionalCount = fields.filter(
    (f) => ((f.conditions as { show_if?: ShowIf } | null)?.show_if?.rules?.length ?? 0) > 0,
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{fields.length} campos</Badge>
        <Badge variant="secondary">{conditionalCount} condicionais</Badge>
        <span>Visualize a hierarquia de perguntas e suas regras de exibição.</span>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-1">
        {tree.map(({ field, depth, why, logic, orphan }) => {
          const isMapping = !!field.workflow_cell_target;
          return (
            <div
              key={field.id}
              className="flex items-start gap-2 py-1"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              {depth > 0 ? (
                <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground mt-1 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-primary mt-1 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium">{field.label || "(sem label)"}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {field.field_type}
                  </Badge>
                  {field.required && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-red-600 border-red-200">
                      obrigatório
                    </Badge>
                  )}
                  {isMapping ? (
                    <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-100 text-amber-800 hover:bg-amber-100">
                      🗺️ Mapeamento
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] px-1 py-0 h-4 bg-green-100 text-green-800 hover:bg-green-100">
                      📋 Qualificação
                    </Badge>
                  )}
                  {orphan && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                      <AlertTriangle className="w-3 h-3 mr-0.5" /> órfão
                    </Badge>
                  )}
                </div>
                {why && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 italic">
                    exibe se ({logic === "OR" ? "qualquer" : "todas"}): {why}
                  </div>
                )}
                {Array.isArray(field.options) && field.options.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Opções: {field.options.map((o: any) => o?.label ?? o?.value ?? String(o)).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Eye className="w-3 h-3" />
        Quando uma pergunta tem múltiplas regras (ex.: depende de 2 pais), ela é ancorada sob o primeiro pai;
        as demais condições aparecem na linha "exibe se".
      </p>
    </div>
  );
}
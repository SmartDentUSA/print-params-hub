import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type NodeProps, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Package, Instagram, BookOpen, Calendar, GraduationCap, Mail } from "lucide-react";

export const CONTENT_SOURCES = [
  { key: "product_ids", list: "products", label: "Produtos", Icon: Package },
  { key: "post_ids", list: "posts", label: "Publicações Instagram", Icon: Instagram },
  { key: "knowledge_ids", list: "kb", label: "Base de conhecimento", Icon: BookOpen },
  { key: "event_ids", list: "events", label: "Eventos", Icon: Calendar },
  { key: "course_ids", list: "courses", label: "Cursos / turmas", Icon: GraduationCap },
] as const;
export type ContentKey = typeof CONTENT_SOURCES[number]["key"];
export type ContentSelection = Record<ContentKey, string[]>;
export const emptyContentSelection = (): ContentSelection => ({ product_ids: [], post_ids: [], knowledge_ids: [], event_ids: [], course_ids: [] });

function ContentNode({ data, selected }: NodeProps) {
  const source = CONTENT_SOURCES.find((s) => s.key === data.source);
  const Icon = source?.Icon || Mail;
  return <div className={`w-[230px] border rounded-lg bg-card shadow-sm ${selected ? "ring-2 ring-primary" : ""}`}>
    {!source && <Handle type="target" position={Position.Top} />}
    <div className="flex gap-2 items-center p-3 border-b text-xs font-semibold"><Icon className="w-4 h-4 text-primary" />{source?.label || "Corpo do e-mail"}</div>
    <div className="p-3 text-xs text-muted-foreground min-h-16 break-words">{String(data.summary)}</div>
    {source && <Handle type="source" position={Position.Bottom} />}
  </div>;
}
const nodeTypes = { content: ContentNode };
export function EmailContentCanvas({ selection, lists, active, onSelect }: { selection: ContentSelection; lists: Record<string, any[]>; active: ContentKey; onSelect: (k: ContentKey) => void }) {
  const nodes: Node[] = CONTENT_SOURCES.map((s, i) => {
    const chosen = (lists[s.list] || []).filter((x) => selection[s.key].includes(x.id));
    return { id: s.key, type: "content", selected: active === s.key, position: { x: i * 270, y: 0 }, data: { source: s.key, summary: selection[s.key].length ? `${selection[s.key].length} selecionado(s) · ${chosen.map((x) => x.name || x.title || x.caption || "Publicação").join(" · ").slice(0, 110)}` : "Nenhum conteúdo selecionado" } };
  });
  nodes.push({ id: "email", type: "content", selected: false, position: { x: 540, y: 230 }, data: { source: "email", summary: "E-mail com os conteúdos selecionados" } });
  const edges = CONTENT_SOURCES.filter((s) => selection[s.key].length > 0).map((s) => ({ id: s.key, source: s.key, target: "email", markerEnd: { type: MarkerType.ArrowClosed } }));
  return <div className="h-72 border rounded-lg bg-muted/20"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} onNodeClick={(_, n) => { const source = CONTENT_SOURCES.find((s) => s.key === n.id); if (source) onSelect(source.key); }} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null}><Background /><Controls showInteractive={false} /></ReactFlow></div>;
}
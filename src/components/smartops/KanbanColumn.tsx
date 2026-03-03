import { Badge } from "@/components/ui/badge";
import { KanbanLeadCard, type Lead } from "./KanbanLeadCard";

export interface ColumnDef {
  key: string;
  label: string;
  color: string;
}

interface KanbanColumnProps {
  column: ColumnDef;
  leads: Lead[];
  showDays?: boolean;
  onDragStart: (id: string) => void;
  onDrop: (status: string) => void;
  onClick: (lead: Lead) => void;
}

export function KanbanColumn({ column, leads, showDays = false, onDragStart, onDrop, onClick }: KanbanColumnProps) {
  return (
    <div
      className={`rounded-lg border-2 ${column.color} p-2 flex-shrink-0 flex flex-col`}
      style={{ width: 200, minHeight: 120 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(column.key)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="font-semibold text-[11px] truncate">{column.label}</h4>
        <Badge variant="secondary" className="text-[9px] px-1 py-0">{leads.length}</Badge>
      </div>
      <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[55vh]">
        {leads.map((lead) => (
          <KanbanLeadCard key={lead.id} lead={lead} showDaysStagnant={showDays} onDragStart={onDragStart} onClick={onClick} />
        ))}
        {leads.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">—</p>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrainingDeliverables, type TrainingDeliverable } from '@/hooks/social/useTrainingDeliverables';
import { DeliverableCard } from './DeliverableCard';
import { EditDeliverableDialog } from './EditDeliverableDialog';

export function TrainingApprovals() {
  const { data = [], isLoading } = useTrainingDeliverables();
  const [editing, setEditing] = useState<TrainingDeliverable | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Aprovações de Treinamentos</h2>
        {!!data.length && <Badge variant="secondary">{data.length}</Badge>}
      </div>

      {isLoading && <Card className="p-4 text-sm text-muted-foreground">Carregando entregáveis…</Card>}

      {!isLoading && !data.length && (
        <Card className="p-4 text-sm text-muted-foreground">
          Nenhum kit de conteúdo aguardando aprovação.
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((d) => (
          <DeliverableCard key={d.id} deliverable={d} onEdit={setEditing} />
        ))}
      </div>

      <EditDeliverableDialog deliverable={editing} open={!!editing} onClose={() => setEditing(null)} />
    </section>
  );
}
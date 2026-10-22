import { Eye } from 'lucide-react';

export function PandaVideoViewCount({ views, syncedAt }: { views: number | null; syncedAt: string | null }) {
  if (views === null || !syncedAt) return null;
  return <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" title={`PandaVideo · Atualizado em ${new Date(syncedAt).toLocaleString('pt-BR')}`}>
    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
    <span>{views.toLocaleString('pt-BR')} visualizações</span>
  </div>;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ResinDocKind = 'FDS' | 'IFU' | 'GUIA' | 'PERFIL' | 'CERT' | 'LAUDO' | 'APRES' | 'MSDS' | 'DOC';
export interface ResinDocItem { name: string; url: string; kind: ResinDocKind; }

const ICON: Record<ResinDocKind, string> = {
  FDS: '📄', IFU: '📘', GUIA: '📗', PERFIL: '📋',
  CERT: '🏅', LAUDO: '🧪', APRES: '🎯', MSDS: '⚠️', DOC: '📎',
};

const SECTIONS: { title: string; kinds: ResinDocKind[] }[] = [
  { title: 'Certificados & Registros', kinds: ['CERT', 'MSDS'] },
  { title: 'Laudos & Estudos Clínicos', kinds: ['LAUDO'] },
  { title: 'Apresentações & Materiais', kinds: ['APRES'] },
  { title: 'Guias & Outros', kinds: ['GUIA', 'PERFIL', 'DOC', 'FDS', 'IFU'] },
];

interface Props {
  open: boolean;
  onClose: () => void;
  resinName: string | null;
  docs: ResinDocItem[];
}

export default function KbResinDocsDialog({ open, onClose, resinName, docs }: Props) {
  const open_ = (u: string) => window.open(u, '_blank', 'noopener,noreferrer');
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📑 Documentos — {resinName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {SECTIONS.map((sec) => {
            const items = docs.filter((d) => sec.kinds.includes(d.kind));
            if (items.length === 0) return null;
            return (
              <div key={sec.title}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {sec.title} <span className="opacity-60">({items.length})</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((d, i) => (
                    <li
                      key={`${d.url}-${i}`}
                      className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2 hover:bg-accent/40 transition-colors cursor-pointer"
                      onClick={() => open_(d.url)}
                    >
                      <span className="text-base leading-tight pt-0.5">{ICON[d.kind]}</span>
                      <span className="flex-1 text-sm leading-snug text-foreground break-words">{d.name}</span>
                      <span className="text-xs text-primary font-medium whitespace-nowrap">Abrir →</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {docs.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhum documento disponível.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
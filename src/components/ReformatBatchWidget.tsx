import { Loader2, StopCircle, X, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { reformatBatch, useReformatBatchState } from '@/lib/reformatBatchRunner';

export function ReformatBatchWidget() {
  const state = useReformatBatchState();
  const [collapsed, setCollapsed] = useState(false);

  // Show while running, or when there is a finished (non-dismissed) run to review.
  const showFinished = !state.running && state.total > 0 && !state.dismissed;
  if (!state.running && !showFinished) return null;

  const pct = state.total ? (state.done / state.total) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-primary/40 bg-background shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {state.running ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Zap className="h-4 w-4 text-primary" />
          )}
          <span>Reformatação IA em lote</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {!state.running && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => reformatBatch.dismiss()}
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">
              {state.done}/{state.total}
            </span>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              ✅ {state.ok}
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              ⏭️ {state.skipped}
            </Badge>
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              ❌ {state.err}
            </Badge>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          {state.running && state.currentTitle && (
            <p className="truncate text-xs text-muted-foreground">
              Processando: <span className="text-foreground">{state.currentTitle}</span>
            </p>
          )}

          {!state.running && (
            <p className="text-xs text-muted-foreground">
              Lote concluído — {state.ok} ok · {state.skipped} pulados · {state.err} erros
            </p>
          )}

          {state.log.length > 0 && (
            <div className="max-h-32 space-y-0.5 overflow-y-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
              {state.log.slice(0, 8).map((line, idx) => (
                <div key={idx} className="truncate">
                  {line}
                </div>
              ))}
            </div>
          )}

          {state.running && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              onClick={() => reformatBatch.cancel()}
            >
              <StopCircle className="mr-2 h-4 w-4" />
              Cancelar lote
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
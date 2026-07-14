import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { usePiperunPipelines, usePiperunStages, usePiperunLossReasons } from "@/hooks/piperun/usePiperunPipelines";

interface BaseProps {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PipelineSelect({ value, onChange, placeholder = "Selecionar pipeline…", disabled }: BaseProps) {
  const { data, isLoading, error } = usePiperunPipelines();
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v || null)} disabled={disabled || isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</span>
        ) : (
          <SelectValue placeholder={error ? "Erro ao carregar" : placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((it) => (
          <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StageSelect({ pipelineId, value, onChange, placeholder = "Selecionar etapa…", disabled }: BaseProps & { pipelineId?: string | null }) {
  const { data, isLoading } = usePiperunStages(pipelineId);
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v || null)} disabled={disabled || !pipelineId || isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</span>
        ) : (
          <SelectValue placeholder={!pipelineId ? "Selecione o pipeline primeiro" : placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((it) => (
          <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LossReasonSelect({ value, onChange, placeholder = "Selecionar motivo…", disabled }: BaseProps) {
  const { data, isLoading } = usePiperunLossReasons();
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v || null)} disabled={disabled || isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((it) => (
          <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import { Loader2 } from "lucide-react";

interface Props {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}

export function SellerSelect({ value, onChange, placeholder = "Selecionar vendedor…" }: Props) {
  const { data, isLoading } = useActiveTeamMembers();
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v || null)} disabled={isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((tm) => (
          <SelectItem key={tm.id} value={tm.id}>
            {tm.nome_completo}{tm.role ? ` — ${tm.role}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SellerMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { data, isLoading } = useActiveTeamMembers();
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  if (isLoading) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</div>;
  return (
    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-auto border rounded-md p-2">
      {(data ?? []).map((tm) => (
        <label key={tm.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={value.includes(tm.id)} onChange={() => toggle(tm.id)} />
          <span className="truncate">{tm.nome_completo}</span>
        </label>
      ))}
    </div>
  );
}
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

export function AudienceListSelect({ value, onChange, options = [], placeholder = "Selecionar" }: { value: string[]; onChange: (v: string[]) => void; options?: string[]; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => [...new Set([...value, ...options])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")), [value, options]);
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between h-auto min-h-9 text-xs whitespace-normal text-left"><span className="min-w-0">{value.length ? `${value.length} selecionado(s): ${value.join(", ")}` : placeholder}</span><ChevronDown className="w-4 h-4 shrink-0 ml-2" /></Button></PopoverTrigger>
    <PopoverContent className="w-80 p-2" align="start"><Input placeholder="Buscar na lista…" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="max-h-64 overflow-auto mt-2 space-y-1">{items.filter((x) => x.toLowerCase().includes(query.toLowerCase())).map((x) => <label key={x} className="flex gap-2 items-start p-2 text-xs hover:bg-muted cursor-pointer"><Checkbox checked={value.includes(x)} onCheckedChange={(checked) => onChange(checked ? [...value, x] : value.filter((v) => v !== x))} /><span className="break-words min-w-0">{x}</span></label>)}{!items.length && <p className="p-2 text-xs text-muted-foreground">Nenhuma opção disponível.</p>}</div></PopoverContent>
  </Popover>;
}

export function PipelineStageSelect({ entries, pipeline = "", stage = "", onChange }: { entries: { pipeline: string; stage: string }[]; pipeline?: string; stage?: string; onChange: (v: { pipeline: string; stage: string }) => void }) {
  const pipelines = [...new Set(entries.map((p) => p.pipeline).filter(Boolean))].sort();
  const stages = [...new Set(entries.filter((p) => !pipeline || p.pipeline === pipeline).map((p) => p.stage).filter(Boolean))].sort();
  return <div className="space-y-2"><div><Label className="text-xs">Funil do CRM</Label><Select value={pipeline || "__any"} onValueChange={(v) => onChange({ pipeline: v === "__any" ? "" : v, stage: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__any">Todos os funis</SelectItem>{[...new Set([...pipelines, pipeline].filter(Boolean))].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
    <div><Label className="text-xs">Etapa do funil</Label><Select value={stage || "__any"} onValueChange={(v) => onChange({ pipeline, stage: v === "__any" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__any">Todas as etapas</SelectItem>{[...new Set([...stages, stage].filter(Boolean))].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div></div>;
}
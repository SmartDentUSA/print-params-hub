import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, RefreshCw } from "lucide-react";

type Provider = "poe" | "lovable" | "deepseek" | "google" | "openai";

interface RoutingRow {
  task_type: string;
  description: string | null;
  modality: string;
  primary_provider: Provider;
  primary_model: string;
  fallback_provider: Provider | null;
  fallback_model: string | null;
  input_cost_per_m: number;
  output_cost_per_m: number;
  max_tokens: number;
  temperature: number;
  enabled: boolean;
  notes: string | null;
}

const PROVIDERS: Provider[] = ["poe", "lovable", "deepseek", "google", "openai"];

// Sugestões de modelos conhecidos por provedor (autocomplete leve).
const MODEL_PRESETS: Record<Provider, string[]> = {
  poe: [
    "claude-opus-4.8", "claude-opus-4.7", "claude-sonnet-4.6", "claude-haiku-4.5",
    "gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
    "gpt-5.3-codex", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro",
    "gemini-3.5-flash", "deepseek-v3.2", "grok-4.3", "nano-banana-pro", "gpt-image-2",
  ],
  lovable: [
    "google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite-preview",
    "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "google/gemini-2.5-pro",
    "openai/gpt-5", "openai/gpt-5-mini", "openai/gpt-5-nano",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
};

export function SmartOpsAIRouting() {
  const [rows, setRows] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, Partial<RoutingRow>>>({});
  const [savingTask, setSavingTask] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_model_routing")
      .select("*")
      .order("task_type");
    if (error) {
      toast.error(`Falha ao carregar: ${error.message}`);
    } else {
      setRows((data ?? []) as RoutingRow[]);
      setEdits({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (task: string, p: Partial<RoutingRow>) => {
    setEdits((prev) => ({ ...prev, [task]: { ...prev[task], ...p } }));
  };

  const save = async (task: string) => {
    const changes = edits[task];
    if (!changes) return;
    setSavingTask(task);
    const { error } = await supabase
      .from("ai_model_routing")
      .update(changes)
      .eq("task_type", task);
    setSavingTask(null);
    if (error) {
      toast.error(`Erro: ${error.message}`);
    } else {
      toast.success(`${task} atualizado`);
      await load();
    }
  };

  const toggleEnabled = async (task: string, enabled: boolean) => {
    const { error } = await supabase
      .from("ai_model_routing")
      .update({ enabled })
      .eq("task_type", task);
    if (error) toast.error(error.message);
    else { toast.success(`${task} ${enabled ? "ativado" : "desativado"}`); load(); }
  };

  const grouped = useMemo(() => {
    const auto = rows.filter((r) => r.task_type.startsWith("auto_"));
    const tasks = rows.filter((r) => !r.task_type.startsWith("auto_"));
    return { tasks, auto };
  }, [rows]);

  const renderTable = (list: RoutingRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Tarefa</TableHead>
          <TableHead>Primário</TableHead>
          <TableHead>Fallback</TableHead>
          <TableHead className="w-[100px]">Custo $/M</TableHead>
          <TableHead className="w-[80px]">Ativo</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((r) => {
          const e = edits[r.task_type] ?? {};
          const merged = { ...r, ...e };
          const dirty = !!edits[r.task_type];
          return (
            <TableRow key={r.task_type}>
              <TableCell>
                <div className="font-mono text-xs font-semibold">{r.task_type}</div>
                {r.description && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{r.description}</div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <select
                    className="text-xs border rounded px-1 bg-background"
                    value={merged.primary_provider}
                    onChange={(ev) => patch(r.task_type, { primary_provider: ev.target.value as Provider })}
                  >
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <Input
                    className="h-7 text-xs font-mono"
                    list={`models-${r.task_type}-p`}
                    value={merged.primary_model}
                    onChange={(ev) => patch(r.task_type, { primary_model: ev.target.value })}
                  />
                  <datalist id={`models-${r.task_type}-p`}>
                    {MODEL_PRESETS[merged.primary_provider]?.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <select
                    className="text-xs border rounded px-1 bg-background"
                    value={merged.fallback_provider ?? ""}
                    onChange={(ev) => patch(r.task_type, { fallback_provider: (ev.target.value || null) as Provider | null })}
                  >
                    <option value="">—</option>
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <Input
                    className="h-7 text-xs font-mono"
                    list={`models-${r.task_type}-f`}
                    value={merged.fallback_model ?? ""}
                    onChange={(ev) => patch(r.task_type, { fallback_model: ev.target.value || null })}
                    disabled={!merged.fallback_provider}
                  />
                  <datalist id={`models-${r.task_type}-f`}>
                    {merged.fallback_provider && MODEL_PRESETS[merged.fallback_provider]?.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                  <span>in: {Number(merged.input_cost_per_m).toFixed(2)}</span>
                  <span>out: {Number(merged.output_cost_per_m).toFixed(2)}</span>
                </div>
              </TableCell>
              <TableCell>
                <Switch checked={r.enabled} onCheckedChange={(v) => toggleEnabled(r.task_type, v)} />
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant={dirty ? "default" : "ghost"}
                  disabled={!dirty || savingTask === r.task_type}
                  onClick={() => save(r.task_type)}
                >
                  {savingTask === r.task_type
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Save className="w-3 h-3" />}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Routing</h2>
          <p className="text-sm text-muted-foreground">
            Orquestração de modelos por tarefa. Provedores: <Badge variant="outline">Poe</Badge> <Badge variant="outline">Lovable Gateway</Badge> <Badge variant="outline">DeepSeek</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas operacionais</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            renderTable(grouped.tasks)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presets automáticos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Use <code className="font-mono">task: "auto_cheap" | "auto_balanced" | "auto_premium" | "auto_code"</code> em chamadas dinâmicas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {renderTable(grouped.auto)}
        </CardContent>
      </Card>
    </div>
  );
}
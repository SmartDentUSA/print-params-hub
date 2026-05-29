import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RefreshCw, Users, Plus, Pencil, Eye, Search, ShieldAlert, Activity,
  PauseCircle, PlayCircle, Clock, Send, X,
} from "lucide-react";
import type { WaGroupSummary, WaInstanceInfo } from "./types";
import { WaGroupFlowBuilder } from "./WaGroupFlowBuilder";
import { WaGroupBlastModal } from "./WaGroupBlastModal";

const statusVariant: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  finished: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  error: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  finished: "Concluída",
  error: "Erro",
};

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SmartOpsWaGroupCampaigns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<WaGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [builderGroupId, setBuilderGroupId] = useState<string | null>(null);
  const [builderCampaignId, setBuilderCampaignId] = useState<string | null>(null);
  const [instances, setInstances] = useState<WaInstanceInfo[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blastOpen, setBlastOpen] = useState(false);

  // Load available instances on mount (sem sync — só lê do retorno)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("wa-sync-groups", { body: {} });
        const list: WaInstanceInfo[] = (data?.instances ?? []).filter((i: any) => i?.instanceName);
        setInstances(list);
        if (list.length > 0 && !selectedInstance) setSelectedInstance(list[0].instanceName);
      } catch {
        // silent — view still works with whatever wa_groups has
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("v_wa_group_summary")
      .select("*");
    if (selectedInstance) q = q.eq("instance_name", selectedInstance);
    const { data, error } = await q
      .order("is_admin", { ascending: false })
      .order("group_name", { ascending: true });
    if (error) {
      toast.error("Falha ao carregar grupos: " + error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as WaGroupSummary[]);
    setLoading(false);
  }, [selectedInstance]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Realtime: refetch on wa_campaigns or wa_message_queue change
  useEffect(() => {
    const channel = (supabase as any)
      .channel("wa-group-campaigns")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_campaigns" }, () => fetchRows())
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_message_queue" }, () => fetchRows())
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_groups" }, () => fetchRows())
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_campaign_groups" }, () => fetchRows())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [fetchRows]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const body = selectedInstance ? { instance_name: selectedInstance } : {};
      const { data, error } = await supabase.functions.invoke("wa-sync-groups", { body });
      if (error) throw error;
      toast.success(`Sincronizados ${data?.synced ?? 0} grupos`);
      if (Array.isArray(data?.instances)) setInstances(data.instances);
      await fetchRows();
    } catch (err: any) {
      toast.error("Falha no sync: " + (err?.message ?? String(err)));
    } finally {
      setSyncing(false);
    }
  };

  const handlePauseResume = async (row: WaGroupSummary) => {
    if (!row.campaign_id) return;
    const newStatus = row.campaign_status === "active" ? "paused" : "active";
    const { error } = await (supabase as any)
      .from("wa_campaigns")
      .update({ status: newStatus })
      .eq("id", row.campaign_id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "paused" ? "Campanha pausada" : "Campanha retomada");
    fetchRows();
  };

  const handleToggleEnabled = async (row: WaGroupSummary, next: boolean) => {
    const { error } = await (supabase as any)
      .from("wa_groups")
      .update({ enabled: next })
      .eq("id", row.group_id);
    if (error) { toast.error(error.message); return; }
    fetchRows();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.group_name ?? "").toLowerCase().includes(q) ||
      (r.campaign_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const adminCount = rows.filter(r => r.is_admin).length;
  const activeCount = rows.filter(r => r.campaign_status === "active").length;
  const selectedRows = rows.filter(r => selectedIds.includes(r.group_id));
  const selectedMembers = selectedRows.reduce((s, r) => s + (r.member_count ?? 0), 0);

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Campanhas em Grupos WhatsApp</h3>
          <Badge variant="secondary">{rows.length} grupos</Badge>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
            {adminCount} admin
          </Badge>
          <Badge variant="outline" className="border-primary/40">
            {activeCount} ativas
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {instances.length > 0 && (
            <Select value={selectedInstance} onValueChange={setSelectedInstance} disabled={instances.length === 1}>
              <SelectTrigger className="h-9 w-[200px] text-xs">
                <SelectValue placeholder="Instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.instanceName} value={i.instanceName}>
                    {i.profileName ? `${i.profileName} (${i.instanceName})` : i.instanceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectionMode(s => !s); setSelectedIds([]); }}
          >
            {selectionMode ? <X className="w-4 h-4 mr-2" /> : <Checkbox className="mr-2" checked={false} />}
            {selectionMode ? "Sair da seleção" : "Selecionar grupos"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar grupos"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar grupo ou campanha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Users className="w-12 h-12 opacity-40" />
          <p>Nenhum grupo encontrado. Clique em "Sincronizar grupos".</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${selectionMode ? "pb-24" : ""}`}>
          {filtered.map(row => {
            const disabled = !row.is_admin;
            const hasCampaign = !!row.campaign_id;
            const progress = row.total_nodes && row.total_nodes > 0
              ? Math.round(((row.current_node_index ?? 0) / row.total_nodes) * 100)
              : 0;
            const isSelected = selectedIds.includes(row.group_id);
            const canSelect = row.is_admin && row.enabled;
            const dimmed = !row.enabled;
            return (
              <Card
                key={row.group_id}
                className={`flex flex-col transition-shadow ${dimmed ? "opacity-50" : "hover:shadow-md"} ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {selectionMode && (
                        <Checkbox
                          checked={isSelected}
                          disabled={!canSelect}
                          onCheckedChange={() => canSelect && toggleSelect(row.group_id)}
                          className="mt-0.5"
                        />
                      )}
                      <CardTitle className="text-sm line-clamp-2 flex-1">{row.group_name ?? "Grupo sem nome"}</CardTitle>
                    </div>
                    {row.is_admin ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 shrink-0">
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 shrink-0">
                        <ShieldAlert className="w-3 h-3 mr-1" /> Não admin
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      {row.member_count ?? 0} membros
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[10px]">{row.enabled ? "ativado" : "desativ."}</span>
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(v) => handleToggleEnabled(row, v)}
                      />
                    </label>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                  {hasCampaign ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge className={statusVariant[row.campaign_status ?? "draft"]}>
                          {statusLabel[row.campaign_status ?? "draft"]}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">{row.campaign_name}</span>
                        {row.in_shared_campaign && (
                          <Badge variant="outline" className="text-[10px] border-primary/40">compartilhada</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Nó {(row.current_node_index ?? 0) + 1} de {row.total_nodes ?? 0}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="rounded bg-muted/40 p-1.5">
                          <div className="font-semibold text-emerald-600">{row.msgs_sent ?? 0}</div>
                          <div className="text-muted-foreground">Enviadas</div>
                        </div>
                        <div className="rounded bg-muted/40 p-1.5">
                          <div className="font-semibold">{row.msgs_pending ?? 0}</div>
                          <div className="text-muted-foreground">Pendentes</div>
                        </div>
                        <div className="rounded bg-muted/40 p-1.5">
                          <div className="font-semibold text-red-600">{row.msgs_failed ?? 0}</div>
                          <div className="text-muted-foreground">Falhas</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Próximo: {formatDateTime(row.next_send_at)}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sem campanha ativa</p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            variant={hasCampaign ? "outline" : "default"}
                            disabled={disabled}
                            onClick={() => {
                              setBuilderGroupId(row.group_id);
                              setBuilderCampaignId(row.campaign_id);
                            }}
                          >
                            {hasCampaign ? <Pencil className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                            {hasCampaign ? "Editar" : "Criar régua"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {disabled && <TooltipContent>Somente grupos onde somos admin</TooltipContent>}
                    </Tooltip>
                    {hasCampaign && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/smartops/wa-flow-visualizer?campaign_id=${row.campaign_id}`)}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Visualizar
                        </Button>
                        {(row.campaign_status === "active" || row.campaign_status === "paused") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePauseResume(row)}
                          >
                            {row.campaign_status === "active"
                              ? <><PauseCircle className="w-3 h-3 mr-1" /> Pausar</>
                              : <><PlayCircle className="w-3 h-3 mr-1" /> Retomar</>}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Selection footer */}
      {selectionMode && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm">
            <strong>{selectedIds.length}</strong> grupos selecionados · <strong>{selectedMembers}</strong> membros
          </span>
          <Button size="sm" onClick={() => setBlastOpen(true)}>
            <Send className="w-3 h-3 mr-1" /> Blast pontual
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Builder Sheet */}
      {builderGroupId && (
        <WaGroupFlowBuilder
          open={!!builderGroupId}
          groupId={builderGroupId}
          campaignId={builderCampaignId}
          onClose={() => { setBuilderGroupId(null); setBuilderCampaignId(null); }}
          onSaved={() => { setBuilderGroupId(null); setBuilderCampaignId(null); fetchRows(); }}
        />
      )}

      <WaGroupBlastModal
        open={blastOpen}
        onClose={() => setBlastOpen(false)}
        onSent={() => { setBlastOpen(false); setSelectionMode(false); setSelectedIds([]); fetchRows(); }}
        selectedGroupJids={selectedRows.map(r => r.group_jid)}
        selectedGroupNames={selectedRows.map(r => r.group_name ?? "")}
      />
    </div>
    </TooltipProvider>
  );
}

export default SmartOpsWaGroupCampaigns;
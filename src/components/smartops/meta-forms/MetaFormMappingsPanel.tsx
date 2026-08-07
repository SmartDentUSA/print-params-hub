import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Search, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useMetaFormMappings,
  useLeadOrigins,
  useCatalogProductOptions,
  useSaveMetaFormMapping,
  useIsAdminUser,
  useSetOriginAcquisitionType,
  type MetaFormMapping,
  type LeadOrigin,
  type AcquisitionType,
} from "@/hooks/useMetaFormMappings";
import { WORKFLOW_7X3_CELLS, workflowCellLabel } from "@/lib/workflowCells";

const NONE = "__none__";

const ORIGIN_TYPE_LABEL: Record<string, string> = {
  meta: "Meta / Social",
  sistema: "Formulário do sistema",
  integracao: "Integração",
  outbound: "Outbound",
  inbound: "Inbound",
};

const SOURCE_KIND_LABEL: Record<string, string> = {
  meta_form: "Formulário Meta",
  system_form: "Formulário do sistema",
  origin: "Origem de lead",
};

const AUTO = "__auto__";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

interface EditorState {
  id?: string;
  form_id: string;
  form_name_meta: string;
  origin_system_b: string;
  product_catalog_id: string;
  product_name: string;
  workflow_stage_target: string;
  commercial_eligible: boolean;
  active: boolean;
}

function emptyEditor(form_id = "", form_name = "", workflow?: string | null): EditorState {
  return {
    form_id,
    form_name_meta: form_name,
    origin_system_b: form_name,
    product_catalog_id: NONE,
    product_name: "",
    workflow_stage_target: workflow || NONE,
    commercial_eligible: true,
    active: true,
  };
}

function fromMapping(m: MetaFormMapping): EditorState {
  return {
    id: m.id,
    form_id: m.form_id,
    form_name_meta: m.form_name_meta ?? "",
    origin_system_b: m.origin_system_b ?? "",
    product_catalog_id: m.product_catalog_id ?? NONE,
    product_name: m.product_name ?? "",
    workflow_stage_target: m.workflow_stage_target ?? NONE,
    commercial_eligible: m.commercial_eligible,
    active: m.active,
  };
}

export function MetaFormMappingsPanel() {
  const { data: mappings, isLoading, refetch: refetchMappings } = useMetaFormMappings();
  const { data: origins, isLoading: loadingOrigins, refetch: refetchOrigins } = useLeadOrigins();
  const { data: products } = useCatalogProductOptions();
  const { data: isAdmin } = useIsAdminUser();
  const save = useSaveMetaFormMapping();
  const setAcquisition = useSetOriginAcquisitionType();

  const [search, setSearch] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [acqFilter, setAcqFilter] = useState("all");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mappings ?? [];
    return (mappings ?? []).filter((m) =>
      [m.form_id, m.form_name_meta, m.origin_system_b, m.product_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [mappings, search]);

  const canWrite = !!isAdmin;

  const unmappedOrigins = useMemo(() => {
    const q = originSearch.trim().toLowerCase();
    return (origins ?? [])
      .filter((o) => !o.mapped)
      .filter((o) => typeFilter === "all" || o.origin_type === typeFilter)
      .filter((o) => acqFilter === "all" || o.acquisition_type === acqFilter)
      .filter((o) =>
        !q ||
        [o.origin_key, o.origin_name].some((v) => String(v ?? "").toLowerCase().includes(q))
      );
  }, [origins, originSearch, typeFilter, acqFilter]);

  const handleAcquisitionChange = async (o: LeadOrigin, value: string) => {
    try {
      await setAcquisition.mutateAsync({
        originKey: o.origin_key,
        type: value === AUTO ? null : (value as AcquisitionType),
        originName: o.origin_name,
      });
      toast.success(
        value === AUTO
          ? "Classificação manual removida (volta à detecção automática)"
          : `Origem marcada como ${value === "outbound" ? "Outbound" : "Inbound"}`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao classificar origem");
    }
  };

  const openOriginEditor = (o: LeadOrigin) => {
    const existing = (mappings ?? []).find((m) => m.form_id === o.origin_key);
    if (existing) {
      setEditor(fromMapping(existing));
      return;
    }
    setEditor(emptyEditor(o.origin_key, o.origin_name, o.workflow_stage_target));
  };

  const handleSave = async () => {
    if (!editor) return;
    if (!editor.form_id.trim()) {
      toast.error("form_id é obrigatório");
      return;
    }
    try {
      await save.mutateAsync({
        id: editor.id,
        values: {
          form_id: editor.form_id.trim(),
          form_name_meta: editor.form_name_meta.trim() || null,
          origin_system_b: editor.origin_system_b.trim() || null,
          product_catalog_id: editor.product_catalog_id === NONE ? null : editor.product_catalog_id,
          product_name: editor.product_name.trim() || null,
          workflow_stage_target: editor.workflow_stage_target === NONE ? null : editor.workflow_stage_target,
          commercial_eligible: editor.commercial_eligible,
          active: editor.active,
        },
      });
      toast.success(editor.id ? "Mapeamento atualizado" : "Mapeamento criado");
      setEditor(null);
      refetchOrigins();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gravar");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Origens</CardTitle>
            <CardDescription>
              Fonte única de verdade das origens de leads — formulários Meta, formulários do sistema e
              demais canais → produto → célula do Workflow 7×3.
              {!canWrite && " Você tem acesso somente leitura (edição restrita a administradores)."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-64"
                placeholder="Buscar formulário, produto, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => { refetchMappings(); refetchOrigins(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canWrite && (
              <Button onClick={() => setEditor(emptyEditor())}>
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum formulário encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem / Produto</TableHead>
                  <TableHead>Célula 7×3</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.form_name_meta || m.origin_system_b || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{m.form_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Ativo" : "Inativo"}</Badge>
                        {m.commercial_eligible && <Badge variant="outline">Comercial</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate">{m.origin_system_b || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.product_name || "sem produto"}</div>
                    </TableCell>
                    <TableCell className="text-xs">{workflowCellLabel(m.workflow_stage_target) ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.leads_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canWrite}
                        onClick={() => setEditor(fromMapping(m))}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Origens não associadas
              {unmappedOrigins.length > 0 && <Badge variant="destructive">{unmappedOrigins.length}</Badge>}
            </CardTitle>
            <CardDescription>
              Todas as origens que já aparecem em leads reais — formulários Meta, formulários do sistema e
              demais canais (inbound, outbound e integrações) — que ainda não têm mapeamento cadastrado.
              Use a coluna <strong>Aquisição</strong> para informar ao sistema se a origem é Inbound ou
              Outbound — isso alimenta a separação Inbound/Outbound do Painel Comercial.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-56"
                placeholder="Buscar origem..."
                value={originSearch}
                onChange={(e) => setOriginSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(ORIGIN_TYPE_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={acqFilter} onValueChange={setAcqFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Inbound + Outbound</SelectItem>
                <SelectItem value="inbound">Só Inbound</SelectItem>
                <SelectItem value="outbound">Só Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingOrigins ? (
            <Skeleton className="h-20 w-full" />
          ) : unmappedOrigins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma origem pendente com os filtros atuais.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Nome atual</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-44">Aquisição</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Ativos (90d)</TableHead>
                  <TableHead>Célula 7×3</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedOrigins.map((o) => (
                  <TableRow key={`${o.source_kind}:${o.origin_key}`}>
                    <TableCell className="max-w-[260px]">
                      <div className="font-mono text-xs truncate">{o.origin_key}</div>
                      <div className="text-xs text-muted-foreground">
                        {SOURCE_KIND_LABEL[o.source_kind] ?? o.source_kind}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate">{o.origin_name || "(sem nome)"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.is_active ? "outline" : "secondary"}>
                        {ORIGIN_TYPE_LABEL[o.origin_type] ?? o.origin_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.acquisition_source === "manual" ? o.acquisition_type : AUTO}
                        disabled={!canWrite || setAcquisition.isPending}
                        onValueChange={(v) => handleAcquisitionChange(o, v)}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO}>
                            Automático ({o.acquisition_type === "outbound" ? "Outbound" : "Inbound"})
                          </SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.leads_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.active_leads_count}</TableCell>
                    <TableCell className="text-xs">
                      {workflowCellLabel(o.workflow_stage_target) ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(o.first_lead_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canWrite}
                        title="Editar origem"
                        onClick={() => openOriginEditor(o)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Editar mapeamento" : "Novo mapeamento"}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{editor?.form_id || "novo form_id"}</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-3">
              {!editor.id && (
                <div>
                  <Label className="text-xs">Chave da origem (form ID Meta, slug do formulário ou nome da origem)</Label>
                  <Input
                    value={editor.form_id}
                    onChange={(e) => setEditor({ ...editor, form_id: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Nome do formulário / origem</Label>
                <Input
                  value={editor.form_name_meta}
                  onChange={(e) => setEditor({ ...editor, form_name_meta: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Nome de exibição da origem</Label>
                <Input
                  value={editor.origin_system_b}
                  onChange={(e) => setEditor({ ...editor, origin_system_b: e.target.value })}
                  placeholder="ex: Meta — Scanner Intraoral"
                />
              </div>
              <div>
                <Label className="text-xs">Produto de interesse (catálogo)</Label>
                <Select
                  value={editor.product_catalog_id}
                  onValueChange={(v) => {
                    const p = products?.find((x) => x.id === v);
                    setEditor({
                      ...editor,
                      product_catalog_id: v,
                      product_name: p ? p.name : editor.product_name,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {(products ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rótulo de produto (texto livre)</Label>
                <Input
                  value={editor.product_name}
                  onChange={(e) => setEditor({ ...editor, product_name: e.target.value })}
                  placeholder="usado quando ainda não há produto formal no catálogo"
                />
              </div>
              <div>
                <Label className="text-xs">Célula do Workflow 7×3</Label>
                <Select
                  value={editor.workflow_stage_target}
                  onValueChange={(v) => setEditor({ ...editor, workflow_stage_target: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar célula..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {editor.workflow_stage_target !== NONE &&
                      !WORKFLOW_7X3_CELLS.some((c) => c.value === editor.workflow_stage_target) && (
                        <SelectItem value={editor.workflow_stage_target}>
                          (atual) {editor.workflow_stage_target}
                        </SelectItem>
                      )}
                    {WORKFLOW_7X3_CELLS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Pode gerar negócio comercial</p>
                  <p className="text-xs text-muted-foreground">Habilita criação de Deal no PipeRun</p>
                </div>
                <Switch
                  checked={editor.commercial_eligible}
                  onCheckedChange={(v) => setEditor({ ...editor, commercial_eligible: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Ativo</p>
                  <p className="text-xs text-muted-foreground">Mapeamento em uso na ingestão</p>
                </div>
                <Switch
                  checked={editor.active}
                  onCheckedChange={(v) => setEditor({ ...editor, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canWrite || save.isPending}>
              {save.isPending ? "Gravando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
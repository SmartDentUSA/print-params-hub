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
  useUnmappedMetaForms,
  useCatalogProductOptions,
  useSaveMetaFormMapping,
  useIsAdminUser,
  type MetaFormMapping,
} from "@/hooks/useMetaFormMappings";
import { WORKFLOW_7X3_CELLS, workflowCellLabel } from "@/lib/workflowCells";

const NONE = "__none__";

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

function emptyEditor(form_id = "", form_name = ""): EditorState {
  return {
    form_id,
    form_name_meta: form_name,
    origin_system_b: form_name,
    product_catalog_id: NONE,
    product_name: "",
    workflow_stage_target: NONE,
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
  const { data: unmapped, isLoading: loadingUnmapped, refetch: refetchUnmapped } = useUnmappedMetaForms();
  const { data: products } = useCatalogProductOptions();
  const { data: isAdmin } = useIsAdminUser();
  const save = useSaveMetaFormMapping();

  const [search, setSearch] = useState("");
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
      refetchUnmapped();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gravar");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Formulários Meta</CardTitle>
            <CardDescription>
              Fonte única de verdade do mapeamento formulário → produto → célula do Workflow 7×3.
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
            <Button variant="outline" size="icon" onClick={() => { refetchMappings(); refetchUnmapped(); }}>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Origens não associadas
            {unmapped && unmapped.length > 0 && <Badge variant="destructive">{unmapped.length}</Badge>}
          </CardTitle>
          <CardDescription>
            Formulários que já aparecem em leads reais mas ainda não têm linha em meta_form_mappings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUnmapped ? (
            <Skeleton className="h-20 w-full" />
          ) : !unmapped || unmapped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma origem pendente — todos os formulários com leads estão mapeados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formulário</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Último lead</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmapped.map((u) => (
                  <TableRow key={u.form_id}>
                    <TableCell>
                      <div className="font-medium">{u.form_name || "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.form_id}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{u.leads_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(u.last_lead_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canWrite}
                        onClick={() => setEditor(emptyEditor(u.form_id, u.form_name ?? ""))}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Criar mapeamento
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
                  <Label className="text-xs">Form ID (Meta)</Label>
                  <Input
                    value={editor.form_id}
                    onChange={(e) => setEditor({ ...editor, form_id: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Nome do formulário na Meta</Label>
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
import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  useFieldOptions, useFieldValues, useMergeFieldValues, suggestCanonical,
} from "@/hooks/reactivation/useFieldNormalizer";

type FieldGroup = { label: string; fields: Array<{ key: string; label: string }> };

const FIELD_GROUPS: FieldGroup[] = [
  { label: "Identidade & CRM", fields: [
    { key: "area_atuacao", label: "Área de atuação" },
    { key: "especialidade", label: "Especialidade" },
    { key: "produto_interesse", label: "Produto de interesse" },
    { key: "produto_interesse_auto", label: "Produto (auto)" },
    { key: "temperatura", label: "Temperatura" },
    { key: "funil_crm", label: "Funil CRM" },
    { key: "etapa_crm", label: "Etapa CRM" },
    { key: "status_piperun", label: "Status PipeRun" },
    { key: "real_status", label: "Status real" },
    { key: "proprietario_lead_crm", label: "Proprietário" },
    { key: "tipo_local", label: "Tipo de local" },
    { key: "uf", label: "UF" },
  ]},
  { label: "Origem & Aquisição", fields: [
    { key: "origem_primeiro_contato", label: "Origem (primeiro contato)" },
    { key: "form_name", label: "Formulário" },
    { key: "utm_campaign", label: "UTM Campaign" },
    { key: "sdr_completo", label: "SDR completo" },
    { key: "prazo_compra", label: "Prazo de compra" },
    { key: "cidade", label: "Cidade" },
  ]},
  { label: "Workflow Digital — Equipamentos", fields: [
    { key: "tem_scanner", label: "Tem scanner" },
    { key: "equip_scanner", label: "Scanner (modelo)" },
    { key: "scanner_modelo", label: "Scanner de bancada" },
    { key: "marca_scanner", label: "Marca do scanner" },
    { key: "tem_impressora", label: "Tem impressora" },
    { key: "impressora_modelo", label: "Impressora (marca)" },
    { key: "marca_impressora", label: "Marca da impressora" },
    { key: "tem_cad", label: "Tem CAD" },
    { key: "sdr_software_cad_interesse", label: "Software CAD" },
    { key: "tem_fresadora", label: "Tem fresadora" },
    { key: "imprime_modelos", label: "Imprime modelos" },
    { key: "imprime_placas", label: "Imprime placas" },
    { key: "imprime_guias", label: "Imprime guias" },
    { key: "imprime_resinas_ld", label: "Imprime resinas LD" },
  ]},
];

const NULL_SENTINEL = "__NULL__";

export function FieldNormalizer() {
  const [field, setField] = useState<string | null>("area_atuacao");
  const [mappings, setMappings] = useState<Record<string, string>>({}); // from -> to (NULL_SENTINEL = clear)
  const [confirmOpen, setConfirmOpen] = useState(false);

  const opts = useFieldOptions(field);
  const vals = useFieldValues(field);
  const merge = useMergeFieldValues();

  const canonicalSet = useMemo(
    () => new Set((opts.data?.options ?? []).map((o) => o)),
    [opts.data],
  );

  const rows = useMemo(() => vals.data?.values ?? [], [vals.data]);

  const pendingList = useMemo(() => {
    return Object.entries(mappings)
      .filter(([from, to]) => !!to && from !== to)
      .map(([from, to]) => ({ from, to: to === NULL_SENTINEL ? null : to }));
  }, [mappings]);

  const changeField = (v: string) => {
    setField(v);
    setMappings({});
  };

  const autoSuggest = () => {
    if (!opts.data || opts.data.no_auto_suggest) return;
    const next: Record<string, string> = { ...mappings };
    let count = 0;
    for (const r of rows) {
      if (!r.value) continue;
      if (canonicalSet.has(r.value)) continue;
      if (next[r.value]) continue;
      const s = suggestCanonical(r.value, opts.data.options, field ?? undefined);
      if (s) { next[r.value] = s; count++; }
    }
    setMappings(next);
    toast({
      title: `${count} sugestão(ões) aplicadas`,
      description: count === 0 ? "Nenhum valor sem canônico foi reconhecido automaticamente." : "Revise antes de atualizar a base.",
    });
  };

  const applyMerge = async () => {
    if (!field || pendingList.length === 0) return;
    try {
      const res = await merge.mutateAsync({ field, mappings: pendingList });
      toast({
        title: `Base atualizada — ${res.total_updated} linha(s) reescritas`,
        description: `${pendingList.length} mesclagem(ns) aplicadas em ${field}.`,
      });
      setMappings({});
      setConfirmOpen(false);
      // Force immediate refetch so merged values disappear from the table.
      await Promise.all([vals.refetch(), opts.refetch()]);
    } catch (e: any) {
      toast({ title: "Falha ao atualizar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campo a normalizar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={field ?? undefined} onValueChange={changeField}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Escolha um campo…" /></SelectTrigger>
            <SelectContent>
              {FIELD_GROUPS.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label} <span className="text-muted-foreground">· {f.key}</span></SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {opts.data && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">canônico: {opts.data.source}</Badge>
              <span>{opts.data.options.length} opção(ões) oficiais</span>
              {opts.data.no_auto_suggest && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">merge manual (sem sugestão automática)</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Valores atuais na base</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Somente leads canônicos (merged_into IS NULL). Escolha um canônico oficial e marque para mesclar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!opts.data || opts.data.no_auto_suggest || opts.isLoading} onClick={autoSuggest}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Sugerir automaticamente
            </Button>
            <Button size="sm" disabled={pendingList.length === 0 || merge.isPending} onClick={() => setConfirmOpen(true)}>
              {merge.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
              Atualizar base ({pendingList.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vals.isLoading || opts.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando valores…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Sem valores para este campo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Valor atual</TableHead>
                  <TableHead className="w-24 text-right">Ocorrências</TableHead>
                  <TableHead className="w-[320px]">Canônico do sistema</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const key = r.value ?? "";
                  const isCanonical = r.value !== null && canonicalSet.has(r.value);
                  const mapped = mappings[key];
                  const checked = !!mapped;
                  return (
                    <TableRow key={key || "__blank__"}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={isCanonical || !r.value}
                          onCheckedChange={(c) => {
                            setMappings((prev) => {
                              const next = { ...prev };
                              if (!c) delete next[key];
                              else if (!next[key]) next[key] = ""; // force user to pick
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.value === null ? <span className="italic text-muted-foreground">(vazio)</span> : r.value}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.count.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {isCanonical ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300">já canônico</Badge>
                        ) : !r.value ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={mapped || undefined}
                            onValueChange={(v) => setMappings((prev) => ({ ...prev, [key]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o canônico…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NULL_SENTINEL}>— limpar (deixar vazio)</SelectItem>
                              {(opts.data?.options ?? []).map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {mapped && !isCanonical && (
                          <Badge>{mapped === NULL_SENTINEL ? "→ limpar" : "→ mesclar"}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Vou reescrever {pendingList.length} valor(es) diferente(s) na coluna <code>{field}</code> de <code>lia_attendances</code> (apenas leads canônicos).
              Essa ação é irreversível — os valores originais serão substituídos pelo canônico escolhido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-auto text-xs font-mono border rounded p-2 bg-muted/40">
            {pendingList.map((m) => (
              <div key={m.from}>{m.from} → {m.to ?? "(vazio)"}</div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merge.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={merge.isPending} onClick={(e) => { e.preventDefault(); applyMerge(); }}>
              {merge.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Confirmar e atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
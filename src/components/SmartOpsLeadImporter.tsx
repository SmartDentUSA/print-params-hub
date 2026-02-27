import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PARSER_MAP, PARSER_OPTIONS } from "@/utils/leadParsers";
import * as XLSX from "xlsx";

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; email: string; error: string }[];
}

const BATCH_SIZE = 500;

export function SmartOpsLeadImporter({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [parserType, setParserType] = useState<string>("");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [allParsed, setAllParsed] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ batch: 0, total: 0, inserted: 0, updated: 0, skipped: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [allErrors, setAllErrors] = useState<{ row: number; email: string; error: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setAllParsed([]);
    setResult(null);
    setAllErrors([]);
    setProgress({ batch: 0, total: 0, inserted: 0, updated: 0, skipped: 0 });
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !parserType) return;

    const parser = PARSER_MAP[parserType];
    if (!parser) { toast.error("Parser não encontrado"); return; }

    try {
      const buffer = await file.arrayBuffer();
      let rows: Record<string, unknown>[];

      if (file.name.endsWith(".csv")) {
        const text = new TextDecoder("utf-8").decode(buffer);
        const wb = XLSX.read(text, { type: "string", raw: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      } else {
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      }

      const parsed = parser(rows);
      setAllParsed(parsed);
      setPreview(parsed.slice(0, 5));
      toast.success(`${parsed.length} leads parseados de ${rows.length} linhas`);
    } catch (err) {
      toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async () => {
    if (allParsed.length === 0) return;
    setImporting(true);
    setResult(null);
    setAllErrors([]);

    const option = PARSER_OPTIONS.find((o) => o.key === parserType);
    const override = option?.override ?? false;
    const totalBatches = Math.ceil(allParsed.length / BATCH_SIZE);
    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;
    const accErrors: { row: number; email: string; error: string }[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = allParsed.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      setProgress({ batch: i + 1, total: totalBatches, inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped });

      try {
        const { data, error } = await supabase.functions.invoke("import-leads-csv", {
          body: { type: parserType, leads: batch, override },
        });

        if (error) throw error;
        totalInserted += data.inserted || 0;
        totalUpdated += data.updated || 0;
        totalSkipped += data.skipped || 0;
        if (data.errors?.length) {
          accErrors.push(...data.errors.map((e: { row: number; email: string; error: string }) => ({
            ...e,
            row: e.row + i * BATCH_SIZE,
          })));
        }
      } catch (err) {
        accErrors.push({ row: i * BATCH_SIZE, email: "", error: `Batch ${i + 1} falhou: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    const finalResult: ImportResult = {
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: accErrors,
    };
    setResult(finalResult);
    setAllErrors(accErrors);
    setImporting(false);
    toast.success(`Importação concluída: ${totalInserted} inseridos, ${totalUpdated} atualizados`);
    onComplete?.();
  };

  const downloadErrorCSV = () => {
    if (allErrors.length === 0) return;
    const csv = ["linha,email,erro", ...allErrors.map((e) => `${e.row},"${e.email}","${e.error}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_import_${parserType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewCols = preview && preview.length > 0
    ? ["nome", "email", "telefone_raw", "produto_interesse", "lead_status", "source"].filter((c) => preview.some((r) => r[c] !== null && r[c] !== undefined))
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-1" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Leads (CSV/XLSX)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select parser */}
          <div className="space-y-2">
            <label className="text-sm font-medium">1. Selecione o tipo de fonte</label>
            <Select value={parserType} onValueChange={(v) => { setParserType(v); reset(); }}>
              <SelectTrigger><SelectValue placeholder="Escolha a fonte..." /></SelectTrigger>
              <SelectContent>
                {PARSER_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label} {o.override && "⚡"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parserType && PARSER_OPTIONS.find((o) => o.key === parserType)?.override && (
              <p className="text-xs text-orange-600">⚡ Esta fonte sobrescreve campos existentes (ERP confirma venda)</p>
            )}
          </div>

          {/* Step 2: Upload file */}
          {parserType && (
            <div className="space-y-2">
              <label className="text-sm font-medium">2. Selecione o arquivo</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          )}

          {/* Step 3: Preview */}
          {preview && preview.length > 0 && (() => {
            const semNomeCount = allParsed.filter((r) => r.nome === "Sem Nome").length;
            const semNomePct = Math.round((semNomeCount / allParsed.length) * 100);
            const blocked = semNomePct > 50;
            return (
            <div className="space-y-2">
              <label className="text-sm font-medium">3. Preview (primeiras 5 linhas de {allParsed.length})</label>
              {semNomeCount >= 3 && (
                <Alert variant="destructive">
                  <ShieldAlert className="w-4 h-4" />
                  <AlertDescription>
                    <strong>{semNomeCount} leads ({semNomePct}%) sem nome detectados!</strong>
                    {" "}As colunas do arquivo provavelmente não batem com o parser selecionado.
                    {blocked ? " Importação bloqueada — tente o parser \"Auto-Detect\" ou verifique as colunas do CSV." : " Considere usar o parser \"Auto-Detect\"."}
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewCols.map((c) => <TableHead key={c} className="text-xs">{c}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {previewCols.map((c) => (
                          <TableCell key={c} className="text-xs max-w-[200px] truncate">
                            {row[c] !== null && row[c] !== undefined ? String(row[c]) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing || blocked}>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirmar e Enviar ({allParsed.length} leads)
                </Button>
                <Button variant="outline" onClick={reset}>Cancelar</Button>
              </div>
            </div>
          )}

            </div>
          );
          })()}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Batch {progress.batch}/{progress.total}</span>
                <span>{progress.inserted} ins. | {progress.updated} upd. | {progress.skipped} skip.</span>
              </div>
              <Progress value={progress.total > 0 ? (progress.batch / progress.total) * 100 : 0} />
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold">Importação concluída</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 rounded bg-green-50 text-center">
                  <div className="text-lg font-bold text-green-700">{result.inserted}</div>
                  <div className="text-xs text-green-600">Inseridos</div>
                </div>
                <div className="p-2 rounded bg-blue-50 text-center">
                  <div className="text-lg font-bold text-blue-700">{result.updated}</div>
                  <div className="text-xs text-blue-600">Atualizados</div>
                </div>
                <div className="p-2 rounded bg-muted text-center">
                  <div className="text-lg font-bold">{result.skipped}</div>
                  <div className="text-xs text-muted-foreground">Ignorados</div>
                </div>
              </div>
              {allErrors.length > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200">
                  <div className="flex items-center gap-1.5 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    {allErrors.length} erro(s) encontrado(s)
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadErrorCSV}>
                    <Download className="w-3 h-3 mr-1" /> CSV de Erros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

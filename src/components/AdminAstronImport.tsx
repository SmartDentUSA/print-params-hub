import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface AstronUser {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  genero: string;
  data_nascimento: string;
  data_cadastro: string;
  ultimo_login: string;
  percentual: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): AstronUser[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const users: AstronUser[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
    users.push({
      nome: row["Nome Completo"] || "",
      email: (row["Email"] || "").trim().toLowerCase(),
      cpf: row["CPF"] || "",
      telefone: row["Telefone"] || "",
      genero: row["Gênero"] || row["Genero"] || "",
      data_nascimento: row["Data de Nascimento"] || "",
      data_cadastro: row["Data de Cadastro"] || "",
      ultimo_login: row["Data de Último Login"] || row["Data de Ultimo Login"] || "",
      percentual: row["Percentual de Conclusão"] || row["Percentual de Conclusao"] || "0%",
    });
  }
  return users;
}

export default function AdminAstronImport() {
  const [status, setStatus] = useState<"idle" | "parsing" | "importing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [results, setResults] = useState<{ matched: number; updated: number; not_found: number; errors: string[] }>({ matched: 0, updated: 0, not_found: 0, errors: [] });
  const [csvSource, setCsvSource] = useState<"embedded" | "upload">("embedded");

  const processUsers = useCallback(async (users: AstronUser[]) => {
    setTotalUsers(users.length);
    setStatus("importing");

    const BATCH = 200;
    let totalMatched = 0, totalUpdated = 0, totalNotFound = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      try {
        const { data, error } = await supabase.functions.invoke("import-astron-csv", {
          body: { users: batch },
        });
        if (error) {
          allErrors.push(`Batch ${i}: ${error.message}`);
        } else if (data) {
          totalMatched += data.matched || 0;
          totalUpdated += data.updated || 0;
          totalNotFound += data.not_found || 0;
          if (data.errors?.length) allErrors.push(...data.errors);
        }
      } catch (e) {
        allErrors.push(`Batch ${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
      setProgress(Math.min(100, Math.round(((i + batch.length) / users.length) * 100)));
      setResults({ matched: totalMatched, updated: totalUpdated, not_found: totalNotFound, errors: allErrors });
    }

    setStatus("done");
    toast.success(`Import completo: ${totalUpdated} leads atualizados de ${users.length} usuários Astron`);
  }, []);

  const handleEmbeddedImport = useCallback(async () => {
    setStatus("parsing");
    try {
      const resp = await fetch("/astron-import-temp.csv");
      if (!resp.ok) throw new Error(`CSV fetch failed: ${resp.status}`);
      const text = await resp.text();
      // Check if we got HTML (SPA) instead of CSV
      if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
        throw new Error("Got HTML instead of CSV - use file upload instead");
      }
      const users = parseCSV(text);
      if (users.length === 0) throw new Error("No users parsed from CSV");
      await processUsers(users);
    } catch (e) {
      setStatus("error");
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)} - Use upload de arquivo`);
      setCsvSource("upload");
    }
  }, [processUsers]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    try {
      const text = await file.text();
      const users = parseCSV(text);
      if (users.length === 0) throw new Error("No users parsed from CSV");
      toast.info(`${users.length} usuários encontrados no CSV`);
      await processUsers(users);
    } catch (err) {
      setStatus("error");
      toast.error(`Erro ao processar CSV: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [processUsers]);

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🎓 Importar Usuários Astron Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Importa o CSV do Astron Members e atualiza todos os leads correspondentes com status, datas e percentual de conclusão.
            </p>
            {csvSource === "embedded" ? (
              <Button onClick={handleEmbeddedImport}>Importar CSV embutido (astron-import-temp.csv)</Button>
            ) : null}
            <div>
              <label className="block text-sm font-medium mb-1">Ou faça upload do CSV:</label>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm" />
            </div>
          </div>
        )}

        {(status === "parsing") && (
          <p className="text-sm text-muted-foreground">Parseando CSV...</p>
        )}

        {(status === "importing" || status === "done") && (
          <div className="space-y-3">
            <Progress value={progress} />
            <p className="text-sm">{progress}% — {results.updated} atualizados de {totalUsers} usuários</p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded">
                <div className="font-bold text-green-700 dark:text-green-300">{results.updated}</div>
                <div>Atualizados</div>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                <div className="font-bold text-blue-700 dark:text-blue-300">{results.matched}</div>
                <div>Matched</div>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded">
                <div className="font-bold text-orange-700 dark:text-orange-300">{results.not_found}</div>
                <div>Not Found</div>
              </div>
            </div>
            {results.errors.length > 0 && (
              <details className="text-xs text-red-500">
                <summary>{results.errors.length} errors</summary>
                <pre className="whitespace-pre-wrap mt-1">{results.errors.join("\n")}</pre>
              </details>
            )}
            {status === "done" && (
              <Button variant="outline" onClick={() => { setStatus("idle"); setProgress(0); setResults({ matched: 0, updated: 0, not_found: 0, errors: [] }); }}>
                Reiniciar
              </Button>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-red-500">Erro na importação. Tente upload manual:</p>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm" />
            <Button variant="outline" onClick={() => setStatus("idle")}>Reiniciar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

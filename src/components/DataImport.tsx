import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/contexts/DataContext";
import { useDataExportImport } from "@/hooks/useDataExportImport";
import { Badge } from "@/components/ui/badge";

interface ImportStats {
  inserted: number;
  updated: number;
  errors: string[];
  total: number;
}

export function DataImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const { toast } = useToast();
  const { refreshData } = useData();
  const { bulkUpsertParameterSets } = useDataExportImport();

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      rows.push(row);
    }

    return rows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setImportStats(null);

    try {
      console.log("Reading file:", file.name, "Size:", file.size, "bytes");
      const text = await file.text();
      
      // Parse CSV
      const parsedData = parseCSV(text);
      console.log("Parsed CSV rows:", parsedData.length);

      if (parsedData.length === 0) {
        throw new Error("Arquivo CSV vazio ou formato inválido");
      }

      // Transform to database format
      const transformedData = parsedData.map(row => ({
        id: row.id && row.id.trim() !== '' ? row.id : undefined,
        brand_slug: (row.brand || '').toLowerCase().replace(/\s+/g, '-'),
        model_slug: (row.model || '').toLowerCase().replace(/\s+/g, '-'),
        resin_name: row.resin || '',
        resin_manufacturer: row.resin_manufacturer || '',
        layer_height: row.layer_height || '0.05',
        cure_time: row.cure_time || '8',
        bottom_cure_time: row.bottom_cure_time || '',
        light_intensity: row.light_intensity || '100',
        bottom_layers: row.bottom_layers || '',
        lift_distance: row.lift_distance || '',
        lift_speed: row.lift_speed || '',
        retract_speed: row.retract_speed || '',
        anti_aliasing: row.anti_aliasing || 'true',
        xy_size_compensation: row.xy_size_compensation || '',
        wait_time_before_cure: row.wait_time_before_cure || '',
        wait_time_after_cure: row.wait_time_after_cure || '',
        wait_time_after_lift: row.wait_time_after_lift || '',
        xy_adjustment_x_pct: row.xy_adjustment_x_pct || '',
        xy_adjustment_y_pct: row.xy_adjustment_y_pct || '',
        notes: row.notes || '',
        active: row.active !== undefined ? row.active : 'true'
      }));

      // Execute bulk upsert
      const stats = await bulkUpsertParameterSets(transformedData);
      setImportStats(stats);

      if (stats.errors.length === 0) {
        toast({
          title: "Importação concluída!",
          description: `✅ ${stats.updated} atualizados, ${stats.inserted} novos inseridos`,
        });
      } else {
        toast({
          title: "Importação parcial",
          description: `${stats.updated} atualizados, ${stats.inserted} inseridos, ${stats.errors.length} erros`,
          variant: "destructive",
        });
      }

      // Refresh data after import
      setTimeout(() => {
        refreshData();
      }, 1500);

      // Reset file input
      if (event.target) {
        event.target.value = '';
      }

    } catch (error) {
      console.error("Erro ao importar dados:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Importar Dados CSV
        </CardTitle>
        <CardDescription>
          Carregue seus arquivos CSV processados da planilha Excel para atualizar os dados da aplicação.
          Formato esperado: brand, model, resin, variant_label, altura_da_camada_mm, tempo_cura_seg, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Arquivo CSV</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isLoading}
          />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            Processando importação...
          </div>
        )}

        {importStats && (
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="font-medium">Resultado da Importação</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
              <div>
                <div className="font-medium text-foreground">{importStats.total}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="font-medium text-success">{importStats.updated}</div>
                <div className="text-muted-foreground">Atualizados</div>
              </div>
              <div>
                <div className="font-medium text-primary">{importStats.inserted}</div>
                <div className="text-muted-foreground">Inseridos</div>
              </div>
              <div>
                <div className="font-medium text-destructive">{importStats.errors.length}</div>
                <div className="text-muted-foreground">Erros</div>
              </div>
            </div>
            
            {importStats.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="font-medium text-sm text-destructive">Erros encontrados:</div>
                <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                  {importStats.errors.slice(0, 10).map((error, i) => (
                    <div key={i}>• {error}</div>
                  ))}
                  {importStats.errors.length > 10 && (
                    <div>... e mais {importStats.errors.length - 10} erros</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-accent-foreground mb-2">Como usar:</div>
              <ul className="text-muted-foreground space-y-1 mb-3">
                <li>• Use os CSVs gerados pelo processamento da planilha Excel</li>
                <li>• Cada arquivo CSV deve conter as colunas padronizadas</li>
                <li>• Headers obrigatórios: brand, model, resin, variant_label</li>
                <li>• Valores numéricos serão validados automaticamente</li>
              </ul>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => window.open('/exemplo-importacao.csv', '_blank')}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Baixar Arquivo de Exemplo
              </Button>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
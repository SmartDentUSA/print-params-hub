import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadDataFromCSV, type RealParameterSet } from "@/data/realData";

interface DataImportProps {
  onDataLoaded?: (data: RealParameterSet[]) => void;
}

export function DataImport({ onDataLoaded }: DataImportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [importedData, setImportedData] = useState<RealParameterSet[]>([]);
  const { toast } = useToast();

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

    try {
      const text = await file.text();
      const data = await loadDataFromCSV(text);
      
      setImportedData(data);
      onDataLoaded?.(data);

      toast({
        title: "Dados importados com sucesso!",
        description: `${data.length} registros carregados de ${file.name}`,
      });
    } catch (error) {
      console.error("Erro ao importar dados:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível carregar o arquivo CSV.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDataStats = () => {
    if (importedData.length === 0) return null;

    const brands = new Set(importedData.map(item => item.brand));
    const models = new Set(importedData.map(item => `${item.brand}-${item.model}`));
    const resins = new Set(importedData.map(item => item.resin));

    return {
      total: importedData.length,
      brands: brands.size,
      models: models.size,
      resins: resins.size
    };
  };

  const stats = getDataStats();

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
            Processando arquivo...
          </div>
        )}

        {stats && (
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="font-medium">Dados Carregados</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-foreground">{stats.total}</div>
                <div className="text-muted-foreground">Registros</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{stats.brands}</div>
                <div className="text-muted-foreground">Marcas</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{stats.models}</div>
                <div className="text-muted-foreground">Modelos</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{stats.resins}</div>
                <div className="text-muted-foreground">Resinas</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-accent-foreground mb-1">Como usar:</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Use os CSVs gerados pelo processamento da planilha Excel</li>
                <li>• Cada arquivo CSV deve conter as colunas padronizadas</li>
                <li>• Você pode importar múltiplos arquivos (um por marca)</li>
                <li>• Os dados serão carregados dinamicamente na aplicação</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
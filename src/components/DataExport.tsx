import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all parameter sets with brand and model names
      const { data: parameterSets, error } = await supabase
        .from('parameter_sets')
        .select('*')
        .order('brand_slug, model_slug, resin_name');

      if (error) throw error;

      if (!parameterSets || parameterSets.length === 0) {
        toast({
          title: "Nenhum dado para exportar",
          description: "Não há parâmetros cadastrados no sistema.",
          variant: "destructive",
        });
        return;
      }

      // Fetch brands and models for display names
      const { data: brands } = await supabase.from('brands').select('slug, name');
      const { data: models } = await supabase.from('models').select('slug, name');

      const brandMap = new Map(brands?.map(b => [b.slug, b.name]) || []);
      const modelMap = new Map(models?.map(m => [m.slug, m.name]) || []);

      // CSV headers - complete with all fields
      const headers = [
        'id',
        'brand',
        'model',
        'resin',
        'resin_manufacturer',
        'variant_label',
        'layer_height',
        'cure_time',
        'bottom_cure_time',
        'light_intensity',
        'bottom_layers',
        'lift_distance',
        'lift_speed',
        'retract_speed',
        'anti_aliasing',
        'xy_size_compensation',
        'wait_time_before_cure',
        'wait_time_after_cure',
        'wait_time_after_lift',
        'xy_adjustment_x_pct',
        'xy_adjustment_y_pct',
        'notes',
        'active'
      ];

      // Convert data to CSV rows
      const rows = parameterSets.map(param => {
        const brand = brandMap.get(param.brand_slug) || param.brand_slug;
        const model = modelMap.get(param.model_slug) || param.model_slug;
        const variantLabel = `${param.layer_height}mm - ${param.cure_time}s`;

        return [
          param.id,
          brand,
          model,
          param.resin_name,
          param.resin_manufacturer,
          variantLabel,
          param.layer_height,
          param.cure_time,
          param.bottom_cure_time || '',
          param.light_intensity,
          param.bottom_layers || '',
          param.lift_distance || '',
          param.lift_speed || '',
          param.retract_speed || '',
          param.anti_aliasing !== null ? param.anti_aliasing : '',
          param.xy_size_compensation || '',
          param.wait_time_before_cure || '',
          param.wait_time_after_cure || '',
          param.wait_time_after_lift || '',
          param.xy_adjustment_x_pct || '',
          param.xy_adjustment_y_pct || '',
          param.notes || '',
          param.active
        ].map(value => {
          // Escape values that contain commas or quotes
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',');
      });

      // Create CSV content
      const csvContent = [headers.join(','), ...rows].join('\n');

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `parametros-export-${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportação concluída!",
        description: `${parameterSets.length} registros exportados com sucesso.`,
      });

    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="w-5 h-5" />
          Exportar Dados
        </CardTitle>
        <CardDescription>
          Baixe todos os parâmetros do sistema em formato CSV para edição em massa.
          O arquivo incluirá o ID de cada registro para permitir atualizações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm space-y-2">
            <div className="font-medium text-foreground">Como usar a exportação:</div>
            <ul className="text-muted-foreground space-y-1">
              <li>• Todos os registros (ativos e inativos) serão exportados</li>
              <li>• O campo 'id' permite atualizar registros existentes</li>
              <li>• Edite o CSV no Excel ou LibreOffice</li>
              <li>• Use 'active' = true/false para ativar/desativar registros</li>
              <li>• Reimporte o CSV editado para sobrescrever os dados</li>
            </ul>
          </div>
        </div>

        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Exportar Todos os Dados
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

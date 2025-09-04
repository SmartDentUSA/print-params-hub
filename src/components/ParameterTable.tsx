import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface ParameterSet {
  id: string;
  label: string;
  layer_height: number;
  cure_time: number;
  bottom_cure_time?: number;
  bottom_layers?: number;
  light_intensity: number;
  xy_adjustment_x_pct?: number;
  xy_adjustment_y_pct?: number;
  wait_time_before_cure?: number;
  wait_time_after_cure?: number;
  wait_time_after_lift?: number;
  notes?: string;
}

interface ParameterTableProps {
  parameterSet: ParameterSet;
}

export function ParameterTable({ parameterSet }: ParameterTableProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const formatValue = (value: number | undefined | null, type?: string): string => {
    if (value === 0 || value === null || value === undefined) {
      return "-";
    }
    
    // Apply specific formatting based on parameter type
    switch (type) {
      case 'time':
        return value.toFixed(2); // Cure times with 2 decimal places
      case 'height':
        return value.toFixed(3); // Layer height with 3 decimal places  
      case 'percentage':
        return value.toFixed(1); // Percentages with 1 decimal place
      case 'integer':
        return Math.round(value).toString(); // Whole numbers
      default:
        return value.toFixed(2); // Default 2 decimal places
    }
  };

  const normalLayersParams = [
    { label: `${t('parameters.layer_height')} (mm)`, value: parameterSet.layer_height, type: 'height' },
    { label: `${t('parameters.cure_time')} (seg)`, value: parameterSet.cure_time, type: 'time' },
    { label: `${t('parameters.wait_before_cure')} (s)`, value: parameterSet.wait_time_before_cure, type: 'time' },
    { label: `${t('parameters.wait_after_cure')} (s)`, value: parameterSet.wait_time_after_cure, type: 'time' },
    { label: `${t('parameters.light_intensity')} (%)`, value: parameterSet.light_intensity, type: 'percentage' },
    { label: `${t('parameters.x_adjustment')} (%)`, value: parameterSet.xy_adjustment_x_pct, type: 'percentage' },
    { label: `${t('parameters.y_adjustment')} (%)`, value: parameterSet.xy_adjustment_y_pct, type: 'percentage' },
  ];

  const bottomLayersParams = [
    { label: `${t('parameters.adhesion_time')} (seg)`, value: parameterSet.bottom_cure_time, type: 'time' },
    { label: t('parameters.transition_layers'), value: parameterSet.bottom_layers, type: 'integer' },
    { label: `${t('parameters.wait_before_cure_base')} (s)`, value: parameterSet.wait_time_before_cure, type: 'time' },
    { label: `${t('parameters.wait_after_cure_base')} (s)`, value: parameterSet.wait_time_after_cure, type: 'time' },
    { label: `${t('parameters.wait_after_lift')} (s)`, value: parameterSet.wait_time_after_lift, type: 'time' },
  ];

  const handleCopy = async () => {
    const allParams = [
      `${t('parameters.normal_layers')}:`,
      ...normalLayersParams.map(param => `${param.label}: ${formatValue(param.value, param.type)}`),
      '',
      `${t('parameters.bottom_layers')}:`,
      ...bottomLayersParams.map(param => `${param.label}: ${formatValue(param.value, param.type)}`)
    ];
    const textToCopy = allParams.join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast({
        title: "Parâmetros copiados!",
        description: "Os parâmetros foram copiados para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar os parâmetros.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = () => {
    const csvContent = [
      "Especificação,Valor",
      `"${t('parameters.normal_layers')}","`,
      ...normalLayersParams.map(param => `"${param.label}","${formatValue(param.value, param.type)}"`),
      `"${t('parameters.bottom_layers')}","`,
      ...bottomLayersParams.map(param => `"${param.label}","${formatValue(param.value, param.type)}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parametros-${parameterSet.label.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download iniciado",
      description: "O arquivo CSV está sendo baixado.",
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Parâmetros - ${parameterSet.label}`,
          text: [
            `${t('parameters.normal_layers')}:`,
            ...normalLayersParams.map(param => `${param.label}: ${formatValue(param.value, param.type)}`),
            '',
            `${t('parameters.bottom_layers')}:`,
            ...bottomLayersParams.map(param => `${param.label}: ${formatValue(param.value, param.type)}`)
          ].join('\n'),
        });
      } catch (err) {
        // Fallback to copy URL
        handleCopy();
      }
    } else {
      // Fallback to copy URL
      handleCopy();
    }
  };

  return (
    <div className="bg-gradient-card rounded-xl border border-border shadow-soft overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Camadas Normais */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">{t('parameters.normal_layers')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Especificação</th>
                  <th className="text-left py-2 font-medium text-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {normalLayersParams.map((param, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground font-medium">
                      {param.label}
                    </td>
                    <td className="py-3 font-mono text-foreground">
                      {formatValue(param.value, param.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Camadas Inferiores */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">{t('parameters.bottom_layers')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">Especificação</th>
                  <th className="text-left py-2 font-medium text-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {bottomLayersParams.map((param, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground font-medium">
                      {param.label}
                    </td>
                    <td className="py-3 font-mono text-foreground">
                      {formatValue(param.value, param.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {parameterSet.notes && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Observações:</strong> {parameterSet.notes}
            </p>
          </div>
        )}
      </div>

      <div className="bg-secondary/50 px-6 py-4 border-t border-border">
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleCopy} 
            size="sm" 
            variant="default"
            className="flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button 
            onClick={handleShare} 
            size="sm" 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Share className="w-4 h-4" />
            Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface ParameterSet {
  id: string;
  label: string;
  altura_da_camada_mm: number;
  tempo_cura_seg: number;
  tempo_adesao_seg: number;
  camadas_transicao: number;
  intensidade_luz_pct: number;
  ajuste_x_pct: number;
  ajuste_y_pct: number;
  wait_time_before_cure?: number;
  wait_time_after_cure?: number;
  bottom_cure_time?: number;
  notes?: string;
}

interface ParameterTableProps {
  parameterSet: ParameterSet;
}

export function ParameterTable({ parameterSet }: ParameterTableProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const normalLayersParams = [
    { label: `${t('parameters.layer_height')} (mm)`, value: parameterSet.altura_da_camada_mm },
    { label: `${t('parameters.cure_time')} (seg)`, value: parameterSet.tempo_cura_seg },
    { label: `${t('parameters.wait_before_cure')} (s)`, value: parameterSet.wait_time_before_cure || 0 },
    { label: `${t('parameters.wait_after_cure')} (s)`, value: parameterSet.wait_time_after_cure || 0 },
    { label: `${t('parameters.light_intensity')} (%)`, value: parameterSet.intensidade_luz_pct },
    { label: `${t('parameters.x_adjustment')} (%)`, value: parameterSet.ajuste_x_pct },
    { label: `${t('parameters.y_adjustment')} (%)`, value: parameterSet.ajuste_y_pct },
  ];

  const bottomLayersParams = [
    { label: `${t('parameters.adhesion_time')} (seg)`, value: parameterSet.tempo_adesao_seg },
    { label: `${t('parameters.bottom_cure_time')} (seg)`, value: parameterSet.bottom_cure_time || parameterSet.tempo_adesao_seg },
    { label: t('parameters.transition_layers'), value: parameterSet.camadas_transicao },
    { label: `${t('parameters.wait_before_cure')} (s)`, value: parameterSet.wait_time_before_cure || 0 },
    { label: `${t('parameters.wait_after_cure')} (s)`, value: parameterSet.wait_time_after_cure || 0 },
  ];

  const handleCopy = async () => {
    const allParams = [
      `${t('parameters.normal_layers')}:`,
      ...normalLayersParams.map(param => `${param.label}: ${param.value}`),
      '',
      `${t('parameters.bottom_layers')}:`,
      ...bottomLayersParams.map(param => `${param.label}: ${param.value}`)
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
      ...normalLayersParams.map(param => `"${param.label}","${param.value}"`),
      `"${t('parameters.bottom_layers')}","`,
      ...bottomLayersParams.map(param => `"${param.label}","${param.value}"`)
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
            ...normalLayersParams.map(param => `${param.label}: ${param.value}`),
            '',
            `${t('parameters.bottom_layers')}:`,
            ...bottomLayersParams.map(param => `${param.label}: ${param.value}`)
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
                      {param.value}
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
                      {param.value}
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
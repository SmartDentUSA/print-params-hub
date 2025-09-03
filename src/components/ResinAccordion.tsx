import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ParameterTable } from "./ParameterTable";

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
  notes?: string;
}

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  parameterSets: ParameterSet[];
}

interface ResinAccordionProps {
  resins: Resin[];
}

export function ResinAccordion({ resins }: ResinAccordionProps) {
  // Filter out parameter sets with 0 cure time
  const filteredResins = resins.map(resin => ({
    ...resin,
    parameterSets: resin.parameterSets.filter(paramSet => paramSet.tempo_cura_seg > 0)
  })).filter(resin => resin.parameterSets.length > 0);

  if (filteredResins.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhuma resina disponível para este modelo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredResins.map((resin) => (
        <div key={resin.id} className="bg-gradient-card rounded-xl border border-border shadow-medium">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={resin.id} className="border-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-left">{resin.name}</h3>
                      <p className="text-sm text-muted-foreground text-left">
                        {resin.manufacturer}
                        {resin.color && ` • ${resin.color}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {resin.parameterSets.length} variação{resin.parameterSets.length !== 1 ? 'ões' : ''}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {resin.parameterSets.map((paramSet) => (
                    <Accordion key={paramSet.id} type="single" collapsible>
                      <AccordionItem value={paramSet.id} className="border border-border rounded-lg">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-left">{paramSet.label}</span>
                            <Badge variant="outline" className="ml-2">
                              {paramSet.altura_da_camada_mm}mm
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <ParameterTable parameterSet={paramSet} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}
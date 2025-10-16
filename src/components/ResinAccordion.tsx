import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { ParameterTable } from "./ParameterTable";

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

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  image_url?: string;
  description?: string;
  price?: number;
  parameterSets: ParameterSet[];
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
}

interface ResinAccordionProps {
  resins: Resin[];
}

export function ResinAccordion({ resins }: ResinAccordionProps) {
  // Filter out parameter sets with invalid data (but allow cure_time = 0 for special cases)
  const filteredResins = resins.map(resin => ({
    ...resin,
    parameterSets: resin.parameterSets.filter(paramSet => 
      paramSet.cure_time >= 0 && // Allow cure_time = 0
      paramSet.layer_height > 0 // Ensure valid layer height
    )
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
                    {resin.image_url && (
                      <img 
                        src={resin.image_url} 
                        alt={`${resin.name} ${resin.color || ''} ${resin.manufacturer} - Resina para impressão 3D`}
                        title={`${resin.name} ${resin.manufacturer}`}
                        loading="lazy"
                        className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-left">{resin.name}</h3>
                      <p className="text-sm text-muted-foreground text-left">
                        {resin.manufacturer}
                        {resin.color && ` • ${resin.color}`}
                      </p>

                      {/* Descrição (máximo 3 linhas) */}
                      {resin.description && (
                        <p className="text-xs text-muted-foreground text-left mt-2 line-clamp-3">
                          {resin.description}
                        </p>
                      )}

                      {/* Preço formatado */}
                      {resin.price && resin.price > 0 && (
                        <p className="text-sm font-semibold text-green-600 mt-2">
                          R$ {resin.price.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {resin.cta_1_label && resin.cta_1_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_1_url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={resin.cta_1_description || resin.cta_1_label}
                        title={resin.cta_1_description || resin.cta_1_label}
                        data-seo-description={resin.cta_1_description}
                      >
                        {resin.cta_1_label}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                    {resin.cta_2_label && resin.cta_2_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_2_url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={resin.cta_2_description || resin.cta_2_label}
                        title={resin.cta_2_description || resin.cta_2_label}
                        data-seo-description={resin.cta_2_description}
                      >
                        {resin.cta_2_label}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                    {resin.cta_3_label && resin.cta_3_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_3_url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={resin.cta_3_description || resin.cta_3_label}
                        title={resin.cta_3_description || resin.cta_3_label}
                        data-seo-description={resin.cta_3_description}
                      >
                        {resin.cta_3_label}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                    
                    <Badge variant="secondary" className="ml-2">
                      {resin.parameterSets.length} variação{resin.parameterSets.length !== 1 ? 'ões' : ''}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              {/* SEO Hidden Content for Crawlers */}
              {(resin.cta_1_description || resin.cta_2_description || resin.cta_3_description) && (
                <div className="sr-only px-6">
                  {resin.cta_1_description && <p>{resin.cta_1_description}</p>}
                  {resin.cta_2_description && <p>{resin.cta_2_description}</p>}
                  {resin.cta_3_description && <p>{resin.cta_3_description}</p>}
                </div>
              )}
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {resin.parameterSets.map((paramSet) => (
                    <Accordion key={paramSet.id} type="single" collapsible>
                      <AccordionItem value={paramSet.id} className="border border-border rounded-lg">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-left">{paramSet.label}</span>
                            <Badge variant="outline" className="ml-2">
                              {paramSet.layer_height}mm
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
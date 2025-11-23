import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { ParameterTable } from "./ParameterTable";
import { cn } from "@/lib/utils";

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
  documents?: any[]; // Adicionar documentos
  cta_1_label?: string;
  cta_1_url?: string;
  cta_1_description?: string;
  cta_2_label?: string;
  cta_2_url?: string;
  cta_2_description?: string;
  cta_3_label?: string;
  cta_3_url?: string;
  cta_3_description?: string;
  cta_1_enabled?: boolean;
  cta_4_label?: string;
  cta_4_url?: string;
  cta_4_description?: string;
  processing_instructions?: string | null;
}

interface ResinAccordionProps {
  resins: Resin[];
  preSelectedResins?: string[];
}

export function ResinAccordion({ resins, preSelectedResins = [] }: ResinAccordionProps) {
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
        <div 
          key={resin.id} 
          className={cn(
            "bg-gradient-card rounded-xl border border-border shadow-medium",
            preSelectedResins.includes(resin.id) && "ring-2 ring-primary shadow-lg"
          )}
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={resin.id} className="border-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between w-full gap-4">
                  {/* Seção Imagem + Texto */}
                  <div className="flex items-start gap-3 flex-1 min-w-0 order-1 md:order-none">
                    {resin.image_url && (
                      <img 
                        src={resin.image_url} 
                        alt={`${resin.name} ${resin.color || ''} ${resin.manufacturer} - Resina para impressão 3D`}
                        title={`${resin.name} ${resin.manufacturer}`}
                        width="64"
                        height="64"
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm flex-shrink-0"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {/* Nome */}
                      <h3 className="font-semibold text-left">{resin.name}</h3>
                      
                      {/* Fabricante + Cor */}
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

                  {/* Botões CTA - Abaixo da imagem no mobile */}
                  <div className="order-2 w-full grid grid-cols-4 gap-1 mt-2 md:order-none md:flex md:gap-2 md:w-auto md:mt-0">
                    {resin.cta_1_enabled !== false && resin.cta_1_label && resin.cta_1_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full md:w-auto text-xs md:text-sm px-2 md:px-4 truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_1_url, '_blank', 'noopener,noreferrer');
                          
                          if (typeof (window as any).gtag === 'function') {
                            (window as any).gtag('event', 'cta_click', {
                              event_category: 'cta',
                              event_label: resin.cta_1_label,
                              resin_name: resin.name,
                              cta_position: 1
                            });
                          }
                        }}
                        aria-label={resin.cta_1_description || resin.cta_1_label}
                        title={resin.cta_1_description || resin.cta_1_label}
                        data-seo-description={resin.cta_1_description}
                      >
                        {resin.cta_1_label}
                      </Button>
                    )}
                    {resin.cta_2_label && resin.cta_2_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full md:w-auto text-xs md:text-sm px-2 md:px-4 truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_2_url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={resin.cta_2_description || resin.cta_2_label}
                        title={resin.cta_2_description || resin.cta_2_label}
                        data-seo-description={resin.cta_2_description}
                      >
                        {resin.cta_2_label}
                      </Button>
                    )}
                    {resin.cta_3_label && resin.cta_3_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full md:w-auto text-xs md:text-sm px-2 md:px-4 truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_3_url, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label={resin.cta_3_description || resin.cta_3_label}
                        title={resin.cta_3_description || resin.cta_3_label}
                        data-seo-description={resin.cta_3_description}
                      >
                        {resin.cta_3_label}
                      </Button>
                    )}
                    {resin.cta_4_label && resin.cta_4_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full md:w-auto text-xs md:text-sm px-2 md:px-4 truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(resin.cta_4_url, '_blank', 'noopener,noreferrer');
                          
                          if (typeof (window as any).gtag === 'function') {
                            (window as any).gtag('event', 'cta_click', {
                              event_category: 'cta',
                              event_label: resin.cta_4_label,
                              resin_name: resin.name,
                              cta_position: 4
                            });
                          }
                        }}
                        aria-label={resin.cta_4_description || resin.cta_4_label}
                        title={resin.cta_4_description || resin.cta_4_label}
                        data-seo-description={resin.cta_4_description}
                      >
                        {resin.cta_4_label}
                      </Button>
                    )}
                  </div>
                  
                  {/* Badge Isolado à Direita */}
                  <Badge 
                    variant="secondary" 
                    className="order-3 md:order-none self-start md:self-center flex-shrink-0"
                  >
                    {resin.parameterSets.length} variação{resin.parameterSets.length !== 1 ? 'ões' : ''}
                  </Badge>
                </div>
              </AccordionTrigger>
              {/* SEO Hidden Content for Crawlers */}
              {(resin.cta_1_description || resin.cta_2_description || resin.cta_3_description || resin.cta_4_description) && (
                <div className="sr-only px-6">
                  {resin.cta_1_description && <p>{resin.cta_1_description}</p>}
                  {resin.cta_2_description && <p>{resin.cta_2_description}</p>}
                  {resin.cta_3_description && <p>{resin.cta_3_description}</p>}
                  {resin.cta_4_description && <p>{resin.cta_4_description}</p>}
                </div>
              )}
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {/* NOVA SEÇÃO: Documentos Técnicos */}
                  {resin.documents && resin.documents.length > 0 && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Documentos Técnicos
                      </h4>
                      <div className="space-y-2">
                        {resin.documents.map((doc: any) => (
                          <a
                            key={doc.id}
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-card rounded border hover:border-primary transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-primary" />
                              <div>
                                <p className="text-sm font-medium group-hover:text-primary">
                                  {doc.document_name}
                                </p>
                                {doc.document_description && (
                                  <p className="text-xs text-muted-foreground">
                                    {doc.document_description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                          <ParameterTable 
                            parameterSet={paramSet} 
                            processingInstructions={resin.processing_instructions}
                          />
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
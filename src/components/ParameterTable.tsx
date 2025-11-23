import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share, Check, Info, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  processingInstructions?: string | null;
}

interface MarkdownElement {
  type: 'section' | 'subsection' | 'note' | 'bullet' | 'subbullet';
  content: string;
  level?: number; // 0 = principal, 1 = indentado, 2+ = sub-indentado
}

interface ParsedInstructions {
  pre: MarkdownElement[];
  post: MarkdownElement[];
}

export function ParameterTable({ parameterSet, processingInstructions }: ParameterTableProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { products } = useCatalogProducts();

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

  const parseMarkdownInstructions = (instructions: string | null | undefined): ParsedInstructions => {
    if (!instructions) return { pre: [], post: [] };
    
    const lines = instructions.split('\n');
    const pre: MarkdownElement[] = [];
    const post: MarkdownElement[] = [];
    let currentSection: 'pre' | 'post' | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Ignorar linhas vazias
      if (!trimmed) continue;
      
      // ## Detectar seção principal
      if (trimmed.startsWith('## ')) {
        const sectionTitle = trimmed.replace(/^##\s*/, '');
        
        // Determinar seção (PRÉ ou PÓS)
        if (sectionTitle.match(/^PRÉ[-\s]?PROCESSAMENTO/i)) {
          currentSection = 'pre';
          pre.push({ type: 'section', content: sectionTitle });
        } else if (sectionTitle.match(/^PÓS[-\s]?PROCESSAMENTO/i)) {
          currentSection = 'post';
          post.push({ type: 'section', content: sectionTitle });
        }
        continue;
      }
      
      // ### Detectar subseção
      if (trimmed.startsWith('### ')) {
        const subsection = trimmed.replace(/^###\s*/, '');
        if (currentSection === 'pre') pre.push({ type: 'subsection', content: subsection });
        if (currentSection === 'post') post.push({ type: 'subsection', content: subsection });
        continue;
      }
      
      // > Detectar nota/alerta
      if (trimmed.startsWith('> ')) {
        const note = trimmed.replace(/^>\s*/, '');
        if (currentSection === 'pre') pre.push({ type: 'note', content: note });
        if (currentSection === 'post') post.push({ type: 'note', content: note });
        continue;
      }
      
      // • ou - Detectar bullet com indentação
      if (trimmed.match(/^[•\-]\s+/)) {
        const bullet = trimmed.replace(/^[•\-]\s+/, '');
        
        // Detectar indentação (2 espaços = 1 nível)
        const indentMatch = line.match(/^(\s+)/);
        const level = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
        
        const element: MarkdownElement = {
          type: level > 0 ? 'subbullet' : 'bullet',
          content: bullet,
          level
        };
        
        if (currentSection === 'pre') pre.push(element);
        if (currentSection === 'post') post.push(element);
        continue;
      }
      
      // Texto simples (sem marcação) = bullet sem símbolo
      if (currentSection && trimmed) {
        const indentMatch = line.match(/^(\s+)/);
        const level = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
        
        const element: MarkdownElement = {
          type: level > 0 ? 'subbullet' : 'bullet',
          content: trimmed,
          level
        };
        
        if (currentSection === 'pre') pre.push(element);
        if (currentSection === 'post') post.push(element);
      }
    }
    
    return { pre, post };
  };

  // Transforma texto simples em HTML com hyperlinks para produtos do catálogo
  const linkifyProducts = (text: string, productMap: Map<string, any>): JSX.Element[] => {
    if (!text || productMap.size === 0) {
      return [<span key="plain">{text}</span>];
    }

    // Criar regex pattern com todos os nomes de produtos (ordenar por tamanho desc para evitar matches parciais)
    const productNames = Array.from(productMap.keys())
      .sort((a, b) => b.length - a.length);
    
    if (productNames.length === 0) {
      return [<span key="plain">{text}</span>];
    }

    const pattern = productNames
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, idx) => {
      const normalizedPart = part.toLowerCase();
      const product = productMap.get(normalizedPart);
      
      if (product) {
        return (
          <a
            key={idx}
            href={product.shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline decoration-dotted underline-offset-2 transition-colors"
          >
            {product.name}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }
      
      return <span key={idx}>{part}</span>;
    });
  };

  // Renderiza cada elemento Markdown com estilo apropriado
  const renderMarkdownElement = (
    element: MarkdownElement, 
    idx: number, 
    productMap: Map<string, any>
  ): JSX.Element | null => {
    const key = `element-${idx}`;
    
    switch (element.type) {
      case 'section':
        // ## Título principal (não renderizar - já está no header)
        return null;
        
      case 'subsection':
        // ### Subtítulo
        return (
          <h4 key={key} className="text-sm font-bold text-foreground mt-4 mb-2 flex items-center gap-2 first:mt-0">
            <span className="text-primary">🔹</span>
            {element.content}
          </h4>
        );
        
      case 'note':
        // > Nota/alerta
        return (
          <div key={key} className="my-2 p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r">
            <p className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <span className="text-lg shrink-0">⚠️</span>
              <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
            </p>
          </div>
        );
        
      case 'bullet':
        // • Bullet principal (nível 0)
        return (
          <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-primary mt-1 shrink-0">•</span>
            <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
          </li>
        );
        
      case 'subbullet':
        // Bullet indentado (nível 1+)
        const indent = (element.level || 1) * 16; // 16px por nível
        return (
          <li 
            key={key} 
            className="flex items-start gap-2 text-sm text-muted-foreground"
            style={{ marginLeft: `${indent}px` }}
          >
            <span className="text-muted-foreground/60 mt-1 shrink-0">◦</span>
            <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
          </li>
        );
        
      default:
        return null;
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

        {processingInstructions && (() => {
          const { pre, post } = parseMarkdownInstructions(processingInstructions);
          const hasInstructions = pre.length > 0 || post.length > 0;
          
          if (!hasInstructions) return null;
          
          return (
            <div className="mt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="processing" className="border-0">
                  <AccordionTrigger className="px-0 py-3 hover:no-underline text-left flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">
                      Instruções de Pré/Pós Processamento
                    </span>
                  </AccordionTrigger>
                   <AccordionContent className="px-0 pb-0">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                      {pre.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <span className="text-blue-600 dark:text-blue-400">🔵</span>
                            PRÉ-PROCESSAMENTO
                          </h4>
                          <ul className="space-y-1.5">
                            {pre.map((element, idx) => renderMarkdownElement(element, idx, products))}
                          </ul>
                        </div>
                      )}
                      
                      {post.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">🟢</span>
                            PÓS-PROCESSAMENTO
                          </h4>
                          <ul className="space-y-1.5">
                            {post.map((element, idx) => renderMarkdownElement(element, idx, products))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          );
        })()}
      </div>
    </div>
  );
}